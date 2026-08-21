// 셀러 정산 집계 서버 유틸.
// - 주문(Order) 데이터에서 "영업일 기준 N일 후" 규칙으로 정산일을 계산해
//   '정산 가능 금액'(정산일 도래)과 '정산 예정 금액'(정산일 전)을 집계한다.
// - N은 최고관리자 권한설정(settlementBusinessDays, 기본 5)을 읽어 사용한다.
// - 출금 요청(PayoutRequest) 중 반려(REJECTED)를 제외한 전 상태(요청/승인/지급완료)를
//   가용 금액에서 차감한다. 진행 중 금액을 차감하지 않으면 지급 처리 전에
//   같은 금액을 중복 신청할 수 있어 이중 지급 사고로 이어진다. (docs/SETTLEMENT_ISSUES.md #1)
// prisma 를 사용하므로 서버 컴포넌트 / route handler 에서만 사용하세요.

import { prisma } from "@/lib/prisma";
import { getSettlementBusinessDays, getMiddleSettleDays } from "@/lib/settings";
import { getSettlementDate, startOfDay, toYmd } from "@/lib/businessDays";
import { withVatRate } from "@/lib/utils";

// ───── 정산 수취인 판정 ─────
// A. 브랜드 직접 등록 (brandId 有, middleAdminId 無) → 브랜드사 (supplyPrice 기준)
// B. 중간관리자 영업 브랜드 (middleAdminId 有)      → 중간관리자만 (supplyPrice 기준)
// C. 셀러 본인 등록 (sellerId 有)                   → 셀러 (기존 셀러 정산)
export type SettlementRole = "SELLER" | "MIDDLE_ADMIN" | "BRAND";
export type SettlementRecipient = { role: SettlementRole; id: string } | null;

export function productSettlementRecipient(p: {
  sellerId?: string | null;
  middleAdminId?: string | null;
  brandId?: string | null;
}): SettlementRecipient {
  if (p.sellerId) return { role: "SELLER", id: p.sellerId };
  if (p.middleAdminId) return { role: "MIDDLE_ADMIN", id: p.middleAdminId };
  if (p.brandId) return { role: "BRAND", id: p.brandId };
  return null;
}

// 정산 대상 주문 1건의 계산 결과
export interface SettlementOrder {
  orderId: string;
  orderNumber: string;
  saleDate: string; // 판매(결제완료) 기준일 ISO
  settlementDate: string; // 정산 가능 전환일 ISO (영업일+N)
  settlementYmd: string; // 정산일 YYYY-MM-DD
  saleYmd: string; // 판매일 YYYY-MM-DD
  grossAmount: number; // 결제 금액(정산 기준 매출)
  supplyAmount: number; // 공급가 합계 (B타입 상품만, 브랜드 정산액)
  effectiveAmount: number; // 실효 매출 = grossAmount - supplyAmount (수수료 산정 기준)
  commissionRate: number; // 적용 수수료율(%)
  commissionAmount: number; // 수수료
  settlementAmount: number; // 정산액(세전) = effectiveAmount - 수수료 - 장바구니 할인(셀러 부담)
  cartDiscountAmount: number; // 장바구니 할인액(셀러 부담분, 정산에서 차감됨)
  available: boolean; // 정산일 도래 여부
  campaignTitle: string | null;
  type: "groupbuy" | "normal"; // 캠페인 주문 / 일반 주문
  productType: "seller" | "supply" | "mixed"; // A타입(셀러등록), B타입(공급), 혼합
  productNames?: string[]; // 주문에 포함된 상품명(상세내역 표시용)
}

export interface PayoutSummary {
  id: string;
  amount: number;
  netAmount: number;
  orderCount: number;
  status: string;
  isBusiness: boolean;
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  note: string | null;
  requestedAt: string;
  processedAt: string | null;
}

