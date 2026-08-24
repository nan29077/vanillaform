/**
 * 주문 재고 선점 / 복원.
 *
 * 정책: **주문 생성 시 선점 + 주문 무효화 시 복원**.
 *   구매자가 주문서를 만드는 순간(=PG 결제창을 띄우기 직전) 재고를 잡아두고,
 *   결제를 끝내지 않고 이탈하거나 PG 가 실패를 통보하면 되돌린다.
 *
 * 왜 "읽고 비교"로는 부족한가:
 *   재고를 SELECT 해서 비교만 하면, 두 구매자가 같은 마지막 1개를 동시에 통과한다.
 *   그래서 차감은 반드시 `where: { stock: { gte: 수량 } }` 조건부 UPDATE 로 하고,
 *   영향 행수가 1이 아니면 트랜잭션을 롤백시켜 주문 자체를 만들지 않는다.
 *   (DB 가 행 잠금으로 직렬화해주므로 애플리케이션 레벨 락이 필요 없다)
 */
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

/** 재고 선점 실패(동시 주문으로 재고 소진) — 트랜잭션을 롤백시키고 409 로 응답한다. */
export class StockShortageError extends Error {}

/** 선점 대상. itemType 에 따라 가리키는 테이블이 다르다. */
export type StockOp = {
  /** DIRECT → DirectProduct.id, PRODUCT → Product.id */
  itemType: "DIRECT" | "PRODUCT";
  productId: string;
  /** 옵션 상품이면 ProductVariant.id (PRODUCT 전용) */
  variantId: string | null;
  quantity: number;
};

type Tx = Prisma.TransactionClient;

/**
 * 트랜잭션 안에서 재고를 선점한다. 한 건이라도 부족하면 StockShortageError 를 던져
 * 주문·결제·커미션까지 통째로 롤백시킨다.
 */
export async function reserveStockInTx(tx: Tx, ops: StockOp[]): Promise<void> {
  for (const op of ops) {
    if (op.itemType === "DIRECT") {
      const updated = await tx.directProduct.updateMany({
        where: { id: op.productId, stock: { gte: op.quantity } },
        data: { stock: { decrement: op.quantity } },
      });
      if (updated.count !== 1) throw new StockShortageError();
      continue;
    }

    if (op.variantId) {
      // 옵션 상품은 옵션 재고가 판매 가능 수량의 기준이다.
      const updated = await tx.productVariant.updateMany({
        where: { id: op.variantId, stock: { gte: op.quantity } },
        data: { stock: { decrement: op.quantity } },
      });
      if (updated.count !== 1) throw new StockShortageError();

      // products.totalStock 은 옵션 재고의 합계로 유지되는 표시용 값이다.
      // 과거 데이터에 합계가 어긋난 상품이 있어 여기서도 조건부 차감으로 막으면
      // 옵션 재고가 충분한 정상 주문까지 실패한다. 그래서 음수 방지만 하고,
      // 오버셀 차단은 위의 옵션 재고 조건부 차감이 담당한다.
      await tx.$executeRawUnsafe(
        `UPDATE products SET totalStock = GREATEST(0, totalStock - ?) WHERE id = ?`,
        op.quantity,
        op.productId,
      );
      continue;
    }

    const updated = await tx.product.updateMany({
      where: { id: op.productId, totalStock: { gte: op.quantity } },
      data: { totalStock: { decrement: op.quantity } },
    });
    if (updated.count !== 1) throw new StockShortageError();
  }
}

type OrderItemForRestore = {
  itemType: string;
  productId: string;
  variantId: string | null;
  quantity: number;
};

/**
 * 선점했던 재고를 되돌린다.
 * updateMany 를 쓰는 이유 — 그 사이 상품이 삭제됐어도 0건 처리되어 주문 취소 자체는 성공해야 한다.
 *
 * 주의: 이 함수는 멱등하지 않다. 반드시 "주문을 CANCELLED 로 전이시키는 데 성공한 호출"에서만
 * 한 번 불러야 한다 (voidPendingOrder 참고). 두 번 부르면 재고가 부풀려진다.
 */
