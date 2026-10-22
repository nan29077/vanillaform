// 충전 결제(목업) — 클라이언트/서버 공용 상수·타입.
// 이 파일은 클라이언트 번들에도 포함되므로 prisma·crypto 등 서버 전용 모듈을 import 하지 않는다.

/** 충전 결제창 머리글에 표시할 판매처(테스트 셀러 "바닐라폼 지점")의 slug — prisma/branchSeller.ts 와 일치 */
export const BRANCH_SELLER_SLUG = "vanillaform-branch";
/** 지점 셀러를 찾지 못했을 때 머리글에 쓸 이름 */
export const DEFAULT_MERCHANT_NAME = "바닐라폼";

/** 금액 버튼 (누를 때마다 합산) */
export const CHARGE_AMOUNT_STEPS = [50_000, 100_000, 300_000, 500_000] as const;
/** 1회 충전 한도 */
export const CHARGE_MIN_AMOUNT = 10_000;
export const CHARGE_MAX_AMOUNT = 5_000_000;
/** 회원 1명이 동시에 가질 수 있는 대기 중 요청 수 */
export const MAX_PENDING_CHARGES = 5;
/** 가상계좌 입금기한 (시간) */
export const VBANK_DUE_HOURS = 72;

export const VOUCHER_TYPES = [
  { key: "LOTTE", label: "롯데상품권" },
  { key: "EMART", label: "이마트상품권" },
  { key: "OTHER", label: "기타 제휴 상품권" },
] as const;
export type VoucherTypeKey = (typeof VOUCHER_TYPES)[number]["key"];

export function voucherTypeLabel(key?: string | null): string {
  return VOUCHER_TYPES.find((v) => v.key === key)?.label ?? "상품권";
}

/** 상품권 PIN 허용 길이 (하이픈·공백 제외 영숫자) */
export const VOUCHER_PIN_MIN_LENGTH = 10;
export const VOUCHER_PIN_MAX_LENGTH = 24;

export type WalletChargeMethodKey = "VIRTUAL_ACCOUNT" | "VOUCHER_PURCHASE" | "VOUCHER_PIN";
export type WalletChargeStatusKey = "PENDING" | "COMPLETED" | "CANCELLED" | "REJECTED" | "EXPIRED";

export const CHARGE_METHOD_LABEL: Record<WalletChargeMethodKey, string> = {
  VIRTUAL_ACCOUNT: "가상계좌",
  VOUCHER_PURCHASE: "상품권 구매",
  VOUCHER_PIN: "상품권 사용",
};

export const CHARGE_STATUS_LABEL: Record<WalletChargeStatusKey, string> = {
  PENDING: "대기",
  COMPLETED: "충전 완료",
  CANCELLED: "취소",
  REJECTED: "반려",
  EXPIRED: "기한 만료",
};

/** 회원 화면에서 대기 상태를 방식별로 풀어 쓴 문구 */
export function pendingLabel(method: WalletChargeMethodKey): string {
  if (method === "VIRTUAL_ACCOUNT") return "입금 대기";
  if (method === "VOUCHER_PURCHASE") return "결제 확인 중";
  return "검증 중";
}

/** API 가 내려주는 충전 내역 한 건 */
export interface WalletChargeDTO {
  id: string;
  method: WalletChargeMethodKey;
  status: WalletChargeStatusKey;
  amount: number;
  merchantName: string | null;
  vbankName: string | null;
  vbankAccount: string | null;
  vbankHolder: string | null;
  vbankDueAt: string | null;
  depositorName: string | null;
  voucherType: string | null;
  voucherPinMasked: string | null;
  adminMemo: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface WalletSummaryDTO {
  balance: number;
  charges: WalletChargeDTO[];
}
