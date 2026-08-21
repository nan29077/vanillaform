// 플랫폼(바닐라폼) 수익 집계.
//
// 이전 구현(admin/revenue/page.tsx)은 다음 세 가지가 틀려서 수익을 과대 계상했다:
//  1. 결제액 전액(finalAmount)에 요율을 곱함 → 공급가(브랜드/중간관리자 몫)까지 플랫폼
//     수수료 기준에 포함시킴. 실제 수수료 기준은 "각 수취인의 몫"이다.
//  2. 전역 sellerFeeRate 만 사용 → 셀러별 개별 요율을 무시.
//  3. take: 500 → 주문이 500건을 넘으면 합계 자체가 틀림.
//
// 여기서는 settlement.ts 와 완전히 동일한 규칙(스냅샷 우선)으로 계산해,
// 셀러/공급자 정산액과 플랫폼 수익의 합이 결제액과 정확히 맞아떨어지게 한다.
//   결제액 = 셀러 정산액 + 공급자 정산액 + 플랫폼 수수료
//
// prisma 를 사용하므로 서버에서만 호출할 것.

import { prisma } from "@/lib/prisma";
import { getPlatformFees, type PlatformFees } from "@/lib/settlement";

// PG 수수료율(%) — 부가세 포함 실효율 (2.6% + 0.26%). 플랫폼이 실제로 부담하는 비용.
export const PG_FEE_RATE = 2.86;

// 수수료율(%) → 부가세 포함 실효 수수료율. 예: 5% → 5.5%
const vatFee = (rate: number) => (rate * 1.1) / 100;

export interface RevenueRow {
  orderId: string;
  orderNumber: string;
  sellerName: string;
  finalAmount: number;
  sellerFee: number; // 셀러에게서 받은 플랫폼 수수료
  supplierFee: number; // 브랜드/중간관리자에게서 받은 플랫폼 수수료
  platformFee: number; // sellerFee + supplierFee
  marginRevenue: number; // 관리자 마진(adminMargin × 수량)
  createdAt: string;
}

export interface PlatformRevenue {
  rows: RevenueRow[];
  rowsTruncated: boolean; // 표시용 행을 잘랐는지 (합계는 항상 전체 기준)
  orderCount: number;
  totalSales: number; // 총 결제액(GMV)
  totalSellerFee: number;
  totalSupplierFee: number;
  totalPlatformFee: number; // 수수료 수익 (부가세 포함)
  totalMarginRevenue: number; // 상품 마진 수익
  totalPgFee: number; // PG 수수료(비용)
  netRevenue: number; // 순수익 = 수수료 + 마진 − PG
}

const MAX_ROWS = 1000; // 표시용 상한. 합계는 전체 주문으로 계산한다.

