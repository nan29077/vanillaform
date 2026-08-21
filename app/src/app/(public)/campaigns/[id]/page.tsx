import { Icon } from '@/components/shared/Icon';
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getFeatureFlags } from "@/lib/settings";
import { formatPrice, formatDiscount, getProgressPercent } from "@/lib/utils";
import CountdownTimer from "@/components/shared/CountdownTimer";
import SafeImage from "@/components/shared/SafeImage";
import AddToCartButton from "@/components/shared/AddToCartButton";
import ProductImageGallery from "@/components/shared/ProductImageGallery";
import ProductDetailTabs from "@/components/shared/ProductDetailTabs";
import { Star} from 'lucide-react';
import BuyNowButton from "@/components/shared/BuyNowButton";
import WishlistButton from "@/components/shared/WishlistButton";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const { groupBuy: FEATURE_GROUP_BUY } = await getFeatureFlags();
  if (!FEATURE_GROUP_BUY) notFound();

  const resolvedParams = await Promise.resolve(params);
  const campaign = await prisma.groupBuyCampaign.findUnique({
    where: { id: resolvedParams.id },
    include: {
      seller: { include: { user: { select: { name: true } } } },
      product: {
        include: {
          variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
          images: { orderBy: { sortOrder: "asc" } },
          category: true,
          reviews: {
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      },
    },
  });

  if (!campaign) notFound();

  const discount = formatDiscount(
    Number(campaign.originalPrice),
    Number(campaign.campaignPrice)
  );
  const progress = campaign.goalQuantity
    ? getProgressPercent(campaign.currentQuantity, campaign.goalQuantity)
    : null;
  const isActive = campaign.status === "ACTIVE";

  // Build image array for gallery
  const allImages = campaign.product.images.length > 0
    ? campaign.product.images.map((img) => img.url)
    : campaign.product.thumbnail
      ? [campaign.product.thumbnail]
      : campaign.bannerImage
        ? [campaign.bannerImage]
        : [];

  // Build reviews HTML for tabs
  const reviewsHtml = campaign.product.reviews.map(r => `
    <div class="pb-3 border-b border-gray-100 last:border-0 mb-3">
      <div class="flex items-center gap-2 mb-1.5">
        <div class="flex gap-0.5">
          ${Array.from({ length: 5 }).map((_, i) =>
            `<svg width="10" height="10" viewBox="0 0 24 24" fill="${i < r.rating ? 'black' : 'none'}" stroke="${i < r.rating ? 'black' : '#e5e7eb'}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
          ).join('')}
        </div>
        <span class="text-[11px] text-gray-500 font-medium">${r.user.name || '익명'}</span>
        <span class="text-[10px] text-gray-300">${new Date(r.createdAt).toLocaleDateString('ko-KR')}</span>
      </div>
      <p class="text-sm text-gray-700 leading-relaxed">${r.content}</p>
    </div>
  `).join('');

  return (
    <div className="animate-fade-in pb-20 bg-white">
      {/* 모바일 상단 헤더 */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center justify-between px-4 h-12">
          <Link href="/campaigns" className="text-gray-900 hover:opacity-60 transition-opacity">
            <Icon name="ArrowRight" size={22} strokeWidth={1.5} className="rotate-180" />
          </Link>
          <p className="text-sm font-medium text-gray-900">공동구매</p>
          <div className="w-[22px]" />
        </div>
      </div>

      {/* ── Product Images Gallery (Swipeable with arrows) ── */}
      <ProductImageGallery images={allImages} productName={campaign.product.name} />

      {/* 상태 배지 */}
      <div className="px-4 pt-3 flex gap-1.5">
        {isActive && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500 text-white">
            <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
            진행중
          </span>
        )}
        {campaign.status === "SCHEDULED" && (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-500 text-white">오픈 예정</span>
        )}
        {discount > 0 && (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500 text-white">
            {discount}% OFF
          </span>
        )}
      </div>

      {/* 캠페인 정보 */}
      <div className="px-4 py-4">
        {/* 셀러 */}
        <Link
          href={`/shop/${campaign.seller.slug}`}
          className="inline-flex items-center gap-2 mb-3 hover:opacity-80"
        >
          <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-200 ring-2 ring-gray-100">
            <SafeImage src={campaign.seller.shopLogo} alt={campaign.seller.shopName} width={28} height={28} fallbackText="S" />
          </div>
          <span className="text-xs font-medium text-gray-600">{campaign.seller.shopName}</span>
        </Link>

        <h1 className="text-lg font-bold text-gray-900 leading-snug mb-3">
          {campaign.title}
        </h1>

        {/* 가격 */}
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <div className="flex items-baseline gap-2">
            {discount > 0 && (
              <span className="text-xl font-bold text-red-500">{discount}%</span>
            )}
            <span className="text-xl font-bold text-gray-900">
              {formatPrice(Number(campaign.campaignPrice))}
            </span>
          </div>
          {discount > 0 && (
            <p className="text-xs text-gray-400 line-through mt-1">
              정상가 {formatPrice(Number(campaign.originalPrice))}
            </p>
          )}
        </div>

        {/* 타이머 */}
        {isActive && (
          <div className="bg-red-50 rounded-xl p-3.5 mb-4 border border-red-100">
            <p className="text-[10px] text-red-600 font-semibold mb-1.5">마감까지 남은 시간</p>
            <CountdownTimer endDate={new Date(campaign.endDate)} />
          </div>
        )}

        {/* 진행 상태 */}
        {progress !== null && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1.5 text-xs">
              <span className="text-gray-500">달성률</span>
              <span className="font-bold text-red-500">{progress}%</span>
            </div>
            <div className="campaign-progress h-2.5">
              <div className="campaign-progress-bar" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between items-center mt-1.5 text-[10px] text-gray-400">
              <span>{campaign.currentQuantity}개 판매</span>
              <span>목표 {campaign.goalQuantity}개</span>
            </div>
          </div>
        )}

        {/* 참여 현황 (3열 그리드) */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-3 bg-gray-50 rounded-xl">
            <Icon name="Users" size={16} className="mx-auto text-gray-400 mb-1" />
            <p className="text-base font-bold text-gray-900">{campaign.participantCount}</p>
            <p className="text-[9px] text-gray-400">참여자</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-xl">
            <Icon name="Clock" size={16} className="mx-auto text-gray-400 mb-1" />
            <p className="text-base font-bold text-gray-900">
              {Math.max(0, Math.ceil((new Date(campaign.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}
            </p>
            <p className="text-[9px] text-gray-400">남은 일</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-xl">
            <Icon name="Chart" size={16} className="mx-auto text-gray-400 mb-1" />
            <p className="text-base font-bold text-gray-900">{discount}%</p>
            <p className="text-[9px] text-gray-400">할인율</p>
          </div>
        </div>

        {/* 옵션 선택 */}
        {campaign.product.variants.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">옵션 선택</p>
            <div className="flex flex-wrap gap-2">
              {campaign.product.variants.map((v) => (
                <button
                  key={v.id}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:border-black active:bg-gray-50 transition-colors"
                >
                  {v.name}
                  {v.stock <= 0 && (
                    <span className="text-xs text-gray-400 ml-1">(품절)</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 안내 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Icon name="Certified" size={14} />
            <span>안전한 결제 · 목표 미달 시 전액 환불</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Icon name="Truck" size={14} />
            <span>
              예상 배송일:{" "}
              {campaign.estimatedDelivery
                ? new Date(campaign.estimatedDelivery).toLocaleDateString("ko-KR")
                : "공동구매 종료 후 7일 이내"}
            </span>
          </div>
        </div>
      </div>

      <div className="h-2 bg-gray-50" />

      {/* ── Tabbed Detail / Reviews / Shipping Info ── */}
      <ProductDetailTabs
        description={campaign.description || campaign.product.description}
        detailContent={campaign.product.detailContent}
        reviewCount={campaign.product.reviews.length}
        reviewsHtml={reviewsHtml}
      />

      {/* 고정 하단 바 (구매 버튼) */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-gray-200 z-50 safe-area-bottom">
        <div className="flex items-center gap-2 p-3">
          <WishlistButton
            productId={campaign.productId}
            className="w-12 h-12 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500 hover:text-black transition-colors"
            size={22}
          />
          {isActive ? (
            <>
              <AddToCartButton
                productId={campaign.productId}
                sellerId={campaign.sellerId}
                campaignId={campaign.id}
                className="flex-1 h-12 border border-gray-900 text-gray-900 font-semibold text-sm rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center"
                label="장바구니"
              />
              <BuyNowButton
                productId={campaign.productId}
                sellerId={campaign.sellerId}
                campaignId={campaign.id}
                label="구매하기"
                price={formatPrice(Number(campaign.campaignPrice))}
              />
            </>
          ) : (
            <button
              className="flex-1 h-12 bg-gray-300 text-white font-semibold text-sm rounded-lg cursor-not-allowed flex items-center justify-center gap-1.5"
              disabled
            >
              <Icon name="Cart" size={16} /> 판매 종료
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
