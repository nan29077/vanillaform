// 알리고(Aligo) 카카오 알림톡 발송 유틸
// 공식 API: https://smartsms.aligo.in/admin/api/spec.html (알림톡 send)
// 발송 엔드포인트는 form-urlencoded POST. 수신자별로 receiver_N / message_N / button_N 인덱스를 사용한다.

const ALIGO_SEND_URL = "https://kakaoapi.aligo.in/akv10/alimtalk/send/";
// 문자(SMS/LMS) 발송 엔드포인트 (알림톡과 별도 API). 템플릿 승인 불필요.
const ALIGO_SMS_URL = "https://apis.aligo.in/send/";
// 알림톡 템플릿 목록 / 건별 전달 결과 조회
const ALIGO_TEMPLATE_LIST_URL = "https://kakaoapi.aligo.in/akv10/template/list/";
const ALIGO_HISTORY_DETAIL_URL = "https://kakaoapi.aligo.in/akv10/history/detail/";

// 한 번의 요청에 담는 최대 수신자 수 (알리고 권장 한도 내에서 보수적으로 분할)
const CHUNK_SIZE = 100;

const API_KEY = process.env.ALIGO_API_KEY || "";
const USER_ID = process.env.ALIGO_USER_ID || "";
const SENDER_KEY = process.env.ALIGO_SENDER_KEY || ""; // 카카오 발신프로필 키
const SENDER = process.env.ALIGO_SENDER || ""; // 발신자(가맹점) 연락처
const IS_TEST = process.env.ALIGO_TEST_MODE === "true";

export const aligoConfig = {
  apiKey: API_KEY,
  userId: USER_ID,
  senderKey: SENDER_KEY,
  sender: SENDER,
  isTest: IS_TEST,
};

export function isAligoConfigured(): boolean {
  return Boolean(API_KEY && USER_ID && SENDER_KEY && SENDER);
}

// 휴대폰 번호 정규화: 숫자만 남기고 010xxxxxxxx 형태(10~11자리, 0으로 시작)만 허용
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11) return null;
  if (!digits.startsWith("0")) return null;
  return digits;
}

// SMS(단문)은 EUC-KR 기준 90byte 까지. 한글 등 멀티바이트는 2byte 로 계산해 초과 시 LMS 전환.
function smsByteLength(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    n += text.charCodeAt(i) > 0x7f ? 2 : 1;
  }
  return n;
}

export interface AligoSmsResult {
  ok: boolean;
  error?: string;
  mid?: number; // 알리고 메시지 그룹 id (전달 결과 사후 조회용)
}

/**
 * 알리고 문자(SMS/LMS)를 한 명에게 발송한다. 알림톡과 달리 사전 승인 템플릿이 필요 없다.
 * 본문 길이(90byte)에 따라 SMS/LMS 를 자동 선택한다.
 * @param receiver 수신 번호 (정규화 전 문자열 허용)
 * @param message 본문
 * @param title LMS 제목 (미지정 시 기본값)
 */
export async function sendSms(opts: {
  receiver: string;
  message: string;
  title?: string;
}): Promise<AligoSmsResult> {
  const { message } = opts;
  if (!API_KEY || !USER_ID || !SENDER) {
    return { ok: false, error: "알리고 문자 환경변수가 설정되지 않았습니다." };
  }
  const phone = normalizePhone(opts.receiver);
  if (!phone) return { ok: false, error: "수신 번호 형식이 올바르지 않습니다." };

  const isLms = smsByteLength(message) > 90;

  const params = new URLSearchParams();
  params.set("key", API_KEY);
  params.set("user_id", USER_ID);
  params.set("sender", SENDER);
  params.set("receiver", phone);
  params.set("msg", message);
  params.set("msg_type", isLms ? "LMS" : "SMS");
  if (isLms) params.set("title", (opts.title || "바닐라폼").slice(0, 20));
  params.set("testmode_yn", IS_TEST ? "Y" : "N");

  try {
    const res = await fetch(ALIGO_SMS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
      body: params.toString(),
    });
    const data: any = await res.json().catch(() => null);
    // 알리고 문자 응답: { result_code: 1, message: "success", ... } / 음수는 실패
    if (data && Number(data.result_code) === 1) {
      return { ok: true, mid: Number(data.msg_id) || undefined };
    }
    return { ok: false, error: data?.message || `문자 발송 실패 (HTTP ${res.status})` };
  } catch (e: any) {
    return { ok: false, error: e?.message || "문자 발송 중 네트워크 오류" };
  }
}

// 알리고에 등록된 알림톡 템플릿 (template/list 응답 항목)
export interface AligoTemplate {
  templtCode: string;
  templtName: string;
  templtContent: string;
  templateType: string; // BA | EX | AD | MI
  inspStatus: string; // REG | REQ | APR | REJ
  status: string;
  cdate: string;
  buttons: Array<{
    ordering?: string;
    name: string;
    linkType: string;
    linkTypeName: string;
    linkMo?: string;
    linkPc?: string;
  }>;
}

