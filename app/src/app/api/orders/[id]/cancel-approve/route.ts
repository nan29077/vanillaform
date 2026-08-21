import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST: 최고관리자가 결제취소 승인
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
    if (role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "최고관리자만 결제취소를 승인할 수 있습니다." }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(params);
    const orderId = resolvedParams.id;

    // 주문 조회
    const order = await (prisma.order.findUnique as any)({
      where: { id: orderId },
      select: {
        id: true,
        cancelStatus: true,
        cancelType: true,
        pgTid: true,
        pgProvider: true,
      },
    });
    if (!order) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    // 승인 가능한 상태인지 확인
    if (!["REQUESTED", "DEPOSIT_CONFIRMED"].includes(order.cancelStatus)) {
      return NextResponse.json(
        { error: "결제취소 요청 또는 입금완료 상태의 주문만 승인할 수 있습니다." },
        { status: 400 }
      );
    }

    const now = new Date();
    let finalCancelStatus = "COMPLETED";

    // SAME_DAY: PG 취소 호출 (현재는 스텁 — 실제 PG 연동 시 여기에 구현)
    if (order.cancelType === "SAME_DAY" && order.pgTid) {
      // TODO: 실제 PG API 취소 호출
      // 현재는 바로 COMPLETED 처리
      finalCancelStatus = "COMPLETED";
    }

    // 주문 최종 업데이트 + 이 주문에 적립된 미지급 커미션(레퍼럴/중간관리자/멘토) 취소.
    // 커미션을 함께 취소하지 않으면 취소된 주문의 커미션이 별도 정산 경로에서
    // 지급될 수 있다. 이미 지급(PAID)된 커미션은 건드리지 않는다. (docs/SETTLEMENT_ISSUES.md #6)
    await prisma.$transaction([
      (prisma.order.update as any)({
        where: { id: orderId },
        data: {
          cancelApprovedAt: now,
          cancelStatus: finalCancelStatus,
          status: "CANCELLED",
          paymentStatus: "REFUNDED",
          deliveryStatus: "CANCEL_COMPLETED",
          cancelledAt: now,
          refundedAt: now,
        },
      }),
      prisma.referralCommission.updateMany({
        where: { orderId, status: { in: ["PENDING", "CONFIRMED"] } },
        data: { status: "CANCELLED" },
      }),
      prisma.middleAdminCommission.updateMany({
        where: { orderId, status: { in: ["PENDING", "CONFIRMED"] } },
        data: { status: "CANCELLED" },
      }),
      prisma.mentorCommission.updateMany({
        where: { orderId, status: { in: ["PENDING", "CONFIRMED"] } },
        data: { status: "CANCELLED" },
      }),
    ]);

    return NextResponse.json({ cancelStatus: finalCancelStatus, message: "결제취소가 완료되었습니다." });
  } catch (e: any) {
    console.error("[cancel-approve POST]", e?.message || e);
    return NextResponse.json({ error: "결제취소 승인에 실패했습니다." }, { status: 500 });
  }
}
