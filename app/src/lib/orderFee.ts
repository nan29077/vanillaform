// 주문 상세보기용 "정산 수수료 안내" 계산 서버 유틸.
// - lib/settlement.ts 의 정산 규칙(상품 유형별 Case 1/2A/2B, 부가세 포함 수수료 차감)을
//   주문 1건 단위로 재구성해, 상세 모달/펼침 영역에 표시할 display 구조를 생성한다.
// - 역할별 관점(viewpoint):
//   · SELLER   — 셀러 정산 기준 (아이템별 Case 1/2A/2B)
//   · SUPPLIER — 브랜드/중간관리자 공급 정산 기준 (본인 공급 상품만)
//   · ADMIN    — 전체 수익 구조 (셀러/공급자/플랫폼)
// prisma 를 사용하므로 서버 컴포넌트 / route handler 에서만 사용하세요.

import { prisma } from "@/lib/prisma";
import { getPlatformFees, PlatformFees } from "@/lib/settlement";
import { withVatRate } from "@/lib/utils";

export type FeeTone = "default" | "fee" | "settle" | "muted";

export interface OrderFeeLine {
  label: string;
  value: string;
  tone?: FeeTone;
  strong?: boolean;
}

export interface OrderFeeItemCard {
  title: string;
  option?: string | null;
  typeLabel: string;
  lines: OrderFeeLine[];
}

export type FeeStatusTone = "scheduled" | "pending" | "excluded";

export interface OrderFeeInfo {
  viewpointLabel: string;
  items: OrderFeeItemCard[];
  summary: OrderFeeLine[];
  statusLabel: string;
  statusTone: FeeStatusTone;
}

// ───── 입력 타입 ─────
export interface FeeOrderItemInput {
  productId: string;
  quantity: number;
  totalPrice: number; // 판매가 × 수량
  productName: string;
  variantName?: string | null;
}
export interface FeeOrderInput {
  id: string;
  status: string;
  paymentStatus: string;
  items: FeeOrderItemInput[];
}
export interface BuildOrderFeeOpts {
  viewpoint: "SELLER" | "SUPPLIER" | "ADMIN";
  orders: FeeOrderInput[];
  contextSellerId?: string; // SELLER 관점: 직접등록 판정 기준 셀러
  supplierBrandId?: string; // SUPPLIER 관점: 브랜드 공급자
  supplierMiddleId?: string; // SUPPLIER 관점: 중간관리자 공급자
}

// ───── 포맷 헬퍼 ─────
const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const pct = (n: number) => `${Number.isInteger(n) ? n : Number(n.toFixed(2))}%`;
const roundW = (n: number) => Math.round(n);
const feeRateLabel = (rate: number) => `${pct(rate)} (부가세 포함 ${pct(withVatRate(rate))})`;

const TYPE_LABEL: Record<ItemType, string> = {
  direct: "직접등록",
  supply: "공급가 기반",
  commission: "수수료 기반",
};

// ───── 상품 정보 ─────
interface ProdInfo {
  sellerId: string | null;
  brandId: string | null;
  middleAdminId: string | null;
  priceModel: string;
  supplyPrice: number | null;
  commissionRate: number | null;
}

type ItemType = "direct" | "supply" | "commission";

interface ItemEcon {
  type: ItemType;
  sale: number;
  supply: number; // 공급가 합계 (supply)
  sellerMargin: number; // supply
  commissionRate: number | null; // commission
  sellerPortion: number; // commission
  sellerSettle: number;
  sellerFeeAmount: number;
  sellerFeeRate: number;
  supplierBase: number; // 공급자 정산 기준액
  supplierSettle: number;
  supplierFeeAmount: number;
  supplierFeeRate: number;
  platformRevenue: number; // 판매가 - 셀러정산 - 공급자정산
}

// 상품 유형 판정 — sellerId 가 있으면(그리고 관점 셀러 소유면) 직접등록
function classify(info: ProdInfo, contextSellerId?: string): ItemType {
  if (info.sellerId && (!contextSellerId || info.sellerId === contextSellerId)) return "direct";
  if (info.priceModel === "COMMISSION" && info.commissionRate != null) return "commission";
  return "supply";
}

