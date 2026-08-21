import { cookies } from "next/headers";
import { Suspense } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MobileNav from "@/components/layout/MobileNav";
import FloatingButtons from "@/components/shared/FloatingButtons";
import HideOnShop from "@/components/shared/HideOnShop";
import ShopChromeProvider from "@/components/shared/ShopChromeProvider";
import { ShopSubpageHeader, ShopSubpageBottomNav } from "@/components/shared/ShopSubpageChrome";
import { getFeatureFlags, getSocialLinks, getFooterSettings } from "@/lib/settings";
import { SB_SHOP_COOKIE, parseShopCookie } from "@/lib/shopContext";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [flags, socialLinks, footerSettings] = await Promise.all([
    getFeatureFlags(),
    getSocialLinks(),
    getFooterSettings(),
  ]);
  const initialShop = parseShopCookie(cookies().get(SB_SHOP_COOKIE)?.value);

  return (
    <ShopChromeProvider initialShop={initialShop}>
      <div className="min-h-screen">
        <div className="max-w-[480px] mx-auto bg-white min-h-screen shadow-[0_0_40px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom)]">
          <Suspense fallback={null}>
            <Header />
          </Suspense>
          <ShopSubpageHeader />
          <main className="pb-20">{children}</main>
          <Footer flags={flags} socialLinks={socialLinks} footerSettings={footerSettings} />
        </div>
        <HideOnShop>
          <FloatingButtons />
        </HideOnShop>
        <Suspense fallback={null}>
          <MobileNav />
        </Suspense>
        <ShopSubpageBottomNav />
      </div>
    </ShopChromeProvider>
  );
}