export interface SellerSettlementSummary {
  businessDays: number;
  commissionRate: number;
  orders: SettlementOrder[];
  availableTotal: number; // 정산일 도래분 정산액 합계(세전)
  scheduledTotal: number; // 정산일 전(예정)분 정산액 합계(세전)
  totalGrossAmount: number; // 총 판매금액 합계
  totalSupplyAmount: number; // 총 공급가 합계 (브랜드 정산액)
  totalCommissionAmount: number; // 총 플랫폼 수수료 합계
  reservedAmount: number; // 지급완료(PAID)된 출금 금액(세전) — 가용금액 차감용
  inProgressAmount: number; // "출금 진행중"(요청/승인, 지급완료·반려 제외) — 가용금액 차감용
  withdrawableAmount: number; // 실제 출금 신청 가능 금액 = availableTotal - reservedAmount - inProgressAmount
  payouts: PayoutSummary[];
}

// 정산 기준이 되는 "확정 매출" 주문만 집계:
// 결제완료(paymentStatus=COMPLETED) & 취소/환불이 아닌 주문.
function isSettleableOrder(paymentStatus: string, status: string): boolean {
  if (paymentStatus !== "COMPLETED") return false;
  if (["CANCELLED", "REFUNDED", "REFUND_REQUESTED"].includes(status)) return false;
  return true;
}

const round = (n: number) => Math.round(n);

// ───── 역할별 플랫폼 수수료율 ─────
// PlatformFeeSettings(단일 레코드)에서 셀러/중간관리자/브랜드 수수료율(%)을 읽어 정산 계산에 사용한다.
export interface PlatformFees {
  sellerFeeRate: number; // % 단위 (예: 5.0)
  middleAdminFeeRate: number;
  brandFeeRate: number;
}

export const DEFAULT_PLATFORM_FEES: PlatformFees = {
  sellerFeeRate: 5,
  middleAdminFeeRate: 5,
  brandFeeRate: 5,
};

// PlatformFeeSettings 조회 (없거나 오류 시 기본값 5/5/5)
export async function getPlatformFees(): Promise<PlatformFees> {
  try {
    const row = await (prisma as any).platformFeeSettings.findFirst({ orderBy: { id: "asc" } });
    if (!row) return { ...DEFAULT_PLATFORM_FEES };
    return {
      sellerFeeRate: Number(row.sellerFeeRate),
      middleAdminFeeRate: Number(row.middleAdminFeeRate),
      brandFeeRate: Number(row.brandFeeRate),
    };
  } catch {
    return { ...DEFAULT_PLATFORM_FEES };
  }
}

// 공급자(브랜드/중간관리자) 수수료율 결정 — 중간관리자 영업 상품이면 중간관리자율, 그 외 브랜드율
function resolveSupplierFeeRate(
  product: { middleAdminId?: string | null; brandId?: string | null },
  fees: PlatformFees,
): number {
  if (product.middleAdminId) return fees.middleAdminFeeRate;
  if (product.brandId) return fees.brandFeeRate;
  return fees.brandFeeRate; // 최고관리자 등록 상품도 brandFeeRate 적용
}

// 수수료율(%) → 정산 잔여 비율. 부가세 포함 실효율(rate × 1.1)을 차감한 비율.
// 예: 5% → 1 - 5×1.1/100 = 0.945
export const feeMultiplier = (rate: number) => 1 - (rate * 1.1) / 100;

