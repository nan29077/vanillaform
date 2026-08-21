"use client";

import { useEffect } from "react";
import { SB_SHOP_COOKIE, type ShopMini } from "@/lib/shopContext";

// 셀러샵 메인(/shop/[slug]) 진입 시 셀러 미니정보를 쿠키에 저장한다.
// 이후 구매자 서브페이지(/cart, /my/*, /products/* ...)에서도 셀러 전용 헤더·하단바가 유지된다.
export default function ShopContextSync({ shop }: { shop: ShopMini }) {
  useEffect(() => {
    const value = encodeURIComponent(JSON.stringify(shop));
    // 30일 유지, lax (셀러 세계 내 이동 유지용)
    document.cookie = `${SB_SHOP_COOKIE}=${value}; path=/; max-age=2592000; samesite=lax`;
  }, [shop.slug, shop.name, shop.logo]);

  return null;
}