function computeEcon(
  item: FeeOrderItemInput,
  info: ProdInfo,
  fees: PlatformFees,
  contextSellerId?: string,
): ItemEcon {
  const sale = Number(item.totalPrice);
  const sellerFeeRate = fees.sellerFeeRate;
  const sellerMul = 1 - (sellerFeeRate * 1.1) / 100;
  const supplierFeeRate = info.middleAdminId ? fees.middleAdminFeeRate : fees.brandFeeRate;
  const supplierMul = 1 - (supplierFeeRate * 1.1) / 100;
  const type = classify(info, contextSellerId);

  let supply = 0;
  let sellerMargin = 0;
  let sellerPortion = 0;
  let commissionRate: number | null = null;
  let sellerBase = 0;
  let supplierBase = 0;

  if (type === "direct") {
    sellerBase = sale;
  } else if (type === "commission") {
    commissionRate = info.commissionRate!;
    sellerPortion = roundW(sale * (commissionRate / 100));
    sellerBase = sellerPortion;
    supplierBase = sale - sellerPortion;
  } else {
    supply = (info.supplyPrice ?? 0) * item.quantity;
    sellerMargin = Math.max(0, sale - supply);
    sellerBase = sellerMargin;
    supplierBase = supply;
  }

  const sellerSettle = roundW(sellerBase * sellerMul);
  const sellerFeeAmount = sellerBase - sellerSettle;
  const supplierSettle = roundW(supplierBase * supplierMul);
  const supplierFeeAmount = supplierBase - supplierSettle;
  const platformRevenue = sellerFeeAmount + supplierFeeAmount;

  return {
    type,
    sale,
    supply,
    sellerMargin,
    commissionRate,
    sellerPortion,
    sellerSettle,
    sellerFeeAmount,
    sellerFeeRate,
    supplierBase,
    supplierSettle,
    supplierFeeAmount,
    supplierFeeRate,
    platformRevenue,
  };
}

// ───── 정산 상태 표시 ─────
function statusOf(order: FeeOrderInput): { label: string; tone: FeeStatusTone } {
  const excluded = ["CANCELLED", "REFUNDED", "REFUND_REQUESTED"].includes(order.status);
  const settleable = order.paymentStatus === "COMPLETED" && !excluded;
  if (!settleable) {
    if (excluded) return { label: "정산 대상 아님 (취소·환불)", tone: "excluded" };
    return { label: "결제 완료 후 정산 대상", tone: "pending" };
  }
  if (order.status === "CONFIRMED") return { label: "정산 예정 (구매확정 완료)", tone: "scheduled" };
  return { label: "구매확정 후 정산 확정", tone: "pending" };
}

// SUPPLIER 관점에서 이 상품이 본인 공급 상품인지 판정
function supplierIncludes(info: ProdInfo, opts: BuildOrderFeeOpts): boolean {
  if (opts.viewpoint !== "SUPPLIER") return true;
  if (opts.supplierMiddleId) return info.middleAdminId === opts.supplierMiddleId;
  if (opts.supplierBrandId) return info.brandId === opts.supplierBrandId && info.middleAdminId == null;
  return false;
}