/** 알리고에 등록된 알림톡 템플릿 전체 목록을 조회한다. */
export async function fetchAligoTemplates(): Promise<AligoTemplate[]> {
  if (!isAligoConfigured()) return [];
  const params = new URLSearchParams();
  params.set("apikey", API_KEY);
  params.set("userid", USER_ID);
  params.set("senderkey", SENDER_KEY);
  const res = await fetch(ALIGO_TEMPLATE_LIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
    body: params.toString(),
  });
  const data: any = await res.json().catch(() => null);
  if (!data || Number(data.code) !== 0 || !Array.isArray(data.list)) return [];
  return data.list as AligoTemplate[];
}

export interface AligoDeliveryResult {
  done: boolean; // 전달 리포트 도착 여부
  success?: boolean; // rslt=0 이면 전달 성공
  resultMessage?: string; // 실패 시 사유 (예: "메시지가 템플릿과 일치하지않음")
}

/**
 * 발송 접수(mid) 건의 실제 전달 결과를 조회한다.
 * 접수 성공 후에도 카카오 측에서 비동기로 실패할 수 있으므로(템플릿 불일치 등)
 * 테스트 발송 검증 시 반드시 이 결과까지 확인해야 한다.
 */
export async function fetchAlimtalkDeliveryResult(mid: number): Promise<AligoDeliveryResult> {
  const params = new URLSearchParams();
  params.set("apikey", API_KEY);
  params.set("userid", USER_ID);
  params.set("mid", String(mid));
  params.set("page", "1");
  params.set("limit", "10");
  const res = await fetch(ALIGO_HISTORY_DETAIL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
    body: params.toString(),
  });
  const data: any = await res.json().catch(() => null);
  const item = data?.list?.[0];
  if (!item || !item.reportdate) return { done: false };
  const success = item.rslt === "0" || item.rslt === "";
  return { done: true, success, resultMessage: success ? undefined : item.rslt_message || String(item.rslt) };
}

export interface AligoButton {
  name: string;
  linkType: "WL" | "AL" | "DS" | "BK" | "MD" | "AC"; // WL:웹링크, AC:채널추가 등
  linkTypeName: string;
  linkMo?: string;
  linkPc?: string;
}

export interface AligoRecipient {
  phone: string; // 정규화된 번호
  name?: string;
}

export interface AligoSendResult {
  ok: boolean;
  attempted: number;
  successCount: number;
  failCount: number;
  errors: string[];
  mids: number[]; // 청크별 알리고 메시지 그룹 id (전달 결과 사후 조회용)
  cost: number; // 알리고가 응답한 차감 비용 합계(원)
}

/**
 * 동일한 메시지/버튼을 여러 수신자에게 일괄 발송한다.
 * @param tplCode 알리고에 등록·승인된 템플릿 코드
 * @param message 변수 치환이 끝난 최종 메시지 본문 (등록 템플릿과 정확히 일치해야 함)
 * @param subject 알림톡 제목
 * @param buttons 버튼 목록 (등록 템플릿 버튼과 일치해야 함)
 * @param recipients 수신자 목록
 */
export async function sendAlimtalk(opts: {
  tplCode: string;
  message: string;
  subject: string;
  buttons: AligoButton[];
  recipients: AligoRecipient[];
}): Promise<AligoSendResult> {
  const { tplCode, message, subject, buttons, recipients } = opts;
  const result: AligoSendResult = { ok: true, attempted: recipients.length, successCount: 0, failCount: 0, errors: [], mids: [], cost: 0 };

  if (!isAligoConfigured()) {
    result.ok = false;
    result.errors.push("알리고 환경변수가 설정되지 않았습니다.");
    return result;
  }
  if (!tplCode) {
    result.ok = false;
    result.errors.push("템플릿 코드가 없습니다.");
    return result;
  }
  if (recipients.length === 0) return result;

  const buttonJson = JSON.stringify({ button: buttons });

  for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
    const chunk = recipients.slice(i, i + CHUNK_SIZE);
    const params = new URLSearchParams();
    params.set("apikey", API_KEY);
    params.set("userid", USER_ID);
    params.set("senderkey", SENDER_KEY);
    params.set("tpl_code", tplCode);
    params.set("sender", SENDER);
    params.set("testMode", IS_TEST ? "Y" : "N");

    chunk.forEach((r, idx) => {
      const n = idx + 1; // 알리고는 1부터 시작하는 인덱스 사용
      params.set(`receiver_${n}`, r.phone);
      params.set(`recvname_${n}`, r.name || "고객님");
      params.set(`subject_${n}`, subject);
      params.set(`message_${n}`, message);
      params.set(`button_${n}`, buttonJson);
    });

    try {
      const res = await fetch(ALIGO_SEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
        body: params.toString(),
      });
      const data: any = await res.json().catch(() => null);
      // 알리고 응답: { code: 0, message: "성공", ... } / 음수 코드는 실패
      if (data && Number(data.code) === 0) {
        result.successCount += chunk.length;
        if (data.info?.mid) result.mids.push(Number(data.info.mid));
        result.cost += Number(data.info?.total) || 0;
      } else {
        result.ok = false;
        result.failCount += chunk.length;
        result.errors.push(data?.message || `알림톡 발송 실패 (HTTP ${res.status})`);
      }
    } catch (e: any) {
      result.ok = false;
      result.failCount += chunk.length;
      result.errors.push(e?.message || "알림톡 발송 중 네트워크 오류");
    }
  }

  return result;
}
