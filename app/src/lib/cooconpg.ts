// 쿠콘(COOCON) 입금이체PG API 클라이언트
// 근거 문서: 개발가이드_입금이체 PG_2.0.3 (2024.07.22)
// - 예금주명 조회: 6110 / 입금이체: 6120 / 처리결과 조회: 6170 / 잔액조회: 6140
// - HTTPS POST, Content-Type: application/json
import { getSettingsMap } from "@/lib/settings";

export const COOCON_DEV_URL = "https://dev2.coocon.co.kr:8443/sol/gateway/vapg_wapi.jsp";
export const COOCON_PROD_URL = "https://apigw.coocon.co.kr/sol/gateway/vapg_wapi.jsp";

// Setting 테이블 키 (관리자 화면에서 저장)
export const COOCON_SECR_KEY = "cooconpg.secrKey"; // API 인증키
export const COOCON_TRT_INST_CD_KEY = "cooconpg.trtInstCd"; // 취급기관코드(8)
export const COOCON_BANK_CD_KEY = "cooconpg.bankCd"; // 연계은행코드(3)
export const COOCON_WDRW_ACCT_NO_KEY = "cooconpg.wdrwAcctNo"; // 출금계좌번호
export const COOCON_IS_PRODUCTION_KEY = "cooconpg.isProduction"; // "true" | "false"

export interface CooconConfig {
  secrKey: string;
  trtInstCd: string;
  bankCd: string;
  wdrwAcctNo: string;
  isProduction: boolean;
  gatewayUrl: string;
}

// DB 설정 우선, 없으면 환경변수 폴백
export async function getCooconConfig(): Promise<CooconConfig> {
  const map = await getSettingsMap();
  const secrKey = map[COOCON_SECR_KEY] ?? process.env.COOCON_SECR_KEY ?? "";
  const trtInstCd = map[COOCON_TRT_INST_CD_KEY] ?? process.env.COOCON_TRT_INST_CD ?? "";
  const bankCd = map[COOCON_BANK_CD_KEY] ?? process.env.COOCON_BANK_CD ?? "";
  const wdrwAcctNo = map[COOCON_WDRW_ACCT_NO_KEY] ?? process.env.COOCON_WDRW_ACCT_NO ?? "";
  const isProduction =
    (map[COOCON_IS_PRODUCTION_KEY] ?? process.env.COOCON_IS_PRODUCTION) === "true";
  return {
    secrKey,
    trtInstCd,
    bankCd,
    wdrwAcctNo,
    isProduction,
    gatewayUrl: isProduction ? COOCON_PROD_URL : COOCON_DEV_URL,
  };
}

export function ensureCooconConfigured(cfg: CooconConfig) {
  const missing: string[] = [];
  if (!cfg.secrKey) missing.push("API 인증키");
  if (!cfg.trtInstCd) missing.push("취급기관코드");
  if (!cfg.bankCd) missing.push("연계은행코드");
  if (missing.length > 0) {
    throw new Error(`입금이체PG 설정이 없습니다: ${missing.join(", ")}`);
  }
}

export interface CooconResponse {
  RESP_CD: string; // 0000: 정상 / Pxxx: 요청오류 / xxx: 은행오류 / 9xxx: API오류
  RESP_MSG: string;
  TRSC_SEQ_NO?: string;
  RCV_ACCT_NM?: string;
  BAL_AMT?: string;
  RCV_ACCT_NO?: string;
  RCV_BNK_CD?: string;
  TRSC_AMT?: string;
  WDRW_ACCT_NM?: string;
  WDRW_BNK_CD?: string;
  WDRW_ACCT_NO?: string;
  WDRW_CAN_AMT?: string;
  WDRW_CANNOT_AMT?: string;
  RCV_TRSC_DT?: string;
  RCV_TRSC_TM?: string;
  STS?: string; // 6170: 1 정상 / 3 오류 / 6 처리중
  [k: string]: string | undefined;
}

// 타임아웃 또는 001/9980 응답: 처리결과를 알 수 없음 → 반드시 6170 결과조회 필요 (가이드 4.3)
export const COOCON_UNKNOWN_RESP_CODES = ["001", "9980"];

export function isUnknownResult(respCd: string | undefined): boolean {
  return !respCd || COOCON_UNKNOWN_RESP_CODES.includes(respCd);
}

const TIMEOUT_MS = 30_000;

export class CooconTimeoutError extends Error {
  constructor() {
    super("입금이체PG 응답 시간 초과 — 처리결과를 알 수 없습니다. 결과조회(6170)로 확인하세요.");
    this.name = "CooconTimeoutError";
  }
}

