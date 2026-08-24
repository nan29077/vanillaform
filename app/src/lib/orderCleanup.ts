import { prisma } from "@/lib/prisma";
import { releaseOrderStockInTx } from "@/lib/orderStock";
// 이 프로젝트의 Prisma Client 는 커스텀 출력 경로(src/generated/prisma)로 생성된다.
// "@prisma/client" 는 타입이 비어 있는 스텁이라 여기서 쓰면 안 된다(orderStock.ts 와 동일).
import type { Prisma } from "@/generated/prisma";

// 주문관리 목록(셀러·브랜드·관리자)에 노출할 주문의 공통 필터.
// - PENDING(결제 진행 중·미결제) 제외
// - 결제 흔적이 전혀 없는 CANCELLED 제외: pgTid 가 없으면 PG 승인 이전에 이탈한
//   주문(결제창만 띄우고 닫음/중단)이므로 목록에 노출하지 않는다.
//   반대로 pgTid 가 있는 CANCELLED(실제 결제 후 취소·환불, 혹은 복구 대상)는 노출 유지.
export const VISIBLE_ORDER_FILTER: Prisma.OrderWhereInput = {
  status: { not: "PENDING" },
  NOT: { status: "CANCELLED", pgTid: null },
};

// 결제까지 이어지지 않고 방치된 PENDING 주문을 정리한다.
// 결제 구조상 주문은 결제 전에 PENDING 으로 먼저 생성되므로, 사용자가 결제창을
// 닫고 돌아오지 않으면(abort 미호출) PENDING 이 영구히 남는다. 이를 일정 시간 뒤
// 하드 삭제하여 "이탈 주문이 저장되지 않도록" 한다. 캠페인 카운터·커미션도 롤백.

// 결제 진행에 충분한 여유(결제창 체류·콜백 지연)를 둔 만료 기준.
const STALE_MINUTES = 30;

// 정리 트랜잭션 도중 결제 콜백이 도착해 주문이 완료되었음을 알리는 내부 신호.
// 이 예외로 트랜잭션을 롤백하되, 상위에서는 '오류'가 아닌 '안전한 건너뜀'으로 처리한다.
class PaymentCompletedDuringCleanup extends Error {
  constructor(orderNumber: string) {
    super(`PAYMENT_COMPLETED_DURING_CLEANUP:${orderNumber}`);
    this.name = "PaymentCompletedDuringCleanup";
  }
}

/**
 * 생성된 지 STALE_MINUTES 이상 지난 미결제 PENDING 주문을 삭제한다.
 * @returns 삭제된 주문 수
 */
