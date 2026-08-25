import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice, formatDiscount, getProgressPercent, parseJsonArray } from "@/lib/utils";
import CampaignCard from "@/components/shared/CampaignCard";
import SafeImage from "@/components/shared/SafeImage";
import PickSellerButton from "@/components/shared/PickSellerButton";
import SellerShopFooter from "@/components/shared/SellerShopFooter";
import SellerShopTabs from "@/components/shared/SellerShopTabs";
import SellerShopJoinCta from "@/components/shared/SellerShopJoinCta";
import SellerShopHeader from "@/components/shared/SellerShopHeader";
import SellerShopBottomNav from "@/components/shared/SellerShopBottomNav";
import ShopContextSync from "@/components/shared/ShopContextSync";
import ShopAddressPopup from "@/components/shared/ShopAddressPopup";
import { Users, ShoppingBag, Star, MapPin, MessageCircle, Radio, Eye, Video, Sparkles } from "lucide-react";
import { getFeatureFlags, getFooterSettings } from "@/lib/settings";
import { getSellerFanCount } from "@/lib/sellerFans";
import { DEFAULT_SHOP_BANNER, DEFAULT_PRODUCT_IMAGE, pickSellerAvatar } from "@/lib/defaults";
import { OnAirBadge } from "@/components/shared/LiveBadge";
import DevBuyerLoginBanner from "@/components/dev/DevBuyerLoginBanner";

export const dynamic = "force-dynamic";

