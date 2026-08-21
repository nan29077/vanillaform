// ONGI(온기) 간편 계좌결제 연동.
// 결제창 URL은 해시 라우터(/#/qr/{QR}) + ?checkout=pg 형식.
// 결제 완료 후 서버 통지(callback_url)는 JSON POST 로 전달되고,
// HMAC 서명이 없으므로 payment_code 기준 멱등 처리 + 금액 교차 검증을 사용한다.

const MID = process.env.ONGI_MID || "";
const API_KEY = process.env.ONGI_API_KEY || "";
const QR_CODE = process.env.ONGI_QR_CODE || "";
const PAY_URL = (process.env.ONGI_PAY_URL || "https://pay.ongi.site").replace(/\/$/, "");
const API_BASE = (process.env.ONGI_API_BASE || "https://www.ongi.site/api").replace(/\/$/, "");

export const ongiConfig = {
  mid: MID,
  apiKey: API_KEY,
  qrCode: QR_CODE,
  payUrl: PAY_URL,
  apiBase: API_BASE,
};

export function ensureOngiConfigured() {
  if (!QR_CODE) {
    throw new Error("ONGI 환경변수가 설정되지 않았습니다. (ONGI_QR_CODE)");
  }
}

export interface OngiCheckoutParams {
  amount: number;
  name: string;
  phone: string;
  callbackUrl: string;
  returnUrl?: string;
}

// pay.ongi.site 는 해시 라우터를 쓰므로 # 뒤에 path/query 를 붙인다.
// 예: https://pay.ongi.site/#/qr/{QR}?checkout=pg&name=...&phone=...&amount=...
export function buildOngiCheckoutUrl(params: OngiCheckoutParams): string {
  ensureOngiConfigured();
  const phone = params.phone.replace(/[^0-9]/g, "");
  const query = new URLSearchParams({
    checkout: "pg",
    name: params.name,
    phone,
    amount: String(Math.round(params.amount)),
    callback_url: params.callbackUrl,
  });
  if (params.returnUrl) query.set("return_url", params.returnUrl);
  return `${PAY_URL}/#/qr/${encodeURIComponent(QR_CODE)}?${query.toString()}`;
}

// 콜백 본문 — 이메일 가이드의 JSON 예시.
// 결제수단·주문 여부에 따라 일부 필드는 null 일 수 있음.
export interface OngiCallbackPayload {
  event: string;          // "payment.completed"
  payment_code: string;   // "ONGI_…" — 외부 식별자 (멱등 키)
  order_code: string | null;
  organization_pk: number;
  state: string;          // "완료"
  division: string;       // "one_time" 등
  payment_amt: number;
  pay_price: number;
  discnt_price: number;
  payment_method: string; // "계좌결제"
  payment_type: string;   // "일반송금" 등
  auth_no?: string;
  tr_no?: string;
  tr_day?: string;        // "YYYYMMDD"
  tr_time?: string;       // "HHmmss"
  result_cd: string;      // "0" 이 성공
  result_msg?: string;
  member_name?: string;
  phone?: string;
  [k: string]: unknown;
}

export function isOngiCallbackSuccess(payload: OngiCallbackPayload): boolean {
  return (
    payload.event === "payment.completed" &&
    payload.state === "완료" &&
    payload.result_cd === "0"
  );
}