export async function cleanupStalePendingOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000);

  const stale = await prisma.order.findMany({
    where: {
      status: "PENDING",
      paymentStatus: { not: "COMPLETED" }, // 결제 완료된 건은 절대 건드리지 않음
      paidAt: null,
      createdAt: { lt: cutoff },
      // 온기(ONGI) 간편계좌는 구매자가 나중에 실제 이체하는 비동기 입금 방식이라
      // 결제창을 연 뒤 30분을 넘겨 입금하는 것이 정상 범주다. 이 PENDING 을 정리하면
      // 뒤늦게 도착한 입금 콜백이 ORDER_NOT_FOUND 가 되어(돈만 들어오고 주문 없음)
      // 사고가 난다. 온기 prepare 라우트에서 결제창을 띄울 때 pgProvider="ongi" 로
      // 미리 마킹하므로, 그 주문은 정리 대상에서 제외한다.
      //
      // NULL 주의: `NOT: { pgProvider: "ongi" }` 나 `pgProvider: { not: "ongi" }` 는
      // SQL 로 `pgProvider <> 'ongi'` 가 되는데, pgProvider 가 NULL 이면 이 비교가
      // NULL(=거짓 취급)이 되어 **결제창도 안 띄운 평범한 이탈 주문이 전부 제외**된다.
      // 실제로 이 조건 때문에 정리 대상 20건 중 0건만 걸려 크론이 무의미했다.
      // NULL 을 명시적으로 포함시켜야 한다.
      OR: [{ pgProvider: null }, { pgProvider: { not: "ongi" } }],
    },
    include: { items: true, referralCommissions: true, middleAdminCommissions: true },
  });

  let deleted = 0;
  for (const order of stale) {
    try {
      await prisma.$transaction(async (tx) => {
        // 선점 재고 복원 — 주문 생성 시 차감했던 일반상품·카탈로그 상품·옵션 재고를 되돌린다.
        // abort 라우트(api/orders/[id]/abort)와 동일한 로직. 이 복원이 없으면 결제 없이
        // 이탈한 주문의 차감 재고가 영구히 묶여 재고 1개짜리 상품이 "품절"로 굳는다.
        // (아래 조건부 deleteMany 가 0건이면 throw 되어 트랜잭션 전체가 롤백되므로,
        //  '그새 결제 완료된' 주문의 재고를 잘못 되돌리는 일은 없다.)
        await releaseOrderStockInTx(tx, order.items);

        // 캠페인 카운터 롤백
        if (order.campaignId) {
          const qty = order.items.reduce((acc, i) => acc + i.quantity, 0);
          await tx.groupBuyCampaign
            .update({
              where: { id: order.campaignId },
              data: {
                participantCount: { decrement: 1 },
                currentQuantity: { decrement: qty },
                totalRevenue: { decrement: Number(order.finalAmount) },
              },
            })
            .catch(() => {
              /* 캠페인이 이미 삭제된 경우 무시 */
            });
        }

        // 추천 커미션 롤백 (PENDING 적립분 차감 후 삭제)
        for (const c of order.referralCommissions) {
          if (c.status === "PENDING") {
            await tx.sellerProfile
              .update({
                where: { id: c.sellerId },
                data: { totalReferralEarnings: { decrement: Number(c.commissionAmount) } },
              })
              .catch(() => {});
          }
          await tx.referralCommission.delete({ where: { id: c.id } }).catch(() => {});
        }

        // 중간관리자 마진 롤백 (PENDING 적립 레코드 삭제)
        for (const m of order.middleAdminCommissions) {
          await tx.middleAdminCommission.delete({ where: { id: m.id } }).catch(() => {});
        }

        // 멘토 커미션 롤백 (PENDING 적립 레코드 삭제)
        const mentorComms = await (prisma as any).mentorCommission.findMany({
          where: { orderId: order.id, status: "PENDING" },
          select: { id: true },
        }).catch(() => []);
        for (const mc of mentorComms) {
          await (tx as any).mentorCommission.delete({ where: { id: mc.id } }).catch(() => {});
        }

        // 주문 삭제 (OrderItem 은 onDelete: Cascade).
        // ── 레이스 가드 ──
        // findMany 스냅샷 이후 삭제 직전 사이에 결제 콜백(ONGI 간편계좌 등 비동기 입금)이
        // 도착해 이 주문이 PAID/COMPLETED 로 바뀌었을 수 있다. id 만으로 무조건 삭제하면
        // 방금 결제 완료된 주문까지 지워진다(실 사고 발생). 따라서 아직 '미결제 PENDING'
        // 인 경우에만 삭제되도록 조건부 삭제하고, 0건이면(=그새 결제 완료) throw 하여
        // 트랜잭션 전체(카운터·커미션 롤백 포함)를 원복한다.
        const del = await tx.order.deleteMany({
          where: {
            id: order.id,
            status: "PENDING",
            paymentStatus: { not: "COMPLETED" },
            paidAt: null,
          },
        });
        if (del.count === 0) {
          throw new PaymentCompletedDuringCleanup(order.orderNumber);
        }
      });
      deleted++;
    } catch (e) {
      // 정리 도중 결제가 완료되어 안전하게 건너뛴 경우 — 오류가 아니므로 조용히 통과.
      if (e instanceof PaymentCompletedDuringCleanup) {
        continue;
      }
      // 한 건 실패가 전체를 막지 않도록 로깅 후 계속
      console.error(`[orderCleanup] PENDING 주문 정리 실패: ${order.orderNumber}`, e);
    }
  }

  return deleted;
}
