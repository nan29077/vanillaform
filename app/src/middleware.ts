// 셀러 추천인(attribution) 캡처 미들웨어
//
// 다음 경로 진입 시 셀러 slug 을 쿠키(sb_ref)에 저장한다. (last-click, 7일)
//   - /shop/[slug]                   — 셀러 페이지 직접 진입
//   - /products/[id]?ref=<slug>      — 셀러 추천 링크로 제품 페이지 진입
//   - /auth/register?ref=<slug>      — 추천 링크가 회원가입으로 바로 보낸 경우
//
// 회원가입 클라이언트는 URL ref/code 가 없을 때 이 쿠키를 fallback 으로 사용.
// 백엔드 회원가입 API 도 동일 쿠키를 안전망으로 한 번 더 본다.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SELLER_REF_COOKIE,
  SELLER_REF_COOKIE_OPTIONS,
  isValidSellerSlug,
} from "@/lib/referral";
import { SB_SHOP_COOKIE } from "@/lib/shopContext";

const SHOP_PATH = /^\/shop\/([^\/?#]+)$/;
const PRODUCT_PATH = /^\/products\/[^\/?#]+/;
const REGISTER_PATH = /^\/auth\/register/;

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const res = NextResponse.next();

  let capturedSlug: string | null = null;

  // 1) /shop/[slug] - 셀러 페이지 직접 진입
  const shopMatch = pathname.match(SHOP_PATH);
  if (shopMatch && isValidSellerSlug(shopMatch[1])) {
    capturedSlug = shopMatch[1];
  }

  // 2) /products/[id]?ref=<slug>
  if (!capturedSlug && PRODUCT_PATH.test(pathname)) {
    const ref = searchParams.get("ref");
    if (ref && isValidSellerSlug(ref)) capturedSlug = ref;
  }

  // 3) /auth/register?ref=<slug>
  if (!capturedSlug && REGISTER_PATH.test(pathname)) {
    const ref = searchParams.get("ref");
    if (ref && isValidSellerSlug(ref)) capturedSlug = ref;
  }

  if (capturedSlug) {
    res.cookies.set({
      name: SELLER_REF_COOKIE,
      value: capturedSlug,
      ...SELLER_REF_COOKIE_OPTIONS,
    });
  }

  // 홈·내픽·라이브·콘텐츠 진입 시 셀러샵 컨텍스트 쿠키를 서버측에서 즉시 삭제
  // → initialShop 이 null 로 전달되어 ShopSubpageBottomNav flash 원천 차단
  if (pathname === "/" || pathname === "/my" || pathname === "/my/seller" || pathname === "/live" || pathname.startsWith("/content")) {
    res.cookies.set({ name: SB_SHOP_COOKIE, value: "", path: "/", maxAge: 0, sameSite: "lax" });
  }

  return res;
}

export const config = {
  // 정적 자산/이미지 등은 제외. Next 권장 매처에 추천 경로만 포함.
  matcher: ["/", "/my", "/my/seller", "/live", "/shop/:path*", "/products/:path*", "/auth/register", "/content/:path*"],
};
