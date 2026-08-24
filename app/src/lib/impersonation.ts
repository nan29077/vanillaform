import crypto from "crypto";

// 최고관리자 "임시 로그인" 용 단기 서명 토큰.
// - 관리자 전용 API(/api/admin/impersonate)에서만 발급되며,
//   NextAuth 의 "impersonate" credentials provider 가 서명/만료를 검증해 해당 유저로 로그인시킨다.
//
// 시크릿은 **환경변수에서만** 읽는다.
// 예전엔 `"sb-impersonation-secret"` 이라는 하드코딩 폴백이 있어서, AUTH_SECRET 이
// 비어 있는 환경에서는 누구나 공개된 문자열로 임의 사용자의 임시 로그인 토큰을
// 위조할 수 있었다(= 관리자 계정 탈취).
// 시크릿이 없으면 예외를 던지는 대신 **기능 자체를 비활성**한다 —
// 발급은 null, 검증은 항상 실패. 로그인/결제 등 다른 기능은 그대로 동작한다.
const SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || null;
const DEFAULT_TTL_MS = 120_000; // 120초 (새 탭에서 로그인 완료까지 여유)

/** 임시 로그인 기능이 사용 가능한 환경인지 (= 시크릿이 설정돼 있는지) */
export function isImpersonationEnabled(): boolean {
  return !!SECRET;
}

/** 토큰 발급. 시크릿 미설정이면 null (호출부에서 기능 비활성 처리) */
export function signImpersonationToken(
  userId: string,
  ttlMs: number = DEFAULT_TTL_MS,
): string | null {
  if (!SECRET) {
    console.warn("[impersonation] AUTH_SECRET 미설정 — 임시 로그인 기능 비활성");
    return null;
  }
  const exp = Date.now() + ttlMs;
  const payload = `${userId}.${exp}`;
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

/** 토큰 검증. 시크릿 미설정이면 항상 null (= 어떤 토큰도 통과시키지 않음) */
export function verifyImpersonationToken(token: string): string | null {
  if (!SECRET) return null;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [userId, expStr, sig] = parts;
    const payload = `${userId}.${expStr}`;
    const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    if (Date.now() > Number(expStr)) return null;
    return userId;
  } catch {
    return null;
  }
}
