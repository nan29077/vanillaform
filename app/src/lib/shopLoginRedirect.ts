import { cookies } from "next/headers";
import { parseShopCookie, SB_SHOP_COOKIE } from "@/lib/shopContext";

export function getShopAwareLoginPath(fallbackCallbackUrl?: string): string {
  const shop = parseShopCookie(cookies().get(SB_SHOP_COOKIE)?.value);
  const callbackUrl = shop
    ? `/shop/${encodeURIComponent(shop.slug)}`
    : fallbackCallbackUrl;

  if (!callbackUrl) return "/auth/login";
  return `/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
