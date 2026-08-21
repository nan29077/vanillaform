import { Icon } from '@/components/shared/Icon';
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SafeImage from "@/components/shared/SafeImage";
import {} from 'lucide-react';
import { pickSellerAvatar } from "@/lib/defaults";
import { isSellerLive, sellerProfileImage } from "@/lib/sellerLive";
import LiveBadge, { LIVE_RING_CLASS } from "@/components/shared/LiveBadge";

export const dynamic = "force-dynamic";

// 메인 페이지 상단: 로그인한 구매회원의 "단골 PICK" 셀러 빠른 진입 + 내 쇼핑(주문내역/내정보/장바구니) 바로가기.
// - 비로그인/구매회원이 아닌 경우엔 로그인 유도 또는 비노출.
export default async function HomeMyShopBar() {
  const session = await auth();

  // 로그인 안 한 방문자: 단골 PICK 안내 CTA
  if (!session?.user) {
    return (
      <section className="px-4 mt-3">
        <Link
          href="/auth/login"
          className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3.5 active:scale-[0.99] transition-transform"
        >
          <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center text-white flex-shrink-0">
            <Icon name="Wishlist" size={16} className="fill-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">로그인하고 단골 라이브 셀러 PICK하기</p>
            <p className="text-[11px] text-gray-500 mt-0.5">PICK한 라이브 셀러가 단골가게로 모여요</p>
          </div>
          <Icon name="ChevronDown" size={18} className="text-brand-400 flex-shrink-0 -rotate-90" />
        </Link>
      </section>
    );
  }

  const role = session.user.role;
  // 구매회원 전용 바 (셀러/관리자/브랜드는 각자 대시보드를 쓰므로 비노출)
  if (role && role !== "BUYER") return null;

  const profile = await prisma.buyerProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      follows: {
        include: {
          seller: {
            select: {
              id: true, slug: true, shopName: true, shopLogo: true, isManualLive: true, liveLink: true,
              user: { select: { avatar: true } },
              liveStreams: { where: { status: "LIVE" }, take: 1, select: { id: true, shareCode: true, externalUrl: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const picks = profile?.follows?.map((f) => f.seller) || [];

  return (
    <section className="mt-3">
      {/* 내 쇼핑 빠른 메뉴 */}
      <div className="px-4">
        <div className="grid grid-cols-3 gap-2">
          <Link
            href="/my/orders"
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-gray-100 bg-white py-3 active:bg-gray-50 transition-colors"
          >
            <Icon name="File" size={19} strokeWidth={1.6} className="text-blue-500" />
            <span className="text-[11px] font-medium text-gray-700">주문내역</span>
          </Link>
          <Link
            href="/live"
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-gray-100 bg-white py-3 active:bg-gray-50 transition-colors"
          >
            <Icon name="Live" size={19} strokeWidth={1.6} className="text-rose-500" />
            <span className="text-[11px] font-medium text-gray-700">라이브</span>
          </Link>
          <Link
            href="/my"
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-gray-100 bg-white py-3 active:bg-gray-50 transition-colors"
          >
            <Icon name="MyPage" size={19} strokeWidth={1.6} className="text-gray-600" />
            <span className="text-[11px] font-medium text-gray-700">마이페이지</span>
          </Link>
        </div>
      </div>

      {/* 단골 PICK */}
      <div className="mt-4">
        <div className="flex items-center justify-between px-4 mb-2.5">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <Icon name="Wishlist" size={14} className="text-pink-500 fill-pink-500" />
            단골 PICK
          </h2>
          {picks.length > 0 && (
            <Link href="/my/seller" className="text-xs text-gray-400 flex items-center gap-0.5">
              전체보기 ({picks.length})
              <Icon name="ChevronDown" size={12} className="-rotate-90" />
            </Link>
          )}
        </div>

        {picks.length > 0 ? (
          <div className="flex gap-3.5 overflow-x-auto scrollbar-hide px-4 pb-1">
            {picks.map((s) => {
              const live = isSellerLive(s);
              const liveStream = s.liveStreams?.[0] as { id: string; shareCode: string; externalUrl: string | null } | undefined;
              // 진행중 인앱 라이브는 항상 바닐라폼 시청페이지로 연결 (외부 URL 직접연결 금지)
              const inAppLiveUrl = liveStream ? `/live/${liveStream.shareCode}` : null;
              const manualLink = (s as any).liveLink || null;
              // 최종 링크: 1) 진행중 라이브 → 인앱 시청페이지 2) (인앱 라이브 없는 수동표시) 수동 liveLink
              const liveHref = live ? (inAppLiveUrl || manualLink || null) : null;
              const href = liveHref || `/shop/${s.slug}`;

              const content = (
                <>
                  <div className="relative">
                    <div className={`w-14 h-14 rounded-full overflow-hidden bg-gray-50 ${live ? LIVE_RING_CLASS : "ring-2 ring-pink-200"}`}>
                      <SafeImage
                        src={sellerProfileImage(s)}
                        placeholder={pickSellerAvatar(s.id)}
                        alt={s.shopName}
                        width={56}
                        height={56}
                        fallbackText={s.shopName.charAt(0)}
                      />
                    </div>
                    {live && <LiveBadge className="absolute -bottom-1 left-1/2 -translate-x-1/2" />}
                  </div>
                  <span className="text-[10px] text-gray-700 font-medium max-w-[56px] truncate">
                    {s.shopName}
                  </span>
                </>
              );
              const cls = "flex flex-col items-center gap-1.5 flex-shrink-0 w-14";
              // 라이브 실행 중이면 인앱 시청페이지·외부 링크 모두 항상 새창으로 연다.
              return liveHref ? (
                <a key={s.id} href={liveHref} target="_blank" rel="noopener noreferrer" className={cls}>
                  {content}
                </a>
              ) : (
                <Link key={s.id} href={href} className={cls}>
                  {content}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="px-4">
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-3.5">
              <div className="w-9 h-9 rounded-full bg-white border border-gray-100 flex items-center justify-center text-pink-400 flex-shrink-0">
                <Icon name="Wishlist" size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">아직 단골 라이브 셀러가 없어요</p>
                <p className="text-[11px] text-gray-500 mt-0.5">위에서 라이브 셀러 이름을 검색해 PICK해보세요</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
