"use client";

import { Icon } from '@/components/shared/Icon';
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
;
import { useShopChrome } from "@/components/shared/ShopChromeProvider";
import NotificationBell from "@/components/shared/NotificationBell";

export default function Header() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  // 라이브 팝업(iframe, ?embedded=true) 또는 라이브 진입(?from=live) 시 상단 헤더 숨김
  const embedded = searchParams?.get("embedded") === "true" || searchParams?.get("from") === "live";

  const role = session?.user?.role;
  const loggedOut = !session && status !== "loading";
  // 구매회원(또는 비로그인 방문자)에게만 장바구니 노출. 셀러/브랜드/관리자는 숨김.
  const showCart = !role || role === "BUYER";

  // 셀러샵 안에서는 글로벌 헤더를 숨기고 셀러샵 전용 헤더(SellerShopHeader)만 노출한다.
  const isSellerShop = /^\/shop\/[^/]+/.test(pathname);
  // 셀러 서브페이지(장바구니/내정보 등)에서는 공통 헤더 대신 셀러 전용 헤더가 노출된다.
  const { subpageActive } = useShopChrome();

  const handleCartClick = useCallback((e: React.MouseEvent) => {
    if (!session) {
      e.preventDefault();
      router.push("/auth/login");
    }
  }, [session, router]);

  if (isSellerShop || subpageActive || embedded) return null;

  return (
    <header className="sticky top-0 z-[60]">
      <div className="bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/" prefetch={true} className="flex items-center gap-1.5">
            <img src="/logo.svg" alt="바닐라폼" className="h-8 w-auto object-contain" />
          </Link>

          <div className="flex items-center gap-0.5 relative z-[70]" style={{ pointerEvents: "auto" }}>
            {showCart && (
              <Link
                href="/cart"
                prefetch={true}
                onClick={handleCartClick}
                className="inline-flex items-center justify-center h-10 px-2 text-gray-900 hover:opacity-60 transition-opacity relative"
                aria-label="장바구니"
              >
                <Icon name="Cart" size={22} strokeWidth={1.5} />
              </Link>
            )}
            {loggedOut ? (
              /* 로그아웃 상태: 로그인 버튼 */
              <Link
                href="/auth/login"
                prefetch={true}
                className="inline-flex items-center justify-center gap-1 text-[13px] font-bold text-gray-900 h-10 px-2 ml-1 active:scale-95 transition-transform"
              >
                <Icon name="Login" size={22} /> 로그인
              </Link>
            ) : (
              /* 로그인 상태: 알림 버튼 + 로그아웃 버튼 */
              <>
                <NotificationBell size={22} buttonClassName="inline-flex items-center justify-center h-10 px-2" />
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="inline-flex items-center justify-center gap-1 text-[13px] font-bold text-gray-900 h-10 px-2 ml-1 active:scale-95 transition-transform"
                  aria-label="로그아웃"
                >
                  <Icon name="Logout" size={22} /> 로그아웃
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