export async function getPlatformRevenue(opts: {
  dateFilter?: object;
  fees?: PlatformFees;
}): Promise<PlatformRevenue> {
  const fees = opts.fees ?? (await getPlatformFees());

  // take 제한 없음 — 합계가 틀리면 안 되므로 전 주문을 집계한다.
  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: "COMPLETED",
      status: { notIn: ["CANCELLED", "REFUNDED", "REFUND_REQUESTED"] },
      ...(opts.dateFilter ?? {}),
    },
    select: {
      id: true,
      orderNumber: true,
      finalAmount: true,
      createdAt: true,
      sellerId: true,
      sellerFeeRateSnap: true,
      seller: { select: { shopName: true, commissionRate: true } },
      items: {
        select: {
          productId: true,
          quantity: true,
          totalPrice: true,
          supplyPriceSnap: true,
          priceModelSnap: true,
          productCommissionRateSnap: true,
          sellerFeeRateSnap: true,
          supplierFeeRateSnap: true,
          isSellerProductSnap: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // 스냅샷이 없는 과거 주문(폴백용) + 관리자 마진용 상품 정보
  const productIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId)))];
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          adminMargin: true,
          supplyPrice: true,
          priceModel: true,
          commissionRate: true,
          sellerId: true,
          middleAdminId: true,
        },
      })
    : [];
  const pmap = new Map(products.map((p) => [p.id, p]));

  const rows: RevenueRow[] = [];
  let totalSales = 0;
  let totalSellerFee = 0;
  let totalSupplierFee = 0;
  let totalMarginRevenue = 0;

  for (const o of orders) {
    const finalAmount = Number(o.finalAmount);
    // 셀러 요율: 주문 스냅샷 > 셀러 프로필 > 전역
    const orderSellerRate =
      o.sellerFeeRateSnap != null
        ? Number(o.sellerFeeRateSnap)
        : o.seller?.commissionRate != null
          ? Number(o.seller.commissionRate)
          : fees.sellerFeeRate;

    let sellerBase = 0; // 셀러 몫 (셀러 수수료 부과 기준)
    let sellerFee = 0;
    let supplierFee = 0;
    let marginRevenue = 0;

    for (const it of o.items) {
      const live = pmap.get(it.productId);
      const hasSnap = it.sellerFeeRateSnap != null && it.isSellerProductSnap != null;

      const supplyPrice = hasSnap
        ? it.supplyPriceSnap != null
          ? Number(it.supplyPriceSnap)
          : null
        : live?.supplyPrice != null
          ? Number(live.supplyPrice)
          : null;
      const priceModel = hasSnap ? (it.priceModelSnap ?? "SUPPLY") : String(live?.priceModel ?? "SUPPLY");
      const prodCommRate = hasSnap
        ? it.productCommissionRateSnap != null
          ? Number(it.productCommissionRateSnap)
          : null
        : live?.commissionRate != null
          ? Number(live.commissionRate)
          : null;
      const isSellerProduct = hasSnap
        ? it.isSellerProductSnap === true
        : live?.sellerId === o.sellerId;
      const sellerRate = hasSnap ? Number(it.sellerFeeRateSnap) : orderSellerRate;
      const supplierRate = hasSnap
        ? it.supplierFeeRateSnap != null
          ? Number(it.supplierFeeRateSnap)
          : fees.brandFeeRate
        : live?.middleAdminId
          ? fees.middleAdminFeeRate
          : fees.brandFeeRate;

      if (!hasSnap && !live) continue; // 스냅샷도 상품도 없음 → settlement.ts 와 동일하게 0원 처리

      const itemSale = Number(it.totalPrice);

      // settlement.ts 와 동일한 3분기: 셀러 몫과 공급자 몫을 나눈다.
      let sBase: number;
      let supBase: number;
      if (isSellerProduct) {
        sBase = itemSale; // Case 1 — 셀러 직접 등록: 전액이 셀러 몫
        supBase = 0;
      } else if (priceModel === "COMMISSION" && prodCommRate != null) {
        sBase = itemSale * (prodCommRate / 100); // Case 2B
        supBase = itemSale - sBase;
      } else {
        const supply = (supplyPrice ?? 0) * it.quantity; // Case 2A
        sBase = Math.max(0, itemSale - supply);
        supBase = supply;
      }

      sellerBase += sBase;
      sellerFee += sBase * vatFee(sellerRate);
      supplierFee += supBase * vatFee(supplierRate);

      // 관리자 마진 — 수수료와 별개 수익원
      marginRevenue += Number(live?.adminMargin ?? 0) * it.quantity;
    }

    // 아이템 없는 주문(수기/소셜 주문서): 결제액 전액이 셀러 몫
    if (o.items.length === 0) {
      sellerBase = finalAmount;
      sellerFee = finalAmount * vatFee(orderSellerRate);
    }

    const sFee = Math.round(sellerFee);
    const supFee = Math.round(supplierFee);

    totalSales += finalAmount;
    totalSellerFee += sFee;
    totalSupplierFee += supFee;
    totalMarginRevenue += marginRevenue;

    if (rows.length < MAX_ROWS) {
      rows.push({
        orderId: o.id,
        orderNumber: o.orderNumber,
        sellerName: o.seller?.shopName ?? "-",
        finalAmount,
        sellerFee: sFee,
        supplierFee: supFee,
        platformFee: sFee + supFee,
        marginRevenue,
        createdAt: o.createdAt.toISOString(),
      });
    }
  }

  const totalPlatformFee = totalSellerFee + totalSupplierFee;
  // PG 수수료는 구매자 결제액 전체에 부과된다(플랫폼이 부담하는 실비용).
  const totalPgFee = Math.round((totalSales * PG_FEE_RATE) / 100);

  return {
    rows,
    rowsTruncated: orders.length > MAX_ROWS,
    orderCount: orders.length,
    totalSales,
    totalSellerFee,
    totalSupplierFee,
    totalPlatformFee,
    totalMarginRevenue,
    totalPgFee,
    netRevenue: totalPlatformFee + totalMarginRevenue - totalPgFee,
  };
}
