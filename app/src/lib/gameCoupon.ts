// 게임 쿠폰 입력값 정규화·검증 (서버 라우트 공용)

export interface NormalizedCoupon {
  code: string | null;
  discountType: string; // "PERCENT" | "AMOUNT" | "PURCHASE"
  discountValue: number; // PERCENT: 할인율, AMOUNT: 할인액, PURCHASE: 구매 고정가
  minOrderAmount: number;
  maxIssueCount: number | null;
  validDays: number;
  productId?: string | null; // PURCHASE 타입 전용
}

export function normalizeCoupon(
  body: any,
): { data: NormalizedCoupon } | { error: string } {
  const rawType = body.discountType;
  const discountType = rawType === "AMOUNT" ? "AMOUNT" : rawType === "PURCHASE" ? "PURCHASE" : "PERCENT";

  const discountValue = Math.floor(Number(body.discountValue));
  if (!Number.isFinite(discountValue) || discountValue <= 0) return { error: "할인 값을 올바르게 입력해주세요" };
  if (discountType === "PERCENT" && discountValue > 100) return { error: "정률 할인은 100%를 넘을 수 없습니다" };

  // PURCHASE 타입은 productId 필수
  if (discountType === "PURCHASE") {
    const productId = typeof body.productId === "string" && body.productId.trim()
      ? body.productId.trim()
      : null;
    if (!productId) return { error: "구매권 상품을 선택해주세요" };
    const minOrderAmount = 0; // 구매권은 최소금액 무관
    const validDays = Math.max(1, Math.floor(Number(body.validDays) || 7));
    const maxIssueRaw = body.maxIssueCount;
    const maxIssueCount =
      maxIssueRaw == null || maxIssueRaw === "" || Number(maxIssueRaw) <= 0
        ? null
        : Math.floor(Number(maxIssueRaw));
    const code =
      typeof body.code === "string" && body.code.trim() ? body.code.trim().toUpperCase().slice(0, 30) : null;
    return { data: { code, discountType, discountValue, minOrderAmount, maxIssueCount, validDays, productId } };
  }

  const minOrderAmount = Math.max(0, Math.floor(Number(body.minOrderAmount) || 0));
  const validDays = Math.max(1, Math.floor(Number(body.validDays) || 7));
  const maxIssueRaw = body.maxIssueCount;
  const maxIssueCount =
    maxIssueRaw == null || maxIssueRaw === "" || Number(maxIssueRaw) <= 0
      ? null
      : Math.floor(Number(maxIssueRaw));
  const code =
    typeof body.code === "string" && body.code.trim() ? body.code.trim().toUpperCase().slice(0, 30) : null;
  return { data: { code, discountType, discountValue, minOrderAmount, maxIssueCount, validDays } };
}