export async function getSellerSettlementSummary(
  sellerId: string,
  fees: PlatformFees,
): Promise<SellerSettlementSummary> {
  const businessDays = await getSettlementBusinessDays();
  const today = startOfDay(new Date());
  // 셀러 개별 수수료율(SellerProfile.commissionRate, 관리자 셀러관리에서 설정)을 우선 적용하고,
  // 값이 없으면 전역 플랫폼 수수료율(sellerFeeRate)로 폴백한다. 표시는 실효율(rate × 1.1) 기준.
  const profile = await prisma.sellerProfile.findUnique({
    where: { id: sellerId },
    select: { commissionRate: true },
  });
  const sellerRate =
    profile?.commissionRate != null ? Number(profile.commissionRate) : fees.sellerFeeRate;
  const vatCommissionRate = withVatRate(sellerRate);
  const sellerFeeMul = feeMultiplier(sellerRate);

  const [rawOrders, payoutRows] = await Promise.all([
    prisma.order.findMany({
      where: {
        sellerId,
        paymentStatus: "COMPLETED",
        status: { notIn: ["CANCELLED", "REFUNDED", "REFUND_REQUESTED"] },
      },
      select: {
        id: true,
        orderNumber: true,
        finalAmount: true,
        cartDiscountAmount: true,
        paidAt: true,
        createdAt: true,
        status: true,
        paymentStatus: true,
        cancelStatus: true,
        sellerFeeRateSnap: true,
        campaign: { select: { title: true } },
        campaignId: true,
        items: {
          select: {
            productId: true,
            productName: true,
            quantity: true,
            totalPrice: true,
            // 정산 스냅샷 (주문 시점 고정값). 있으면 Product 현재값 대신 이걸 쓴다.
            supplyPriceSnap: true,
            priceModelSnap: true,
            productCommissionRateSnap: true,
            sellerFeeRateSnap: true,
            isSellerProductSnap: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payoutRequest.findMany({
      where: { sellerId },
      orderBy: { requestedAt: "desc" },
    }),
  ]);

  // 주문 아이템에서 상품 ID 수집 → 공급가/등록자 정보 일괄 조회
  const allProductIds = [...new Set(rawOrders.flatMap((o) => o.items.map((i) => i.productId)))];
  const productInfoMap = new Map<
    string,
    {
      supplyPrice: number | null;
      isSellerProduct: boolean;
      name: string;
      priceModel: string;
      commissionRate: number | null; // 수수료(COMMISSION) 제공 시 셀러 수수료율(%)
    }
  >();
  if (allProductIds.length > 0) {
    const prods = await prisma.product.findMany({
      where: { id: { in: allProductIds } },
      select: { id: true, supplyPrice: true, sellerId: true, name: true, priceModel: true, commissionRate: true },
    });
    for (const p of prods) {
      productInfoMap.set(p.id, {
        supplyPrice: p.supplyPrice != null ? Number(p.supplyPrice) : null,
        // A타입: 이 셀러가 직접 등록한 상품, B타입: 그 외(브랜드/관리자/중간관리자 등록)
        isSellerProduct: p.sellerId === sellerId,
        name: p.name,
        priceModel: String(p.priceModel),
        commissionRate: p.commissionRate != null ? Number(p.commissionRate) : null,
      });
    }
  }

  const orders: SettlementOrder[] = [];
  let availableTotal = 0;
  let scheduledTotal = 0;
  let totalGrossAmount = 0;
  let totalSupplyAmount = 0;
  let totalCommissionAmount = 0;

  for (const o of rawOrders) {
    if (!isSettleableOrder(o.paymentStatus, o.status)) continue;

    // 아이템별 정산 계산 — 상품 유형(Case 1/2A/2B)에 따라 셀러 정산액을 산정한다.
    let supplyAmount = 0; // 공급자 몫(셀러 정산에서 빠지는 금액, 표시용)
    let effBase = 0; // 셀러 정산 기준액(플랫폼 수수료 차감 전)
    let sellerSettle = 0; // 셀러 정산액(플랫폼 수수료 차감 후)
    let hasSellerProduct = false;
    let hasSupplyProduct = false;
    const productNames: string[] = [];
    for (const item of o.items) {
      const live = productInfoMap.get(item.productId);

      // 주문 시점 스냅샷이 있으면 그것만으로 계산한다(요율 변경·상품 삭제에 영향받지 않음).
      // 스냅샷 도입(2026-07-12) 이전 주문만 live 값으로 폴백한다.
      const hasSnap = item.sellerFeeRateSnap != null && item.isSellerProductSnap != null;
      const info = hasSnap
        ? {
            supplyPrice: item.supplyPriceSnap != null ? Number(item.supplyPriceSnap) : null,
            isSellerProduct: item.isSellerProductSnap === true,
            priceModel: item.priceModelSnap ?? "SUPPLY",
            commissionRate:
              item.productCommissionRateSnap != null
                ? Number(item.productCommissionRateSnap)
                : null,
            // 셀러 일반상품(DirectProduct)은 Product 조회가 빗나가므로 주문 시점 상품명을 쓴다.
            name: live?.name ?? item.productName ?? "",
          }
        : live;
      if (!info) continue; // 스냅샷도 없고 상품도 삭제된 주문 — 기존 동작 유지(0원)

      // 수수료율도 스냅샷 우선. 주문마다 다를 수 있으므로 아이템 단위로 적용한다.
      const itemFeeMul = hasSnap
        ? feeMultiplier(Number(item.sellerFeeRateSnap))
        : sellerFeeMul;

      if (info.name && !productNames.includes(info.name)) productNames.push(info.name);
      const itemSale = Number(item.totalPrice); // 판매가 × 수량

      if (info.isSellerProduct) {
        // Case 1 — 셀러 직접 등록 상품: 판매가 × (1 - sellerFeeRate × 1.1 / 100)
        hasSellerProduct = true;
        effBase += itemSale;
        sellerSettle += itemSale * itemFeeMul;
      } else if (info.priceModel === "COMMISSION" && info.commissionRate != null) {
        // Case 2B — 수수료(COMMISSION) 기반 셀러 신청 상품
        hasSupplyProduct = true;
        const sellerPortion = itemSale * (info.commissionRate / 100);
        effBase += sellerPortion;
        sellerSettle += sellerPortion * itemFeeMul;
        supplyAmount += itemSale - sellerPortion; // 공급자 몫(수수료 전)
      } else {
        // Case 2A — 공급가(SUPPLY) 기반 셀러 신청 상품
        hasSupplyProduct = true;
        const supply = (info.supplyPrice ?? 0) * item.quantity;
        const margin = Math.max(0, itemSale - supply);
        effBase += margin;
        sellerSettle += margin * itemFeeMul;
        supplyAmount += supply;
      }
    }

    // 아이템이 없는 주문(소셜 주문서 등 상품 매핑 없이 결제된 수기 주문)은
    // 공급가/커미션 산정이 불가능하므로 주문 결제액 전액을 셀러 정산 기준으로 삼는다.
    // (셀러 직접 등록 상품과 동일하게 플랫폼 수수료만 차감)
    // 요율은 주문 단위 스냅샷(Order.sellerFeeRateSnap) 우선 — 아이템이 없어 아이템 단위
    // 스냅샷을 쓸 수 없으므로, 이게 없으면 요율 변경 시 정산액이 소급 변동한다.
    if (o.items.length === 0) {
      hasSellerProduct = true;
      effBase = Number(o.finalAmount);
      const orderFeeMul =
        o.sellerFeeRateSnap != null ? feeMultiplier(Number(o.sellerFeeRateSnap)) : sellerFeeMul;
      sellerSettle = effBase * orderFeeMul;
    }

    const productType: SettlementOrder["productType"] =
      hasSellerProduct && hasSupplyProduct ? "mixed" : hasSellerProduct ? "seller" : "supply";

    const saleDate = o.paidAt ?? o.createdAt;
    const settlementDate = getSettlementDate(saleDate, businessDays);
    const gross = Number(o.finalAmount); // 표시용 판매금액(주문 결제액)
    const effectiveAmount = round(effBase); // 수수료 산정 기준(셀러 몫)
    // 장바구니 할인(셀러 부담) — 플랫폼 수수료는 할인 전 기준으로 계산하고,
    // 수수료 차감 후 정산액에서 할인액을 그대로 뺀다 (마진 초과 시 0원 하한).
    const cartDiscountAmount = Number((o as any).cartDiscountAmount ?? 0);
    const settlementBeforeCartDiscount = round(sellerSettle);
    const commissionAmount = Math.max(0, effectiveAmount - settlementBeforeCartDiscount);
    const settlementAmount = Math.max(0, settlementBeforeCartDiscount - round(cartDiscountAmount));
    // 결제취소 진행 중(요청/입금확인/승인 전) 주문은 취소가 확정되면 정산에서 빠지므로
    // 정산일이 도래했어도 출금 가능 금액에 포함하지 않는다. (docs/SETTLEMENT_ISSUES.md #5)
    // 취소 요청이 철회되면 cancelStatus 가 초기화되어 자동으로 다시 포함된다.
    const cancelPending = ["REQUESTED", "DEPOSIT_CONFIRMED", "APPROVED"].includes(
      o.cancelStatus ?? "",
    );
    const available = !cancelPending && settlementDate.getTime() <= today.getTime();

    if (available) availableTotal += settlementAmount;
    else scheduledTotal += settlementAmount;

    totalGrossAmount += gross;
    totalSupplyAmount += supplyAmount;
    totalCommissionAmount += commissionAmount;

    orders.push({
      orderId: o.id,
      orderNumber: o.orderNumber,
      saleDate: saleDate.toISOString(),
      settlementDate: settlementDate.toISOString(),
      settlementYmd: toYmd(settlementDate),
      saleYmd: toYmd(startOfDay(saleDate)),
      grossAmount: gross,
      supplyAmount,
      effectiveAmount,
      commissionRate: vatCommissionRate,
      commissionAmount,
      settlementAmount,
      cartDiscountAmount,
      available,
      campaignTitle: o.campaign?.title ?? null,
      type: o.campaignId ? "groupbuy" : "normal",
      productType,
      productNames,
    });
  }

  // 지급완료(PAID)된 출금 금액 — 이미 나간 돈
  const reservedAmount = payoutRows
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  // "출금 진행중"(요청/승인, 지급완료·반려 제외) 금액 — 아직 나가지 않았지만 예약된 돈.
  // 반려(REJECTED)되면 자동으로 다시 출금 가능 금액에 포함된다.
  const inProgressAmount = payoutRows
    .filter((p) => p.status === "REQUESTED" || p.status === "APPROVED")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  // 출금 신청 가능 금액 = 정산 도래분 - 지급완료 - 진행중(이중 신청 방지)
  const withdrawableAmount = Math.max(0, availableTotal - reservedAmount - inProgressAmount);

  const payouts: PayoutSummary[] = payoutRows.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    netAmount: Number(p.netAmount),
    orderCount: p.orderCount,
    status: p.status,
    isBusiness: p.isBusiness,
    bankName: p.bankName,
    accountNumber: p.accountNumber,
    accountHolder: p.accountHolder,
    note: p.note,
    requestedAt: p.requestedAt.toISOString(),
    processedAt: p.processedAt ? p.processedAt.toISOString() : null,
  }));

  return {
    businessDays,
    commissionRate: vatCommissionRate,
    orders,
    availableTotal,
    scheduledTotal,
    totalGrossAmount,
    totalSupplyAmount,
    totalCommissionAmount,
    reservedAmount,
    inProgressAmount,
    withdrawableAmount,
    payouts,
  };
}

// ───── 브랜드/중간관리자 정산 집계 (셀러 정산과 동일한 요약 구조, 공급가 기준, 수수료 차감) ─────
// 셀러 정산 UI(SellerSettlementClient)를 그대로 재사용할 수 있도록 SellerSettlementSummary 형태로 반환.
// 출금(payout)은 브랜드/중간관리자에 없으므로 payouts=[], withdrawable=availableTotal 로 채운다.
export async function getRecipientSettlementSummary(opts: {
  role: "BRAND" | "MIDDLE_ADMIN";
  recipientId: string;
  fees: PlatformFees;
  settleDays: number;
}): Promise<SellerSettlementSummary> {
  const today = startOfDay(new Date());
  const productWhere =
    opts.role === "BRAND"
      ? { brandId: opts.recipientId, middleAdminId: null }
      : { middleAdminId: opts.recipientId };

  // 공급자 플랫폼 수수료율(%) — 브랜드/중간관리자 역할에 따라 결정, 부가세 포함 실효율 차감
  const supplierFeeRate = opts.role === "BRAND" ? opts.fees.brandFeeRate : opts.fees.middleAdminFeeRate;
  const vatSupplierRate = withVatRate(supplierFeeRate);
  const supplierFeeMul = feeMultiplier(supplierFeeRate);

  const products = await prisma.product.findMany({
    where: productWhere,
    select: { id: true, supplyPrice: true, name: true, priceModel: true, commissionRate: true },
  });
  const productMap = new Map(
    products.map((p) => [
      p.id,
      {
        supply: p.supplyPrice != null ? Number(p.supplyPrice) : 0,
        name: p.name,
        priceModel: String(p.priceModel),
        commissionRate: p.commissionRate != null ? Number(p.commissionRate) : null,
      },
    ]),
  );

  const orders: SettlementOrder[] = [];
  let availableTotal = 0;
  let scheduledTotal = 0;

  {
    // 스냅샷이 있는 주문은 recipientRole/recipientId 로 직접 찾는다 — 이후 상품 소유자가
    // 바뀌어도 과거 주문의 정산 귀속이 흔들리지 않는다.
    // 스냅샷 이전 주문(recipientRole=null)만 현재 상품 소유 관계로 폴백한다.
    const items = await prisma.orderItem.findMany({
      where: {
        order: { paymentStatus: "COMPLETED", status: { notIn: ["CANCELLED", "REFUNDED", "REFUND_REQUESTED"] } },
        OR: [
          { recipientRole: opts.role, recipientId: opts.recipientId },
          ...(products.length > 0
            ? [{ recipientRole: null, productId: { in: products.map((p) => p.id) } }]
            : []),
        ],
      },
      select: {
        productId: true,
        quantity: true,
        totalPrice: true,
        productName: true,
        supplyPriceSnap: true,
        priceModelSnap: true,
        productCommissionRateSnap: true,
        supplierFeeRateSnap: true,
        recipientRole: true,
        order: { select: { id: true, orderNumber: true, paidAt: true, createdAt: true, campaignId: true, campaign: { select: { title: true } } } },
      },
    });

    // 주문 단위로 공급자 정산 기준액 합산 + 상품명 수집
    // - SUPPLY(공급가) 상품: 공급가 × 수량
    // - COMMISSION(수수료) 상품: 판매가 × (1 - 셀러 커미션율/100) = 공급자 몫
    const byOrder = new Map<
      string,
      { gross: number; settle: number; order: (typeof items)[number]["order"]; names: string[] }
    >();
    for (const it of items) {
      const hasSnap = it.recipientRole != null;
      const live = productMap.get(it.productId);
      const info = hasSnap
        ? {
            supply: it.supplyPriceSnap != null ? Number(it.supplyPriceSnap) : 0,
            name: it.productName,
            priceModel: it.priceModelSnap ?? "SUPPLY",
            commissionRate:
              it.productCommissionRateSnap != null ? Number(it.productCommissionRateSnap) : null,
          }
        : live;
      if (!info) continue;

      // 공급자 수수료율도 스냅샷 우선
      const itemFeeMul =
        hasSnap && it.supplierFeeRateSnap != null
          ? feeMultiplier(Number(it.supplierFeeRateSnap))
          : supplierFeeMul;

      const itemSale = Number(it.totalPrice);
      const base =
        info.priceModel === "COMMISSION" && info.commissionRate != null
          ? itemSale * (1 - info.commissionRate / 100)
          : info.supply * it.quantity;
      const ex = byOrder.get(it.order.id);
      if (ex) {
        ex.gross += base;
        ex.settle += base * itemFeeMul;
        if (info.name && !ex.names.includes(info.name)) ex.names.push(info.name);
      } else {
        byOrder.set(it.order.id, {
          gross: base,
          settle: base * itemFeeMul,
          order: it.order,
          names: info.name ? [info.name] : [],
        });
      }
    }

    for (const { gross: grossRaw, settle: settleRaw, order: o, names } of byOrder.values()) {
      const saleDate = o.paidAt ?? o.createdAt;
      const settlementDate = getSettlementDate(saleDate, opts.settleDays);
      const gross = round(grossRaw); // 공급자 정산 기준액(공급가/커미션 기준)
      // 공급자 정산액 = 공급가 × (1 - supplierFeeRate × 1.1 / 100)
      const settlementAmount = round(settleRaw);
      const commissionAmount = Math.max(0, gross - settlementAmount);
      const available = settlementDate.getTime() <= today.getTime();
      if (available) availableTotal += settlementAmount;
      else scheduledTotal += settlementAmount;
      orders.push({
        orderId: o.id,
        orderNumber: o.orderNumber,
        saleDate: saleDate.toISOString(),
        settlementDate: settlementDate.toISOString(),
        settlementYmd: toYmd(settlementDate),
        saleYmd: toYmd(startOfDay(saleDate)),
        grossAmount: gross,
        supplyAmount: gross, // 브랜드/중간관리자 정산은 공급가 기준 = grossAmount
        effectiveAmount: gross, // 수수료 산정 기준(공급가)
        commissionRate: vatSupplierRate,
        commissionAmount,
        settlementAmount,
        cartDiscountAmount: 0, // 장바구니 할인은 셀러 부담 — 공급자 정산에는 영향 없음
        available,
        campaignTitle: o.campaign?.title ?? null,
        type: o.campaignId ? "groupbuy" : "normal",
        productType: "supply",
        productNames: names,
      });
    }
  }

  orders.sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());

  const totalSupplyAmount = orders.reduce((s, o) => s + o.supplyAmount, 0);
  const totalCommissionAmount = orders.reduce((s, o) => s + o.commissionAmount, 0);

  // ── 이미 지급한 공급자 정산 차감 (이중 지급 방지) ──
  // 셀러는 PayoutRequest 로 지급분을 차감하지만 브랜드/중간관리자는 그 장치가 없어
  // 지급해도 "정산 가능액"이 그대로 남아 같은 금액을 반복 지급할 수 있었다.
  // 지급 기록: 브랜드=BrandSettlement, 중간관리자(공급분)=MiddleManagerSettlement.
  // (중간관리자의 영업 커미션(MiddleAdminCommission)은 별개 재원이라 여기서 차감하지 않는다)
  const paid = await getSupplierPaidAmounts(opts.role, opts.recipientId);
  const withdrawableAmount = Math.max(0, availableTotal - paid.reserved - paid.inProgress);

  return {
    businessDays: opts.settleDays,
    commissionRate: vatSupplierRate,
    orders,
    availableTotal,
    scheduledTotal,
    totalGrossAmount: totalSupplyAmount,
    totalSupplyAmount,
    totalCommissionAmount,
    reservedAmount: paid.reserved,
    inProgressAmount: paid.inProgress,
    withdrawableAmount,
    payouts: [],
  };
}

// 공급자(브랜드/중간관리자)에게 이미 나갔거나 예약된 정산 금액.
// reserved   = 지급 완료된 금액
// inProgress = 정산 레코드는 생성됐으나 아직 지급 전인 금액
export async function getSupplierPaidAmounts(
  role: "BRAND" | "MIDDLE_ADMIN",
  recipientId: string,
): Promise<{ reserved: number; inProgress: number }> {
  if (role === "BRAND") {
    const rows = await prisma.brandSettlement.findMany({
      where: { brandId: recipientId },
      select: { settlementAmount: true, totalSupply: true, isPaid: true },
    });
    // settlementAmount(수수료 차감 후 실지급액)가 기준. 이 컬럼 도입 이전 레코드는
    // totalSupply(수수료 차감 전)밖에 없으므로 차선책으로 그 값을 쓴다(과소 차감보다 안전).
    const amountOf = (r: (typeof rows)[number]) =>
      r.settlementAmount != null ? Number(r.settlementAmount) : Number(r.totalSupply);
    return {
      reserved: rows.filter((r) => r.isPaid).reduce((s, r) => s + amountOf(r), 0),
      inProgress: rows.filter((r) => !r.isPaid).reduce((s, r) => s + amountOf(r), 0),
    };
  }

  const rows = await prisma.middleManagerSettlement.findMany({
    where: { middleAdminId: recipientId },
    select: { totalAmount: true, status: true },
  });
  return {
    reserved: rows
      .filter((r) => r.status === "PAID")
      .reduce((s, r) => s + Number(r.totalAmount), 0),
    inProgress: rows
      .filter((r) => r.status !== "PAID" && r.status !== "REJECTED")
      .reduce((s, r) => s + Number(r.totalAmount), 0),
  };
}

// ───── 중간관리자 정산 집계 (상품 단위, 공급가 기준, 읽기 전용) ─────
export interface MiddleSettlementLine {
  orderId: string;
  orderNumber: string;
  orderDate: string; // 주문(결제)일 ISO
  productName: string;
  brandName: string;
  supplyPrice: number; // 공급가(단가)
  quantity: number;
  amount: number; // 정산 예정액 = 공급가 × 수량
  settlementYmd: string; // 정산 예정일 YYYY-MM-DD
  available: boolean; // 정산일 도래 여부
}