export async function releaseOrderStockInTx(tx: Tx, items: OrderItemForRestore[]): Promise<void> {
  for (const it of items) {
    if (it.itemType === "DIRECT") {
      await tx.directProduct.updateMany({
        where: { id: it.productId },
        data: { stock: { increment: it.quantity } },
      });
      continue;
    }

    if (it.variantId) {
      await tx.productVariant.updateMany({
        where: { id: it.variantId },
        data: { stock: { increment: it.quantity } },
      });
    }
    await tx.product.updateMany({
      where: { id: it.productId },
      data: { totalStock: { increment: it.quantity } },
    });
  }
}

export type VoidOrderResult = "VOIDED" | "ALREADY" | "COMPLETED" | "NOT_FOUND";

/**
 * 미결제 주문을 무효화한다 — 재고·캠페인 카운터·커미션을 모두 되돌리고 CANCELLED/FAILED 로 전이.
 *
 * 사용처: 결제창 이탈(/api/orders/[id]/abort), PG 실패 통보(seedpay /result, ongi /callback).
 *
 * 멱등성: 상태 전이를 조건부 updateMany 로 **먼저** 수행하고, 전이에 성공한(count===1) 호출만
 * 롤백을 진행한다. SeedPay 결제창이 /result 를 두 번 호출하거나 이탈 처리와 실패 콜백이
 * 겹쳐 들어와도 재고가 두 번 복원되지 않는다.
 * 결제 완료 주문은 어떤 경로로도 무효화하지 않는다(환불은 취소 API 담당).
 */
export async function voidPendingOrder(
  orderId: string,
  extraData: Prisma.OrderUpdateManyMutationInput = {},
): Promise<VoidOrderResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, referralCommissions: true },
  });
  if (!order) return "NOT_FOUND";
  if (order.paymentStatus === "COMPLETED") return "COMPLETED";

  return await prisma.$transaction(async (tx) => {
    const flipped = await tx.order.updateMany({
      where: { id: orderId, status: { not: "CANCELLED" }, paymentStatus: { not: "COMPLETED" } },
      data: {
        status: "CANCELLED",
        paymentStatus: "FAILED",
        cancelledAt: new Date(),
        ...extraData,
      },
    });
    // 다른 요청이 이미 무효화했다 — 재고·카운터는 그쪽에서 복원했으므로 여기선 아무것도 하지 않는다.
    if (flipped.count !== 1) return "ALREADY" as const;

    await releaseOrderStockInTx(tx, order.items);

    // 캠페인 카운터 롤백
    if (order.campaignId) {
      const totalQty = order.items.reduce((acc, i) => acc + i.quantity, 0);
      await tx.groupBuyCampaign.update({
        where: { id: order.campaignId },
        data: {
          participantCount: { decrement: 1 },
          currentQuantity: { decrement: totalQty },
          totalRevenue: { decrement: Number(order.finalAmount) },
        },
      });
    }

    // 추천 커미션 PENDING 롤백
    for (const c of order.referralCommissions) {
      if (c.status === "PENDING") {
        await tx.referralCommission.delete({ where: { id: c.id } });
        await tx.sellerProfile.update({
          where: { id: c.sellerId },
          data: { totalReferralEarnings: { decrement: Number(c.commissionAmount) } },
        });
      }
    }

    // 중간관리자 마진 롤백.
    // 주문 생성 시 middleAdminCommission 을 PENDING 으로 적립하므로, 결제가 실패한
    // 주문의 적립분도 함께 지워야 한다. 남겨두면 결제되지 않은 주문의 마진이
    // 중간관리자 정산에 그대로 잡힌다.
    await tx.middleAdminCommission.deleteMany({
      where: { orderId, status: "PENDING" },
    });

    // 멘토 커미션 롤백
    const mentorCommissions = await (tx as any).mentorCommission.findMany({
      where: { orderId, status: "PENDING" },
    });
    for (const mc of mentorCommissions) {
      await (tx as any).mentorCommission.delete({ where: { id: mc.id } }).catch(() => {});
    }

    return "VOIDED" as const;
  });
}
