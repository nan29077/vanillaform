import crypto from "crypto";

// 최고관리자 "임시 로그인" 용 단기 서명 토큰.
// - 관리자 전용 API(/api/admin/impersonate)에서만 발급되며,
//   NextAuth 의 "impersonate" credentials provider 가 서명/만료를 검증해 해당 유저로 로그인시킨다.
const SECRET =
  process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "sb-impersonation-secret";
const DEFAULT_TTL_MS = 120_000; // 120초 (새 탭에서 로그인 완료까지 여유)

export function signImpersonationToken(userId: string, ttlMs: number = DEFAULT_TTL_MS): string {
  const exp = Date.now() + ttlMs;
  const payload = `${userId}.${exp}`;
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyImpersonationToken(token: string): string | null {
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
