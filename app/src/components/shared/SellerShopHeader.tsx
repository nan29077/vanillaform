"use client";

import { Icon } from '@/components/shared/Icon';
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
;
import SafeImage from "@/components/shared/SafeImage";
import NotificationBell from "@/components/shared/NotificationBell";
import { pickSellerAvatar } from "@/lib/defaults";

// 셀러샵 전용 상단 바.
// - 좌측 상단: 바닐라폼 로고 대신 "셀러 프로필 사진(또는 샵 로고) + 셀러 이름".
// - 메인 페이지로 가는 링크는 일절 두지 않는다(셀러 세계 안에서만 이동).
// - 우측: 구매회원용 장바구니/내정보 진입만 제공.
export default function SellerShopHeader({
  sellerName,
  sellerLogo,
  sellerSlug,
  sellerId,
  showLive,
  liveHref,
}: {
  sellerName: string;
  sellerLogo: string | null;
  sellerSlug: string;
  sellerId?: string;
  showLive?: boolean;
  liveHref?: string | null;
}) {
  const { data: session } = useSession();
  const router = useRouter();

  const handleCartClick = useCallback(
    (e: React.MouseEvent) => {
      if (!session) {
        e.preventDefault();
        // 셀러샵에서 로그인 시 메인이 아닌 현재 셀러샵으로 복귀
        router.push(`/auth/login?callbackUrl=${encodeURIComponent(`/shop/${sellerSlug}`)}`);
      }
    },
    [session, router, sellerSlug]
  );

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="flex items-center justify-between h-14 px-4">
        {/* 좌측: 셀러 로고 + 이름 — 항상 셀러샵 홈으로 이동 (라이브 여부 무관) */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href={`/shop/${sellerSlug}`}
            scroll={true}
            className="flex items-center gap-2.5 min-w-0"
          >
            <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-50 flex-shrink-0 ring-1 ring-gray-200">
              <SafeImage
                src={sellerLogo}
                placeholder={pickSellerAvatar(sellerId || sellerSlug)}
                alt={sellerName}
                width={36}
                height={36}
                fallbackText={sellerName.charAt(0)}
              />
            </div>
            <span className="text-[15px] font-bold text-gray-900 truncate">{sellerName}</span>
          </Link>
        </div>

        {/* 우측: 구매회원 기능 (장바구니 / 알림) */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <Link
            href="/cart"
            onClick={handleCartClick}
            className="p-3 text-gray-800 hover:opacity-60 transition-opacity"
            aria-label="장바구니"
          >
            <Icon name="Cart" size={32} strokeWidth={1.5} />
          </Link>
          {/* 알림 버튼 — 모든 사용자 노출 */}
          <NotificationBell className="text-gray-800" size={32} buttonClassName="p-3" />
        </div>
      </div>
    </header>
  );
}
