import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {Link2, Camera} from 'lucide-react';
import SafeImage from "@/components/shared/SafeImage";
import { DEFAULT_SHOP_BANNER, DEFAULT_AVATAR } from "@/lib/defaults";
import ShopLinkButton from "@/components/shared/ShopLinkButton";
import ShopThemeColorPicker from "@/components/shared/ShopThemeColorPicker";
import ReferralLinkManager from "@/components/shared/ReferralLinkManager";
import SellerBusinessInfoForm from "@/components/shared/SellerBusinessInfoForm";
import ShopFeatureToggles from "@/components/shared/ShopFeatureToggles";
import ShopLiveSettings from "@/components/shared/ShopLiveSettings";
import PastBroadcastToggles from "@/components/shared/PastBroadcastToggles";
import ShopEditForm from "@/components/shared/ShopEditForm";
import SellerShopDashboardTabs from "@/components/shared/SellerShopDashboardTabs";
import ShopQRSection from "@/components/shared/ShopQRSection";
import { getFeatureFlags } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SellerShopPage() {
  const session = await auth();
  if (session?.user?.role !== "SELLER") redirect("/");

  const flags = await getFeatureFlags();

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session!.user!.id },
    include: {
      _count: { select: { fans: true, shopProducts: true, campaigns: true, referredBuyers: true } },
    },
  });

  if (!seller) redirect("/");

  // 지난 방송(종료된 라이브) 목록 — 셀러샵 노출 스위치용. 라이브 커머스가 운영 정책상 켜진 경우에만 노출.
  const endedLives = flags.liveCommerce
    ? await prisma.liveStream.findMany({
        where: { sellerId: seller.id, status: "ENDED" },
        orderBy: [{ endedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          thumbnailImage: true,
          endedAt: true,
          startedAt: true,
          peakViewerCount: true,
          viewerCount: true,
          showPastInShop: true,
          _count: { select: { products: true } },
        },
      })
    : [];

  const pastBroadcastItems = endedLives.map((l) => ({
    id: l.id,
    title: l.title,
    thumbnail: l.thumbnailImage,
    endedAt: l.endedAt ? l.endedAt.toISOString() : null,
    startedAt: l.startedAt ? l.startedAt.toISOString() : null,
    productCount: l._count.products,
    peakViewerCount: l.peakViewerCount || l.viewerCount || 0,
    showPastInShop: l.showPastInShop,
  }));

  const basicContent = (
    <>
      <ShopEditForm
        initial={{
          slug: seller.slug,
          shopName: seller.shopName,
          category: seller.category,
          mood: seller.mood,
          shopDescription: seller.shopDescription,
          instagramUrl: seller.instagramUrl,
          youtubeUrl: seller.youtubeUrl,
          tiktokUrl: seller.tiktokUrl,
          facebookUrl: seller.facebookUrl,
          twitterUrl: seller.twitterUrl,
          youtubeChannelId: seller.youtubeChannelId,
          shopLogo: seller.shopLogo,
          shopBanner: seller.shopBanner,
        }}
      />

      {/* 샵 링크 & 통계 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">내 샵 주소</h3>
            <p className="text-xs text-gray-400 mt-0.5">/shop/{seller.slug}</p>
          </div>
        </div>
        <ShopLinkButton slug={seller.slug} />

        {/* 간단 통계 */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-50">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Icon name="Users" size={14} strokeWidth={1.5} className="text-brand-500" />
            <span className="font-semibold">{seller._count.fans}</span> 팬
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Icon name="Cart" size={14} strokeWidth={1.5} className="text-brand-500" />
            <span className="font-semibold">{seller._count.shopProducts}</span> 상품
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Icon name="Star" size={14} strokeWidth={1.5} className="text-brand-500" />
            <span className="font-semibold">{seller._count.campaigns}</span> 캠페인
          </div>
          {flags.referral && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Link2 size={14} strokeWidth={1.5} className="text-brand-500" />
              <span className="font-semibold">{seller._count.referredBuyers}</span> 추천인
            </div>
          )}
        </div>
      </div>

      {/* 샵 바로가기 & QR코드 */}
      <ShopQRSection slug={seller.slug} />
    </>
  );

  const liveContent = (
    <>
      {/* 샵 기능 관리 */}
      <ShopFeatureToggles
        initialFeatures={{
          groupBuy: seller.featureGroupBuy ?? true,
          content: seller.featureContent ?? true,
          liveCommerce: seller.featureLiveCommerce ?? false,
        }}
        adminFlags={{
          groupBuy: flags.groupBuy,
          content: flags.brix,
          liveCommerce: flags.liveCommerce,
        }}
      />

      {/* 라이브 중 수동 표시 + 외부 라이브 연동 링크 */}
      <div className="mt-4">
        <ShopLiveSettings
          initial={{
            isManualLive: seller.isManualLive ?? false,
            livePlatform: seller.livePlatform ?? null,
            liveLink: seller.liveLink ?? null,
            manualLiveProductIds: (() => {
              try { return JSON.parse((seller as any).manualLiveProductIds || "[]"); } catch { return []; }
            })(),
          }}
        />
      </div>

      {/* 지난 방송 상품 노출 스위치 */}
            {flags.liveCommerce && (
        <div className="mt-4">
          <PastBroadcastToggles initialItems={pastBroadcastItems} />
        </div>
      )}
    </>
  );

  return (
    <div className="animate-fade-in">
      <SellerShopDashboardTabs basicContent={basicContent} liveContent={liveContent} />
    </div>
  );
}
