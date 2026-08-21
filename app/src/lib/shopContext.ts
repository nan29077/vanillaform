// 셀러샵 "컨텍스트" 공용 정의.
// - 셀러샵(/shop/[slug])에 들어오면 셀러 미니정보를 쿠키에 저장하고,
//   장바구니/주문내역/내정보 등 구매자 서브페이지에서도 셀러 전용 헤더·하단바를 유지한다.
// - 이 모듈은 prisma/document 등 환경 의존 코드를 두지 않아 서버·클라이언트 양쪽에서 import 가능.

export const SB_SHOP_COOKIE = "sb_shop";

export interface ShopMini {
  slug: string;
  name: string;
  logo: string | null;
}

// 쿠키 raw 문자열 → ShopMini (실패 시 null)
export function parseShopCookie(raw: string | undefined | null): ShopMini | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(decodeURIComponent(raw));
    if (obj && typeof obj.slug === "string" && obj.slug.length > 0 && typeof obj.name === "string") {
      return { slug: obj.slug, name: obj.name, logo: typeof obj.logo === "string" ? obj.logo : null };
    }
  } catch {
    // 무시: 손상된 쿠키 → 컨텍스트 없음
  }
  return null;
}

// 셀러 컨텍스트를 "유지"할 구매자 서브페이지 경로.
// (셀러샵 메인 /shop/[slug] 자체는 자체 헤더/하단바를 쓰므로 여기서 제외)
const SUBPAGE_PATTERNS: RegExp[] = [
  /^\/cart(\/|$)/,
  /^\/my\/(?!seller$).+/,   // /my/seller(내픽)는 제외, /my/orders 등만 포함
  /^\/products\/[^/]+/,
  /^\/content\/[^/]+/,
  /^\/checkout(\/|$)/,
  /^\/order(\/|$)/,
];

export function isShopMainPath(pathname: string): boolean {
  return /^\/shop\/[^/]+/.test(pathname);
}

export function isShopSubpagePath(pathname: string): boolean {
  if (isShopMainPath(pathname)) return false;
  if (pathname === "/") return false;
  return SUBPAGE_PATTERNS.some((re) => re.test(pathname));
}