export default async function SellerShopPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { groupBuy: FEATURE_GROUP_BUY, liveCommerce: FEATURE_LIVE_COMMERCE, referral: FEATURE_REFERRAL } = await getFeatureFlags();
  // 셀러샵 하단 통신판매중개자 고지에 사용할 운영사 정보
  const footerSettings = await getFooterSettings();
  const resolvedParams = await Promise.resolve(params);
  const seller = await prisma.sellerProfile.findUnique({
    where: { slug: resolvedParams.slug },
    include: {
      user: { select: { name: true, avatar: true } },
      shopExposure: true,
      shopProducts: {
        where: {
          isActive: true,
          product: {
            OR: [
              { brandId: null },
              { brand: { assignedNodeId: null } },
              { brand: { assignedNode: { isActive: true } } },
            ],
          },
        },
        include: {
          product: {
            include: { category: true, images: { take: 1 } },
          },
        },
        orderBy: { displayOrder: "asc" },
      },
      campaigns: {
        where: { status: { in: ["ACTIVE", "SCHEDULED"] } },
        include: { product: true },
        orderBy: { startDate: "desc" },
      },
      // 현재 진행 중 + 예정된 라이브
      liveStreams: {
        where: { status: { in: ["LIVE", "SCHEDULED", "ENDED"] } },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 20,
        include: {
          products: {
            include: { product: { select: { id: true, name: true, thumbnail: true, basePrice: true, comparePrice: true } } },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
      _count: {
        select: { fans: true, followers: true, campaigns: true },
      },
    },
  });

  if (!seller || !seller.isApproved) notFound();

  // 일반상품 노출 (셀러가 스위치 ON한 경우)
  // include: { shopExposure: true } 로 가져오되, Prisma 클라이언트 타입 불일치 대비 직접 조회 fallback
  let shopExposureData = (seller as any).shopExposure as { isEnabled: boolean; productIds: string | null } | null;
  if (!shopExposureData) {
    shopExposureData = await (prisma as any).shopDirectProductExposure.findUnique({
      where: { sellerProfileId: seller.id },
      select: { isEnabled: true, productIds: true },
    }) ?? null;
  }
  const directExposureOn = shopExposureData?.isEnabled ?? false;
  let directProductsData: { id: string; name: string; price: number; shippingFee: number; images: string[]; stock: number }[] = [];
  if (directExposureOn) {
    const selectedDirectIds = parseJsonArray(shopExposureData?.productIds);
    if (selectedDirectIds.length > 0) {
      // 샵관리 > 일반상품에서 선택된 특정 상품들만 노출
      const dps = await prisma.directProduct.findMany({
        where: { sellerId: seller.id, id: { in: selectedDirectIds }, isActive: true },
      });
      const orderMap = new Map(selectedDirectIds.map((id, idx) => [id, idx]));
      directProductsData = dps
        .sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))
        .map((p) => ({
          id: p.id,
          name: p.name,
          price: Number(p.price),
          shippingFee: Number(p.shippingFee),
          images: parseJsonArray(p.images),
          stock: p.stock,
        }));
    } else {
      // 상품관리 > 일반상품 탭에서 스위치만 켠 경우: isActive=true인 상품 전체 노출
      const dps = await prisma.directProduct.findMany({
        where: { sellerId: seller.id, isActive: true },
        orderBy: { createdAt: "desc" },
      });
      directProductsData = dps.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        shippingFee: Number(p.shippingFee),
        images: parseJsonArray(p.images),
        stock: p.stock,
      }));
    }
  }

  const activeCampaigns = FEATURE_GROUP_BUY ? seller.campaigns.filter((c) => c.status === "ACTIVE") : [];
  const themeColor = seller.shopThemeColor || "#377255";
  // 셀러의 "샵 기능관리 > 라이브 커머스" 스위치(featureLiveCommerce)가 켜진 경우에만 라이브 상품을 노출.
  // (전역 관리자 플래그 AND 셀러 스위치)
  const sellerLiveOn = FEATURE_LIVE_COMMERCE && (seller.featureLiveCommerce ?? false);
  // ★ 라이브 진행 여부 — 인앱 시청 페이지(/live)와 분리.
  //   프로필 LIVE 뱃지: 셀러가 직접 켠 "라이브 중 표시"(isManualLive) 또는 실제 진행중 라이브일 때 노출.
  //   링크 우선순위: 진행중 인앱 라이브 /live/shareCode > 수동 liveLink.
  const currentLiveRaw = seller.liveStreams.find((l) => l.status === "LIVE") || null;
  const manualLiveOn = (seller as any).isManualLive ?? false;
  const manualLiveLink = (seller as any).liveLink || null;
  // 진행중 인앱 라이브는 항상 바닐라폼 시청페이지로 연결 (외부 URL 직접연결 금지)
  const inAppLiveHref = sellerLiveOn && currentLiveRaw ? `/live/${currentLiveRaw.shareCode}` : null;
  // 최종 프로필 링크: 1) 진행중 라이브 → 인앱 시청페이지 2) (인앱 라이브 없는 수동표시) 수동 liveLink
  const profileLiveHref = inAppLiveHref || manualLiveLink || null;
  const showProfileLive = manualLiveOn || !!currentLiveRaw;
  // 인앱 라이브 탭/스트림 목록은 셀러 라이브 스위치에 따라.
  const currentLive = sellerLiveOn ? currentLiveRaw ?? undefined : undefined;
  const scheduledLives = sellerLiveOn ? seller.liveStreams.filter((l) => l.status === "SCHEDULED") : [];
  // 지난 방송 상품: 라이브 커머스 스위치와 무관하게, 셀러가 일자별 노출 스위치(showPastInShop)를
  //   켠 종료 방송은 항상 셀러샵에 노출한다. (지난방송 = 별도 노출 스위치로 관리)
  const endedLives = seller.liveStreams.filter((l) => l.status === "ENDED" && l.showPastInShop);

  // 수동 라이브 노출 상품 (isManualLive 스위치와 연동)
  const manualProductIds: string[] = (() => {
    try { return JSON.parse((seller as any).manualLiveProductIds || "[]"); } catch { return []; }
  })();
  const manualProductMap = new Map(
    seller.shopProducts
      .filter((sp) => manualProductIds.includes(sp.product.id))
      .map((sp) => [sp.product.id, sp.product])
  );
  const manualProductsData = manualProductIds
    .map((id) => manualProductMap.get(id))
    .filter(Boolean)
    .map((p) => ({
      id: p!.id,
      name: p!.name,
      thumbnail: p!.thumbnail,
      basePrice: Number(p!.basePrice),
      comparePrice: p!.comparePrice ? Number(p!.comparePrice) : null,
    }));
  // isManualLive ON + 라이브커머스 없음 → "현재 라이브 중 상품" 탭에 노출
  // isManualLive ON + 라이브커머스 진행 중 → 라이브커머스 우선, 수동 상품 숨김
  // isManualLive OFF → "지난 방송 상품" 탭에 노출
  const manualLiveProducts = manualLiveOn && !currentLiveRaw ? manualProductsData : [];
  const manualPastProducts = !manualLiveOn ? manualProductsData : [];

  // Feature flags — 셀러 샵 기능관리 스위치를 그대로 반영.
  const features = {
    groupBuy: FEATURE_GROUP_BUY && (seller.featureGroupBuy ?? true),
    liveCommerce: sellerLiveOn,
  };

  const hasLive = sellerLiveOn && seller.liveStreams.length > 0;

  // Serialize data for client component
  const tabData = {
    campaigns: activeCampaigns.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      currentQuantity: c.currentQuantity,
      goalQuantity: c.goalQuantity,
      participantCount: c.participantCount,
      bannerImage: c.bannerImage,
      campaignPrice: Number(c.campaignPrice),
      originalPrice: Number(c.originalPrice),
      endDate: new Date(c.endDate).toISOString(),
      seller: {
        slug: seller.slug,
        shopName: seller.shopName,
        shopLogo: seller.shopLogo,
      },
      product: {
        name: c.product.name,
        thumbnail: c.product.thumbnail,
      },
    })),
    products: seller.shopProducts.map((sp) => ({
      id: sp.product.id,
      name: sp.product.name,
      thumbnail: sp.product.thumbnail,
      basePrice: Number(sp.product.basePrice),
      comparePrice: sp.product.comparePrice ? Number(sp.product.comparePrice) : null,
      category: sp.product.category?.name || null,
      images: sp.product.images,
      shopNumber: (sp as any).shopNumber ?? null,
    })),
    // 샵에 바로 노출하기 (라이브 없이 상품 직접 노출)
    directExpose: (seller as any).shopDirectExpose ?? false,
    numbering: (seller as any).shopNumbering ?? false,
    // 셀러 직접 등록 일반상품 (샵관리/상품관리 > 일반상품 스위치 ON)
    directExposureOn,
    directProducts: directProductsData,
    currentLive: currentLive ? {
      id: currentLive.id,
      title: currentLive.title,
      description: currentLive.description,
      thumbnailImage: currentLive.thumbnailImage,
      shareCode: currentLive.shareCode,
      viewerCount: currentLive.viewerCount,
      products: currentLive.products.map((p) => ({
        id: p.id,
        livePrice: p.livePrice ? Number(p.livePrice) : null,
        sortOrder: p.sortOrder,
        product: {
          id: p.product.id,
          name: p.product.name,
          thumbnail: p.product.thumbnail,
          basePrice: Number(p.product.basePrice),
          comparePrice: p.product.comparePrice ? Number(p.product.comparePrice) : null,
        },
      })),
    } : null,
    scheduledLives: scheduledLives.map((l) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      thumbnailImage: l.thumbnailImage,
      shareCode: l.shareCode,
      scheduledAt: l.scheduledAt ? new Date(l.scheduledAt).toISOString() : null,
      products: l.products.map((p) => ({
        id: p.id,
        livePrice: p.livePrice ? Number(p.livePrice) : null,
        sortOrder: p.sortOrder,
        product: {
          id: p.product.id,
          name: p.product.name,
          thumbnail: p.product.thumbnail,
          basePrice: Number(p.product.basePrice),
        },
      })),
    })),
    endedLives: endedLives.map((l) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      thumbnailImage: l.thumbnailImage,
      shareCode: l.shareCode,
      viewerCount: l.viewerCount,
      peakViewerCount: l.peakViewerCount,
      likeCount: l.likeCount,
      isVodSaved: l.isVodSaved,
      startedAt: l.startedAt ? new Date(l.startedAt).toISOString() : null,
      endedAt: l.endedAt ? new Date(l.endedAt).toISOString() : null,
      products: l.products.map((p) => ({
        id: p.id,
        livePrice: p.livePrice ? Number(p.livePrice) : null,
        sortOrder: p.sortOrder,
        product: {
          id: p.product.id,
          name: p.product.name,
          thumbnail: p.product.thumbnail,
          basePrice: Number(p.product.basePrice),
          comparePrice: p.product.comparePrice ? Number(p.product.comparePrice) : null,
        },
      })),
    })),
    themeColor,
    features,
    hasLive,
    isLive: !!currentLive,
    sellerProfileImage: seller.shopLogo || seller.user.avatar || null,
    manualLiveProducts,
    manualPastProducts,
  };

  // ───── 통계바 수치 ─────
  // 팬 수: totalFans 는 시드 더미값이 섞인 비정규화 컬럼이라 실집계로 대체.
  const fanCount = await getSellerFanCount(seller.id, FEATURE_REFERRAL);

  // 상품 수: 방문자가 실제로 볼 수 있는 상품만 센다.
  // 이전에는 shopProducts.length 를 그대로 썼는데, "샵에 바로 노출하기"가 꺼져 있으면
  // 상품 탭 자체가 없어서 "상품 N"만 보이고 목록은 하나도 없는 상태가 됐다.
  // 아래 조건은 SellerShopTabs 의 탭 노출 조건과 같은 기준이다.
  // (공동구매는 별도 "진행중" 수치가 있으므로 중복 집계하지 않는다)
  const showLiveTab = hasLive || features.liveCommerce || manualLiveProducts.length > 0;
  const showPastTab = tabData.endedLives.length > 0;
  const visibleProductIds = new Set<string>();
  if (tabData.directExpose) tabData.products.forEach((p) => visibleProductIds.add(p.id));
  if (directExposureOn) directProductsData.forEach((p: { id: string }) => visibleProductIds.add(p.id));
  if (showLiveTab) {
    tabData.currentLive?.products.forEach((p) => visibleProductIds.add(p.product.id));
    tabData.scheduledLives.forEach((l) => l.products.forEach((p) => visibleProductIds.add(p.product.id)));
    manualLiveProducts.forEach((p) => visibleProductIds.add(p.id));
  }
  if (showPastTab) {
    tabData.endedLives.forEach((l) => l.products.forEach((p) => visibleProductIds.add(p.product.id)));
    manualPastProducts.forEach((p) => visibleProductIds.add(p.id));
  }
  const visibleProductCount = visibleProductIds.size;

  return (
    <div className="animate-fade-in">
      {/* 셀러 컨텍스트 쿠키 동기화 — 서브페이지(장바구니/내정보 등)에서도 셀러 전용 크롬 유지 */}
      <ShopContextSync shop={{ slug: seller.slug, name: seller.shopName, logo: seller.shopLogo }} />

      {/* 로그인된 구매자 첫 진입 시 배송지 확인 팝업 (세션당 1회) */}
      <ShopAddressPopup sellerSlug={seller.slug} />

      {/* 구매자 테스트 로그인 배너 (개발용 — 비로그인 시에만 표시) */}
      <DevBuyerLoginBanner />

      {/* ───── 셀러샵 전용 상단 바 (셀러 로고 + 이름, 메인 이동 없음) ───── */}
      <SellerShopHeader
        sellerName={seller.shopName}
        sellerLogo={seller.shopLogo}
        sellerSlug={seller.slug}
        sellerId={seller.id}
        showLive={showProfileLive}
        liveHref={profileLiveHref}
      />

      {/* ───── 셀러 프로필 헤더 ───── */}
      <section className="relative">
        {/* 배너 with gradient overlay using theme color */}
        <div className="h-44 overflow-hidden bg-gray-200 relative">
          <SafeImage
            src={seller.shopBanner}
            placeholder={DEFAULT_SHOP_BANNER}
            alt={seller.shopName}
            width={480}
            height={200}
            fallbackText={seller.shopName}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to top, ${themeColor}40 0%, transparent 60%)`,
            }}
          />
        </div>

        {/* 프로필 카드 */}
        <div className="relative px-4 -mt-12">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 pb-5">
            {/* 상단: 로고 + 이름 */}
            <div className="flex items-start gap-3">
              {/* 프로필 이미지 - 라이브 중이면 두근두근 + 클릭 시 라이브로 이동 */}
              <div className="flex flex-col items-center flex-shrink-0 -mt-8">
                {(() => {
                  const ring = (
                    <div className={`relative w-16 h-16 rounded-full overflow-hidden ring-4 bg-white shadow-md ${
                      showProfileLive ? "ring-red-400 animate-heartbeat" : "ring-white"
                    }`}>
                      <SafeImage
                        src={seller.shopLogo}
                        placeholder={pickSellerAvatar(seller.id)}
                        alt={seller.shopName}
                        width={64}
                        height={64}
                        fallbackText={seller.shopName.charAt(0)}
                      />
                    </div>
                  );
                  if (!showProfileLive || !profileLiveHref) return ring;
                  // 라이브 링크(인앱 시청페이지·외부)는 항상 새창으로 연다.
                  return (
                    <a
                      href={profileLiveHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${seller.shopName} 라이브 보기`}
                      className="block cursor-pointer active:scale-95 transition-transform"
                    >
                      {ring}
                    </a>
                  );
                })()}
                {/* 라이브 표시 뱃지 - 링크 있으면 연결(외부면 새 탭), 없으면 표시만 */}
                {showProfileLive && (() => {
                  const badgeClass = "flex items-center gap-1 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full -mt-2 relative z-10 shadow-sm transition-colors";
                  const inner = (
                    <>
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      LIVE
                    </>
                  );
                  if (!profileLiveHref) {
                    return <span className={badgeClass}>{inner}</span>;
                  }
                  // 라이브 링크(인앱 시청페이지·외부)는 항상 새창으로 연다.
                  return (
                    <a href={profileLiveHref} target="_blank" rel="noopener noreferrer" className={`${badgeClass} hover:bg-red-600`}>
                      {inner}
                    </a>
                  );
                })()}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-bold text-gray-900 truncate">
                        {seller.shopName}
                      </h1>
                      {showProfileLive && <OnAirBadge className="w-8 h-8" />}
                    </div>
                  </div>
                  {/* 소셜 링크 */}
                  <div className="flex items-center gap-1.5">
                    {seller.instagramUrl && (
                      <a
                        href={seller.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-full bg-gray-50 text-gray-400 hover:text-pink-500 transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24"><defs><linearGradient id="ig-shop" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#FD5"/><stop offset="10%" stopColor="#FD5"/><stop offset="50%" stopColor="#FF543E"/><stop offset="100%" stopColor="#C837AB"/></linearGradient></defs><rect width="20" height="20" x="2" y="2" rx="5" fill="url(#ig-shop)"/><circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.5" fill="none"/><circle cx="17.5" cy="6.5" r="1.2" fill="white"/></svg>
                      </a>
                    )}
                    {seller.youtubeUrl && (
                      <a
                        href={seller.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-full bg-gray-50 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FF0000"/></svg>
                      </a>
                    )}
                    {seller.tiktokUrl && (
                      <a
                        href={seller.tiktokUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-full bg-gray-50 text-gray-400 hover:text-black transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.36a8.16 8.16 0 0 0 4.77 1.52V6.43a4.85 4.85 0 0 1-1.84-.04z" fill="currentColor"/></svg>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 통계 바 */}
            <div className="flex items-center justify-around mt-4 py-3 bg-gray-50 rounded-xl">
              <div className="text-center">
                <p className="text-base font-bold text-gray-900">{fanCount.toLocaleString()}</p>
                <p className="text-[10px] text-gray-400">팬</p>
              </div>
              <div className="w-px h-6 bg-gray-200" />
              <div className="text-center">
                <p className="text-base font-bold text-gray-900">{visibleProductCount}</p>
                <p className="text-[10px] text-gray-400">상품</p>
              </div>
              <div className="w-px h-6 bg-gray-200" />
              <div className="text-center">
                <p className="text-base font-bold text-gray-900">{activeCampaigns.length}</p>
                <p className="text-[10px] text-gray-400">진행중</p>
              </div>
            </div>

            {/* 설명 */}
            {seller.shopDescription && (
              <p className="text-xs text-gray-500 mt-3 leading-relaxed line-clamp-2">
                {seller.shopDescription}
              </p>
            )}

            {/* Pick 버튼 */}
            <div className="mt-4">
              <PickSellerButton
                sellerId={seller.id}
                sellerName={seller.shopName}
                sellerChannels={{
                  instagram: seller.instagramUrl,
                  youtube: seller.youtubeUrl,
                  tiktok: seller.tiktokUrl,
                  facebook: seller.facebookUrl,
                  twitter: seller.twitterUrl,
                }}
                variant="large"
              />
              {/* 비로그인 방문자 가입 유도 (추천인 제도 ON일 때만 노출)
                  추천인 할인 폐지(2026-07)로 할인율 문구 없이 일반 문구만 표시한다. */}
              {FEATURE_REFERRAL && (
                <SellerShopJoinCta
                  sellerSlug={seller.slug}
                  sellerName={seller.shopName}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ───── 탭 콘텐츠 (클라이언트 컴포넌트) ───── */}
      <SellerShopTabs data={tabData} sellerSlug={seller.slug} sellerName={seller.shopName} sellerId={seller.id} />

      {/* ───── 풋터: 판매자 정보 & 플랫폼 정보 ───── */}
      <SellerShopFooter
        sellerInfo={{
          shopName: seller.shopName,
          businessType: seller.businessType,
          representativeName: seller.representativeName,
          businessRegistrationNo: seller.businessRegistrationNo,
          telecomSalesLicenseNo: seller.telecomSalesLicenseNo,
          businessAddress: seller.businessAddress,
          businessCategory: seller.businessCategory,
        }}
        footerSettings={footerSettings}
      />

      {/* 셀러샵 전용 하단 네비 높이만큼 여백 */}
      <div className="h-16" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} />

      {/* ───── 셀러샵 전용 하단 네비 (장바구니/주문내역/내정보) ───── */}
      <SellerShopBottomNav sellerSlug={seller.slug} />

      {/* 애니메이션 키프레임 */}
      <style>{`
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          25% { transform: scale(1.08); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
          50% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.2); }
          75% { transform: scale(1.05); box-shadow: 0 0 0 5px rgba(239, 68, 68, 0); }
        }
        .animate-heartbeat {
          animation: heartbeat 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