function buildOne(
  o: FeeOrderInput,
  pmap: Map<string, ProdInfo>,
  fees: PlatformFees,
  opts: BuildOrderFeeOpts,
): OrderFeeInfo | null {
  const st = statusOf(o);
  const cards: OrderFeeItemCard[] = [];
  let sumSellerSettle = 0;
  let sumSupplierSettle = 0;
  let sumPlatform = 0;
  let supplierCount = 0;

  for (const item of o.items) {
    const pi = pmap.get(item.productId);
    if (!pi) continue;
    if (!supplierIncludes(pi, opts)) continue;
    const e = computeEcon(item, pi, fees, opts.contextSellerId);

    const lines: OrderFeeLine[] = [{ label: "판매가", value: won(e.sale) }];

    if (opts.viewpoint === "SELLER") {
      if (e.type === "supply") {
        lines.push({ label: "공급가", value: won(e.supply) });
        lines.push({ label: "셀러 마진 (판매가 − 공급가)", value: won(e.sellerMargin) });
      } else if (e.type === "commission") {
        lines.push({ label: "커미션율", value: pct(e.commissionRate!) });
        lines.push({ label: "셀러 몫 (판매가 × 커미션율)", value: won(e.sellerPortion) });
      }
      lines.push({ label: "플랫폼 수수료율", value: feeRateLabel(e.sellerFeeRate) });
      lines.push({ label: "플랫폼 수수료", value: `-${won(e.sellerFeeAmount)}`, tone: "fee" });
      lines.push({ label: "셀러 정산 예정액", value: won(e.sellerSettle), tone: "settle", strong: true });
    } else if (opts.viewpoint === "SUPPLIER") {
      if (e.type === "commission") {
        lines.push({ label: "커미션율 (셀러 몫)", value: pct(e.commissionRate!) });
        lines.push({ label: "공급자 정산 기준액", value: won(e.supplierBase) });
      } else {
        lines.push({ label: "공급가", value: won(e.supplierBase) });
      }
      lines.push({ label: "공급자 플랫폼 수수료율", value: feeRateLabel(e.supplierFeeRate) });
      lines.push({ label: "공급자 플랫폼 수수료", value: `-${won(e.supplierFeeAmount)}`, tone: "fee" });
      lines.push({ label: "공급자 정산 예정액", value: won(e.supplierSettle), tone: "settle", strong: true });
    } else {
      // ADMIN
      lines.push({ label: "셀러 정산액", value: won(e.sellerSettle) });
      if (e.supplierBase > 0) lines.push({ label: "공급자 정산액", value: won(e.supplierSettle) });
      lines.push({ label: "플랫폼 수익", value: won(e.platformRevenue), tone: "settle", strong: true });
    }

    cards.push({
      title: item.productName,
      option: item.variantName ?? null,
      typeLabel: TYPE_LABEL[e.type],
      lines,
    });

    sumSellerSettle += e.sellerSettle;
    sumSupplierSettle += e.supplierSettle;
    sumPlatform += e.platformRevenue;
    if (e.supplierBase > 0) supplierCount++;
  }

  if (cards.length === 0) return null;

  let viewpointLabel: string;
  let summary: OrderFeeLine[];
  if (opts.viewpoint === "SELLER") {
    viewpointLabel = "셀러 정산 기준 · 플랫폼 수수료(부가세 포함) 차감";
    summary = [
      { label: "셀러 정산 예정액 합계", value: won(sumSellerSettle), tone: "settle", strong: true },
    ];
  } else if (opts.viewpoint === "SUPPLIER") {
    viewpointLabel = opts.supplierMiddleId
      ? "중간관리자 공급 정산 기준 · 공급가 기준"
      : "브랜드 공급 정산 기준 · 공급가 기준";
    summary = [
      { label: "공급자 정산 예정액 합계", value: won(sumSupplierSettle), tone: "settle", strong: true },
    ];
  } else {
    viewpointLabel = "전체 수익 구조 · 셀러 / 공급자 / 플랫폼";
    summary = [
      { label: "셀러 정산액 합계", value: won(sumSellerSettle) },
      ...(supplierCount > 0
        ? [{ label: "공급자 정산액 합계", value: won(sumSupplierSettle) } as OrderFeeLine]
        : []),
      { label: "플랫폼 수익 합계", value: won(sumPlatform), tone: "settle", strong: true },
    ];
  }

  return {
    viewpointLabel,
    items: cards,
    summary,
    statusLabel: st.label,
    statusTone: st.tone,
  };
}

// 주문 목록 → 주문별 수수료 안내 map. 관점에 해당 상품이 없으면 해당 주문은 제외된다.
export async function buildOrderFeeInfoMap(
  opts: BuildOrderFeeOpts,
): Promise<Record<string, OrderFeeInfo>> {
  const { orders } = opts;
  if (!orders.length) return {};

  const fees = await getPlatformFees();
  const ids = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId)))];
  const prods = ids.length
    ? await prisma.product.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          sellerId: true,
          brandId: true,
          middleAdminId: true,
          priceModel: true,
          supplyPrice: true,
          commissionRate: true,
        },
      })
    : [];

  const pmap = new Map<string, ProdInfo>();
  for (const p of prods) {
    pmap.set(p.id, {
      sellerId: p.sellerId,
      brandId: p.brandId,
      middleAdminId: p.middleAdminId,
      priceModel: String(p.priceModel),
      supplyPrice: p.supplyPrice != null ? Number(p.supplyPrice) : null,
      commissionRate: p.commissionRate != null ? Number(p.commissionRate) : null,
    });
  }

  const out: Record<string, OrderFeeInfo> = {};
  for (const o of orders) {
    const info = buildOne(o, pmap, fees, opts);
    if (info) out[o.id] = info;
  }
  return out;
}
