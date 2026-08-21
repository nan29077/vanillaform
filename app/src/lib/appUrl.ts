/**
 * 서비스 공개 URL(오리진) 반환.
 *
 * 라우트 핸들러에서 `new URL(path, req.url)` 로 리다이렉트를 만들면
 * 리버스 프록시(nginx) 뒤에서는 호스트가 내부 주소(localhost:3026)로 잡혀
 * 사용자가 접근할 수 없는 주소로 리다이렉트된다.
 * 외부로 나가는 리다이렉트/링크는 반드시 이 값을 기준으로 만든다.
 */
export function getAppBaseUrl(): string {
  const base =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3026";
  return base.replace(/\/$/, "");
}

/** 공개 URL 기준 절대 경로 URL 생성 (리다이렉트용) */
export function absoluteUrl(path: string): string {
  return new URL(path, getAppBaseUrl()).toString();
}