async function callCoocon(
  cfg: CooconConfig,
  payload: Record<string, string>,
): Promise<CooconResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(cfg.gatewayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`입금이체PG HTTP 오류: ${res.status}`);
    const text = (await res.text()).trim();
    return JSON.parse(text) as CooconResponse;
  } catch (e: any) {
    if (e?.name === "AbortError") throw new CooconTimeoutError();
    // 연결 실패: 쿠콘은 등록된 IP만 방화벽에서 허용 — 미등록 IP는 연결 자체가 차단됨
    const causeCode = e?.cause?.code ?? e?.code;
    if (
      causeCode === "UND_ERR_CONNECT_TIMEOUT" ||
      causeCode === "ECONNREFUSED" ||
      causeCode === "ETIMEDOUT" ||
      causeCode === "ENOTFOUND"
    ) {
      throw new Error(
        `쿠콘 API 서버에 연결할 수 없습니다 (${causeCode}). ` +
          "쿠콘은 사전 등록된 서버 IP에서의 요청만 허용하므로, 현재 서버의 공인 IP가 쿠콘에 등록되어 있는지 확인해 주세요.",
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// 거래일련번호: 거래일별 고유 12자리 (HHMMSS + 난수 6자리)
export function genTrscSeqNo(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
  const rand = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  return time + rand;
}

export function todayYYYYMMDD(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}

// 4.2 예금주명 조회 (6110) — TRSC_AMT는 1원 이상 필수
export async function inquireAccountHolder(
  cfg: CooconConfig,
  input: { rcvBnkCd: string; rcvAcctNo: string; amount: number },
): Promise<CooconResponse> {
  return callCoocon(cfg, {
    SECR_KEY: cfg.secrKey,
    KEY: "6110",
    TRT_INST_CD: cfg.trtInstCd,
    BANK_CD: cfg.bankCd,
    TRSC_SEQ_NO: genTrscSeqNo(),
    RCV_BNK_CD: input.rcvBnkCd,
    RCV_ACCT_NO: input.rcvAcctNo,
    TRSC_AMT: String(input.amount),
  });
}

// 4.3 입금이체 (6120)
export async function requestDepositTransfer(
  cfg: CooconConfig,
  input: {
    trscSeqNo: string;
    rcvBnkCd: string;
    rcvAcctNo: string;
    amount: number;
    wdrwAcctNm?: string; // 의뢰인명 (미설정 시 기관 기본 적요 인자)
  },
): Promise<CooconResponse> {
  const payload: Record<string, string> = {
    SECR_KEY: cfg.secrKey,
    KEY: "6120",
    TRT_INST_CD: cfg.trtInstCd,
    BANK_CD: cfg.bankCd,
    TRSC_SEQ_NO: input.trscSeqNo,
    RCV_BNK_CD: input.rcvBnkCd,
    RCV_ACCT_NO: input.rcvAcctNo,
    WDRW_ACCT_NO: cfg.wdrwAcctNo,
    TRSC_AMT: String(input.amount),
  };
  if (input.wdrwAcctNm) payload.WDRW_ACCT_NM = input.wdrwAcctNm;
  return callCoocon(cfg, payload);
}

// 4.4 입금이체 처리결과 조회 (6170)
export async function inquireTransferResult(
  cfg: CooconConfig,
  input: { rqreTmsgNo: string; reqTrscDt: string },
): Promise<CooconResponse> {
  return callCoocon(cfg, {
    SECR_KEY: cfg.secrKey,
    KEY: "6170",
    TRT_INST_CD: cfg.trtInstCd,
    BANK_CD: cfg.bankCd,
    TRSC_SEQ_NO: genTrscSeqNo(),
    RQRE_TMSG_NO: input.rqreTmsgNo,
    REQ_TRSC_DT: input.reqTrscDt,
  });
}

// 4.5 잔액조회 (6140)
export async function inquireBalance(cfg: CooconConfig): Promise<CooconResponse> {
  return callCoocon(cfg, {
    SECR_KEY: cfg.secrKey,
    KEY: "6140",
    TRT_INST_CD: cfg.trtInstCd,
    BANK_CD: cfg.bankCd,
    TRSC_SEQ_NO: genTrscSeqNo(),
  });
}

// [참조1] 금융기관 코드 — 클라이언트 공용 모듈 재노출
export { BANK_CODES, bankName } from "@/lib/bankCodes";
