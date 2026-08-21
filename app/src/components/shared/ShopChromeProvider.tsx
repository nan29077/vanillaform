"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  SB_SHOP_COOKIE,
  parseShopCookie,
  isShopMainPath,
  isShopSubpagePath,
  type ShopMini,
} from "@/lib/shopContext";

interface ShopChromeValue {
  shop: ShopMini | null;
  // 현재 경로가 "셀러 서브페이지"이고 셀러 컨텍스트가 살아있어 셀러 전용 크롬을 써야 하는 상태
  subpageActive: boolean;
}

const ShopChromeContext = createContext<ShopChromeValue>({ shop: null, subpageActive: false });

function readShopCookie(): ShopMini | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${SB_SHOP_COOKIE}=`));
  return parseShopCookie(match?.slice(SB_SHOP_COOKIE.length + 1));
}

function clearShopCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${SB_SHOP_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

// (public) 레이아웃을 감싸 셀러 컨텍스트를 자식에게 제공한다.
// initialShop 은 서버에서 쿠키를 파싱한 값(SSR 첫 페인트 일관성용).
export default function ShopChromeProvider({
  initialShop,
  children,
}: {
  initialShop: ShopMini | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const [shop, setShop] = useState<ShopMini | null>(initialShop);

  useEffect(() => {
    // shop 관련 경로(메인/서브페이지)가 아니면 → 셀러 컨텍스트 해제
    if (!isShopMainPath(pathname) && !isShopSubpagePath(pathname)) {
      clearShopCookie();
      setShop(null);
      return;
    }
    // shop 경로에서는 쿠키(셀러샵 진입 시 ShopContextSync 가 설정)를 신뢰 소스로 동기화
    setShop(readShopCookie());
  }, [pathname]);

  // 렌더 동기화: shop 관련 경로가 아니면 shop 컨텍스트를 동기적으로 무효화
  // (useEffect 보다 먼저 렌더에 반영되어 ShopSubpageBottomNav flash 방지)
  const isShopContext = isShopMainPath(pathname) || isShopSubpagePath(pathname);
  const effectiveShop = isShopContext ? shop : null;
  const subpageActive = !!effectiveShop && isShopSubpagePath(pathname);

  return (
    <ShopChromeContext.Provider value={{ shop: effectiveShop, subpageActive }}>
      {children}
    </ShopChromeContext.Provider>
  );
}

export function useShopChrome() {
  const ctx = useContext(ShopChromeContext);
  const pathname = usePathname() ?? "";
  return {
    shop: ctx.shop,
    subpageActive: ctx.subpageActive,
    isShopMain: isShopMainPath(pathname),
  };
}
