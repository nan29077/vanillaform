import { NextRequest, NextResponse } from "next/server";
import { verifyImpersonationToken } from "@/lib/impersonation";
import { absoluteUrl } from "@/lib/appUrl";

export const dynamic = "force-dynamic";

// 임시 로그인 토큰을 검증 후 NextAuth signIn redirect
// 새 탭에서 /api/auth/impersonate?token=XXX 로 열리면
// NextAuth의 impersonate provider URL로 리다이렉트
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(absoluteUrl("/?error=invalid_token"));
  }

  const userId = verifyImpersonationToken(token);
  if (!userId) {
    return NextResponse.redirect(absoluteUrl("/?error=token_expired"));
  }

  const callbackUrl = "/";

  // Use a form POST to NextAuth's credentials signIn endpoint
  // Return an HTML page that auto-submits a form to NextAuth
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>임시 로그인 중...</title></head>
<body>
<p style="font-family:sans-serif;text-align:center;margin-top:40px">임시 로그인 처리 중...</p>
<form id="f" method="POST" action="/api/auth/signin/impersonate">
  <input name="token" value="${encodeURIComponent(token)}" />
  <input name="callbackUrl" value="${callbackUrl}" />
  <input name="csrfToken" id="csrf" value="" />
</form>
<script>
(async () => {
  try {
    const r = await fetch('/api/auth/csrf');
    const { csrfToken } = await r.json();
    document.getElementById('csrf').value = csrfToken;
    document.getElementById('f').querySelector('[name="token"]').value = decodeURIComponent('${encodeURIComponent(token)}');
    document.getElementById('f').submit();
  } catch(e) {
    document.body.innerHTML = '<p style="color:red;text-align:center;margin-top:40px">오류가 발생했습니다. 다시 시도해주세요.</p>';
  }
})();
</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
