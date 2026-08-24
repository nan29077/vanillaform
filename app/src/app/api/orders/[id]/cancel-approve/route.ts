import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { releaseOrderStockInTx } from "@/lib/orderStock";

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

    // 주문 조회 — 재고 복원을 위해 items 도 함께 읽는다.
    const order = await (prisma.order.findUnique as any)({
      where: { id: orderId },
      select: {
        id: true,
        cancelStatus: true,
        cancelType: true,
        pgTid: true,
        pgProvider: true,
        items: {
          select: { itemType: true, productId: true, variantId: true, quantity: true },
        },
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
    const finalCancelStatus = "COMPLETED";

    // ─────────────────────────────────────────────────────────────
    // TODO(PG 계약 후 구현): 실제 PG 환불(승인취소) API 호출
    //   - SAME_DAY(당일 취소) : 승인취소(void) — seedpay/smartropay/ongi 각 취소 API
    //   - POST_DAY(익일 이후) : 부분/전액 환불(refund) API
    //   현재 seedpay/smartropay/ongi 모두 **미계약** 상태라 실호출을 구현하지 않는다.
    //   계약 후에는 아래 순서를 지킬 것:
    //     1) order.pgProvider 로 취소 어댑터 선택 (order.pgTid 필요)
    //     2) PG 취소 API 호출 → 성공 응답을 받은 뒤에만 아래 DB 트랜잭션 실행
    //     3) PG 취소 실패 시 finalCancelStatus 를 유지하지 말고 요청 상태로 되돌리고
    //        관리자에게 실패 사유를 반환 (지금처럼 무조건 COMPLETED 로 넘기면
    //        "시스템상 취소됐지만 돈은 환불되지 않은" 상태가 만들어진다)
    //     4) PaymentLog(logPayment) 에 stage:"cancel" 로 요청/응답 전문을 남길 것
    //   PG 취소가 붙기 전까지는 환불을 수기로 처리한다는 전제하에 DB 상태만 전이시킨다.
    // ─────────────────────────────────────────────────────────────

    // 주문 최종 업데이트 + 재고 복원 + 이 주문에 적립된 미지급 커미션(레퍼럴/중간관리자/멘토) 취소.
    // 커미션을 함께 취소하지 않으면 취소된 주문의 커미션이 별도 정산 경로에서
    // 지급될 수 있다. 이미 지급(PAID)된 커미션은 건드리지 않는다. (docs/SETTLEMENT_ISSUES.md #6)
    const result = await prisma.$transaction(async (tx) => {
      // 상태 전이를 조건부 updateMany 로 **먼저** 수행한다.
      // 승인 버튼 더블클릭이나 동시 요청이 들어와도 전이에 성공한 한 번만 재고를 복원한다.
      // (releaseOrderStockInTx 는 멱등하지 않아 두 번 부르면 재고가 부풀려진다)
      const flipped = await (tx.order.updateMany as any)({
        where: { id: orderId, cancelStatus: { in: ["REQUESTED", "DEPOSIT_CONFIRMED"] } },
        data: {
          cancelApprovedAt: now,
          cancelStatus: finalCancelStatus,
          status: "CANCELLED",
          paymentStatus: "REFUNDED",
          deliveryStatus: "CANCEL_COMPLETED",
          cancelledAt: now,
          refundedAt: now,
        },
      });
      if (flipped.count !== 1) return { applied: false };

      // 판매되지 않은 것이 되었으므로 선점됐던 재고를 되돌린다.
      // (주문 생성 시 reserveStockInTx 가 차감한 분량 — 그동안 누락돼 있었다)
      await releaseOrderStockInTx(tx, order.items);

      await tx.referralCommission.updateMany({
        where: { orderId, status: { in: ["PENDING", "CONFIRMED"] } },
        data: { status: "CANCELLED" },
      });
      await tx.middleAdminCommission.updateMany({
        where: { orderId, status: { in: ["PENDING", "CONFIRMED"] } },
        data: { status: "CANCELLED" },
      });
      await tx.mentorCommission.updateMany({
        where: { orderId, status: { in: ["PENDING", "CONFIRMED"] } },
        data: { status: "CANCELLED" },
      });

      return { applied: true };
    });

    if (!result.applied) {
      return NextResponse.json(
        { error: "이미 처리된 결제취소 요청입니다." },
        { status: 409 }
      );
    }

    return NextResponse.json({ cancelStatus: finalCancelStatus, message: "결제취소가 완료되었습니다." });
  } catch (e: any) {
    console.error("[cancel-approve POST]", e?.message || e);
    return NextResponse.json({ error: "결제취소 승인에 실패했습니다." }, { status: 500 });
  }
}
