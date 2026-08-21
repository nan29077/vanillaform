import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSellerSettlementSummary, getPlatformFees } from "@/lib/settlement";

export const dynamic = "force-dynamic";

/** 한국 시간(UTC+9) 기준 날짜 문자열(YYYY-MM-DD) 반환 */
function toKSTDateString(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** paidAt 기준 당일 취소 여부 판단 (한국 시간 기준 같은 날짜면 SAME_DAY) */
function resolveCancelType(paidAt: Date): "SAME_DAY" | "POST_DAY" {
  const paidKST = toKSTDateString(paidAt);
  const nowKST = toKSTDateString(new Date());
  return paidKST === nowKST ? "SAME_DAY" : "POST_DAY";
}

// POST: 셀러가 결제취소 요청
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const role = (session.user as any).role as string;
    if (role !== "SELLER") {
      return NextResponse.json({ error: "셀러만 결제취소 요청을 할 수 있습니다." }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(params);
    const orderId = resolvedParams.id;

    // 셀러 프로필 조회
    const sellerProfile = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!sellerProfile) {
      return NextResponse.json({ error: "셀러 프로필을 찾을 수 없습니다." }, { status: 404 });
    }

    // 주문 조회
    const order = await (prisma.order.findUnique as any)({
      where: { id: orderId },
      select: {
        id: true,
        sellerId: true,
        paymentStatus: true,
        finalAmount: true,
        paidAt: true,
        cancelStatus: true,
      },
    });
    if (!order) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    // 본인 주문인지 확인
    if (order.sellerId !== sellerProfile.id) {
      return NextResponse.json({ error: "본인 샵의 주문만 취소 요청할 수 있습니다." }, { status: 403 });
    }

    // 결제 완료 상태인지 확인
    if (order.paymentStatus !== "COMPLETED") {
      return NextResponse.json({ error: "결제 완료 상태의 주문만 취소 요청할 수 있습니다." }, { status: 400 });
    }

    // 이미 취소 요청이 있는지 확인
    if (order.cancelStatus) {
      return NextResponse.json({ error: "이미 결제취소 요청이 존재합니다." }, { status: 400 });
    }

    if (!order.paidAt) {
      return NextResponse.json({ error: "결제 시각 정보가 없습니다." }, { status: 400 });
    }

    const cancelType = resolveCancelType(new Date(order.paidAt));
    const cancelAmount = Number(order.finalAmount);
    const now = new Date();

    // POST_DAY: 셀러 정산금에서 차감 가능한지 확인
    let cancelFromSettlement = false;
    let cancelStatus = "REQUESTED";

    if (cancelType === "POST_DAY") {
      // 셀러의 미지급 정산 잔액으로 취소 금액을 감당할 수 있는지 판단한다.
      // (기존에는 seed 에서만 생성되는 Settlement 테이블을 조회해 운영에서 항상 0이었음
      //  — docs/SETTLEMENT_ISSUES.md #4)
      // 미지급 잔액 = 출금 가능(진행중 출금 차감 후) + 정산 예정 - 이 주문 자신의 정산액.
      // 취소가 확정되면 이 주문의 정산액은 사라지므로 감당 재원에서 제외한다.
      const fees = await getPlatformFees();
      const summary = await getSellerSettlementSummary(sellerProfile.id, fees);
      const thisOrder = summary.orders.find((o) => o.orderId === orderId);
      const availableSettlement =
        summary.withdrawableAmount +
        summary.scheduledTotal -
        (thisOrder ? thisOrder.settlementAmount : 0);
      if (availableSettlement >= cancelAmount) {
        cancelFromSettlement = true;
        cancelStatus = "DEPOSIT_CONFIRMED";
      }
    }

    // 주문 업데이트
    const updated = await (prisma.order.update as any)({
      where: { id: orderId },
      data: {
        cancelRequestedAt: now,
        cancelRequestedBy: session.user!.id,
        cancelType,
        cancelStatus,
        cancelAmount,
        cancelFromSettlement,
        deliveryStatus: "CANCEL_REQUESTED",
      },
    });

    return NextResponse.json({
      cancelType,
      cancelStatus,
      cancelFromSettlement,
      cancelAmount,
    });
  } catch (e: any) {
    console.error("[cancel-request POST]", e?.message || e);
    return NextResponse.json({ error: "결제취소 요청에 실패했습니다." }, { status: 500 });
  }
}
