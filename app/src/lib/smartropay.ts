import crypto from "crypto";

// 스마트로(Smartro) SSPay 연동.
// - 인증 결제(인증용 MID): 결제창 → ReturnUrl 콜백(Tid+TrAuthKey) → urlCallApproval.do 로 승인 호출.
// - EncryptData: SHA256(EdiDate + Mid + Amt + MerchantKey) → Base64.
// - PG 가이드 URL: https://manual.smartropay.co.kr/sspayModule.do

const MID = process.env.SMARTROPAY_MID || "";
const MERCHANT_KEY = process.env.SMARTROPAY_MERCHANT_KEY || "";
const IS_PRODUCTION = process.env.SMARTROPAY_IS_PRODUCTION === "true";
// SspMallId 는 MID 와 별도의 "간편결제 가맹점 ID" (10자 이내, 영업/기술팀 발급).
// 미설정 시 form 에서 필드 자체를 생략 (CARD 결제는 SspMallId 없이도 동작하는 경우가 있음).
const SSP_MALL_ID = process.env.SMARTROPAY_SSP_MALL_ID || "";

// PC 엔드포인트 사용 — 모바일 엔드포인트(tmpay/mpay)는 모바일 UA 가 아닐 경우
// "지원하지 않는 브라우저" 응답을 내므로, 데스크탑/모바일 모두 호환되는 PC 엔드포인트를 기본으로 한다.
const TEST_BASE = "https://tpay.smartropay.co.kr";
const PROD_BASE = "https://pay.smartropay.co.kr";
const TEST_APPROVAL = "https://tapproval.smartropay.co.kr/payment/approval/urlCallApproval.do";
const PROD_APPROVAL = "https://approval.smartropay.co.kr/payment/approval/urlCallApproval.do";

export const smartropayConfig = {
  mid: MID,
  merchantKey: MERCHANT_KEY,
  sspMallId: SSP_MALL_ID,
  isProduction: IS_PRODUCTION,
  payBase: IS_PRODUCTION ? PROD_BASE : TEST_BASE,
  // SmartroPAY JS 라이브러리 (환경별 도메인). 인증결제는 smartropay.init({mode}) + payment({FormId})
  // 만으로 동작하며, actionUri 는 넘기지 않는다(넘기면 SS-Pay 간편결제 경로로 동작해 SspMallId 를 요구함).
  jsUrl: `${IS_PRODUCTION ? PROD_BASE : TEST_BASE}/asset/js/SmartroPAY-1.0.min.js`,
  // 가이드 기준 운영 mode 값은 "REAL" (테스트 "STG"). 이전 "PROD" 는 오류였음.
  mode: IS_PRODUCTION ? "REAL" : "STG",
  approvalUrl: IS_PRODUCTION ? PROD_APPROVAL : TEST_APPROVAL,
};

export function ensureSmartropayConfigured() {
  if (!MID || !MERCHANT_KEY) {
    throw new Error(
      "Smartro 환경변수가 설정되지 않았습니다. (SMARTROPAY_MID, SMARTROPAY_MERCHANT_KEY)",
    );
  }
}

export function getEdiDate(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    date.getFullYear().toString() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

// EncryptData 생성: SHA256(EdiDate + Mid + Amt + MerchantKey) → Base64
export function buildEncryptData(ediDate: string, amt: number | string): string {
  const input = `${ediDate}${MID}${amt}${MERCHANT_KEY}`;
  return crypto.createHash("sha256").update(input, "utf8").digest("base64");
}

export interface SmartropayApprovalRequest {
  Tid: string;
  TrAuthKey: string;
}

export interface SmartropayApprovalResponse {
  ResultCode: string;
  ResultMsg: string;
  PayMethod?: string;
  Mid?: string;
  Tid?: string;
  Moid?: string;
  Amt?: string;
  GoodsName?: string;
  AuthCode?: string;
  AuthDate?: string;
  BuyerName?: string;
  MallUserId?: string;
  MallReserved?: string;
  CardType?: string;
  CardOwnerType?: string;
  AppCardCode?: string;
  AppCardName?: string;
  AcquCardCode?: string;
  AcquCardName?: string;
  CardNum?: string;
  CardQuota?: string;
  CardInterest?: string;
  SignValue?: string;
  [k: string]: unknown;
}

// 스마트로 성공 코드 판정.
// - 카드 인증결제: "0000"
// - 간편결제: 결제수단별 "<PG 2글자>00" 형태 (예: 카카오페이 KP00, 네이버페이 NP00,
//   페이코 PO00, 토스 TP00 등). 실패는 끝 2자리가 00 이 아님(KP12 등) 또는 숫자코드(1614 등).
// 금액 교차검증이 별도 방어선으로 있으므로 패턴 매칭으로 누락을 방지한다.
export function isSmartropaySuccess(resultCode: string | undefined | null): boolean {
  const code = String(resultCode || "");
  return code === "0000" || /^[A-Z]{2}00$/.test(code);
}

// 승인 API 호출 — JSON POST.
export async function requestSmartropayApproval(
  payload: SmartropayApprovalRequest,
): Promise<SmartropayApprovalResponse> {
  const res = await fetch(smartropayConfig.approvalUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Smartro 승인 요청 HTTP 오류: ${res.status}`);
  }
  return (await res.json()) as SmartropayApprovalResponse;
}

// 결제창 호출에 사용할 PayMethod 화이트리스트.
// 가이드 기준: CARD, BANK, VBANK, CELLPHONE, NAVER, KAKAO, PAYCO, LPAY, PINPAY,
// SAMSUNGPAY, TOSS, LINEPAY, TMONEYPAY, APPLEPAY
export const SMARTROPAY_METHODS = [
  "CARD", "BANK", "VBANK", "CELLPHONE",
  "NAVER", "KAKAO", "PAYCO", "LPAY", "PINPAY",
  "SAMSUNGPAY", "TOSS", "LINEPAY", "TMONEYPAY", "APPLEPAY",
] as const;
export type SmartropayMethod = (typeof SMARTROPAY_METHODS)[number];

export function normalizeMethod(input: string | undefined | null): SmartropayMethod {
  const upper = String(input || "").toUpperCase() as SmartropayMethod;
  return SMARTROPAY_METHODS.includes(upper) ? upper : "CARD";
}
