// 세무 관리 공용 계산 유틸 (서버·클라이언트 공용, prisma 미사용)
// - 비사업자: 지급총액 기준 3.3% 원천징수 (소득세 3% + 지방소득세 0.3%)
// - 사업자/브랜드/중간관리자: 지급액(부가세 포함) 기준 공급가액/부가세액 분해

// ─────────────────────────────────────────────
// 원천징수 (비사업자) — 지급총액 기준
//   소득세     = 지급총액 × 3%   (원단위 절사)
//   지방소득세 = 소득세 × 10%    (= 지급총액 × 0.3%, 원단위 절사)
//   원천징수합 = 소득세 + 지방소득세
//   실지급액   = 지급총액 - 원천징수합
// 예) 지급총액 10,000원 → 소득세 300 + 지방소득세 30 = 원천징수 330, 실지급 9,670
// ─────────────────────────────────────────────
export interface WithholdingBreakdown {
  gross: number; // 지급총액(출금액)
  incomeTax: number; // 소득세 (3%)
  localTax: number; // 지방소득세 (0.3%)
  totalTax: number; // 원천징수 합계 (3.3%)
  net: number; // 실지급액
}

export function calcWithholding(gross: number): WithholdingBreakdown {
  const g = Math.round(gross);
  const incomeTax = Math.floor(g * 0.03); // 소득세 3%
  const localTax = Math.floor(incomeTax * 0.1); // 지방소득세 = 소득세의 10%
  const totalTax = incomeTax + localTax;
  return { gross: g, incomeTax, localTax, totalTax, net: g - totalTax };
}

// ─────────────────────────────────────────────
// 부가가치세 (사업자/브랜드/중간관리자) — 지급액이 부가세 포함 금액
//   공급가액 = 지급액 ÷ 1.1   (반올림)
//   부가세액 = 지급액 - 공급가액
// 예) 지급액 10,000원 → 공급가액 9,091 + 부가세 909
// ─────────────────────────────────────────────
export interface VatBreakdown {
  total: number; // 합계금액 (부가세 포함, 출금액)
  supply: number; // 공급가액
  vat: number; // 부가세액
}

export function calcVat(total: number): VatBreakdown {
  const t = Math.round(total);
  const supply = Math.round(t / 1.1); // 공급가액
  return { total: t, supply, vat: t - supply };
}
