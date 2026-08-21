/**
 * 중간관리자 마진 산정 로직 (단일 출처)
 *
 * 정책은 최고관리자만 설정한다.
 * - 브랜드: 방식(PERCENTAGE | SUPPLY_BASE) + (퍼센트일 때) 기준가(SUPPLY | SALE) + 요율
 * - 셀러: 판매가 기준 퍼센트 요율만
 *
 * 마진 발생 경로는 두 가지이며 서로 독립적이다.
 * 1) 브랜드 마진: 브랜드 상품이 팔릴 때마다 발생 (상품 등록 시 단가 마진을 스냅샷 저장)
 * 2) 셀러 마진: 셀러가 판매할 때 판매가 대비 요율
 */

export type MarginMethod = "PERCENTAGE" | "SUPPLY_BASE";
export type MarginBase = "SUPPLY" | "SALE";

export const MARGIN_METHOD_LABEL: Record<MarginMethod, string> = {
  PERCENTAGE: "퍼센테이지",
  SUPPLY_BASE: "공급가 베이스(직접입력)",
};

export const MARGIN_BASE_LABEL: Record<MarginBase, string> = {
  SUPPLY: "공급가 기준",
  SALE: "판매가 기준",
};

function round(n: number): number {
  return Math.max(0, Math.round(n));
}

/**
 * 브랜드 상품의 "단가 기준" 중간관리자 마진을 산출한다.
 * 상품 등록/수정 시점에 호출하여 Product.middleAdminMargin 에 스냅샷으로 저장한다.
 *
 * @param method      마진 방식 (브랜드 정책)
 * @param base        퍼센트일 때 기준가
 * @param rate        퍼센트 요율(%)
 * @param salePrice   판매가 (basePrice)
 * @param supplyPrice 공급가
 * @param manualMargin SUPPLY_BASE(직접입력) 방식일 때 입력한 마진 단가
 */
export function computeBrandUnitMargin(opts: {
  method: MarginMethod;
  base: MarginBase;
  rate: number;
  salePrice: number;
  supplyPrice: number;
  manualMargin?: number | null;
}): number {
  const { method, base, rate, salePrice, supplyPrice, manualMargin } = opts;

  if (method === "SUPPLY_BASE") {
    // 직접입력: 판매가/공급가/마진을 각각 입력받고, 입력된 마진을 그대로 사용.
    // 값이 없으면 (판매가 - 공급가) 차액으로 보정.
    if (manualMargin != null && !Number.isNaN(manualMargin)) return round(manualMargin);
    return round(salePrice - supplyPrice);
  }

  // PERCENTAGE
  const baseAmount = base === "SALE" ? salePrice : supplyPrice;
  return round((baseAmount * rate) / 100);
}

/**
 * 셀러 채널 마진 (주문 시점, 판매가 대비 퍼센트).
 * @param saleAmount 판매가 × 수량 (해당 셀러 매출)
 * @param rate       셀러 마진율(%)
 */
export function computeSellerMargin(saleAmount: number, rate: number): number {
  if (!rate || rate <= 0) return 0;
  return round((saleAmount * rate) / 100);
}
