// 셀러 출금 수수료/원천징수 계산 유틸 (서버·클라이언트 공용, prisma 미사용)

// 원천징수율 3.3% (소득세 3% + 지방소득세 0.3%) — 비사업자 셀러만 적용
export const WITHHOLDING_TAX_RATE = 0.033;

export interface PayoutBreakdown {
  commissionAmount: number; // 수수료 차감액
  withholdingTaxAmount: number; // 원천징수액 (비사업자만, 사업자는 0)
  actualPayoutAmount: number; // 실제 입금액
}

// 출금 수수료/원천징수/실입금액 계산
// - 수수료 차감액 = 출금신청금액 × 수수료율(%) / 100
// - 원천징수액 = (출금신청금액 - 수수료차감액) × 0.033 (비사업자만)
// - 실제 입금액 = 출금신청금액 - 수수료차감액 - 원천징수액
export function calcPayoutBreakdown(
  amount: number,
  feeRate: number,
  isBusinessOperator: boolean,
): PayoutBreakdown {
  const commissionAmount = Math.round(amount * (feeRate / 100));
  const withholdingTaxAmount = isBusinessOperator
    ? 0
    : Math.round((amount - commissionAmount) * WITHHOLDING_TAX_RATE);
  const actualPayoutAmount = amount - commissionAmount - withholdingTaxAmount;
  return { commissionAmount, withholdingTaxAmount, actualPayoutAmount };
}
