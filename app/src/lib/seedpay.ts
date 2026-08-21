import crypto from "crypto";

const MID = process.env.SEEDPAY_MID || "";
const GID = process.env.SEEDPAY_GID || "";
const MERCHANT_KEY = process.env.SEEDPAY_MERCHANT_KEY || "";
const IS_PRODUCTION = process.env.SEEDPAY_IS_PRODUCTION === "true";

const PROD_BASE = "https://pay.seedpayments.co.kr";
const DEV_BASE = "https://devpay.seedpayments.co.kr";

export const seedpayConfig = {
  mid: MID,
  gid: GID,
  merchantKey: MERCHANT_KEY,
  isProduction: IS_PRODUCTION,
  baseUrl: IS_PRODUCTION ? PROD_BASE : DEV_BASE,
  // SeedPay 공식 샘플: PG JS는 운영/테스트 무관 항상 운영 서버 URL 사용
  pgJsUrl: `${PROD_BASE}/js/pgAsistant.js`,
};

export function ensureSeedpayConfigured() {
  if (!MID || !MERCHANT_KEY) {
    throw new Error("SeedPay 환경변수가 설정되지 않았습니다. (SEEDPAY_MID, SEEDPAY_MERCHANT_KEY)");
  }
}

export function sha256(...args: (string | number)[]) {
  return crypto.createHash("sha256").update(args.map(String).join(""), "utf8").digest("hex");
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

// 결제창 요청용 해시: SHA256(mid + ediDate + goodsAmt + merchantKey)
export function buildPayRequestHash(ediDate: string, goodsAmt: number | string) {
  return sha256(seedpayConfig.mid, ediDate, goodsAmt, seedpayConfig.merchantKey);
}

// 인증 결과 signData 검증용: SHA256(tid + mid + ediDate + goodsAmt + ordNo + merchantKey)
export function buildSignVerifyHash(
  tid: string,
  mid: string,
  ediDate: string,
  goodsAmt: string,
  ordNo: string,
) {
  return sha256(tid, mid, ediDate, goodsAmt, ordNo, seedpayConfig.merchantKey);
}

// 취소 요청용 해시: SHA256(mid + ediDate + tid + merchantKey)
export function buildCancelHash(mid: string, ediDate: string, tid: string) {
  return sha256(mid, ediDate, tid, seedpayConfig.merchantKey);
}

export interface SeedpayApprovalResult {
  resultCd: string;
  resultMsg: string;
  tid?: string;
  ordNo?: string;
  goodsAmt?: string;
  goodsNm?: string;
  appNo?: string;
  fnNm?: string;
  cardNo?: string;
  quotaMon?: string;
  trDt?: string;
  trTm?: string;
  [k: string]: any;
}

export async function requestApproval(
  approvalUrl: string,
  params: Record<string, string>,
): Promise<SeedpayApprovalResult> {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(approvalUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`승인 요청 HTTP 오류: ${res.status}`);
  }
  return (await res.json()) as SeedpayApprovalResult;
}

export async function requestNetCancel(netCancelUrl: string, tid: string, mid: string) {
  try {
    const body = new URLSearchParams({ tid, mid }).toString();
    await fetch(netCancelUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    // 망취소 실패는 무시 (수기처리 대상)
  }
}

export interface SeedpayCancelResult {
  resultCd: string;
  resultMsg: string;
  tid?: string;
  otid?: string;
  ordNo?: string;
  ccAmt?: string;
  trxStCd?: string;
  partCanFlg?: string;
  trDt?: string;
  trTm?: string;
  appNo?: string;
  [k: string]: any;
}

export async function requestCancel(input: {
  tid: string;
  ccAmt: number | string;
  ccMsg: string;
  partCanFlg?: "0" | "1";
}): Promise<SeedpayCancelResult> {
  ensureSeedpayConfigured();
  const ediDate = getEdiDate();
  const mid = seedpayConfig.mid;
  const hashString = buildCancelHash(mid, ediDate, input.tid);

  const body = new URLSearchParams({
    tid: input.tid,
    mid,
    ccAmt: String(input.ccAmt),
    ccMsg: input.ccMsg,
    partCanFlg: input.partCanFlg ?? "0",
    ediDate,
    hashString,
  }).toString();

  const res = await fetch(`${seedpayConfig.baseUrl}/payment/v1/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`취소 요청 HTTP 오류: ${res.status}`);
  const data: SeedpayCancelResult = await res.json();
  return data;
}
