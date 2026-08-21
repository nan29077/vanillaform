import { Icon } from '@/components/shared/Icon';
import Link from "next/link";
import { cn, formatPrice, formatDiscount, getProgressPercent } from "@/lib/utils";
import CountdownTimer from "./CountdownTimer";
import SafeImage from "./SafeImage";
;

interface CampaignCardProps {
  campaign: {
    id: string;
    title: string;
    campaignPrice: number;
    originalPrice: number;
    status: string;
    endDate: Date;
    currentQuantity: number;
    goalQuantity: number | null;
    participantCount: number;
    bannerImage: string | null;
    seller: {
      slug: string;
      shopName: string;
      shopLogo: string | null;
    };
    product: {
      name: string;
      thumbnail: string | null;
    };
  };
  variant?: "default" | "compact" | "featured" | "list";
}

export default function CampaignCard({
  campaign,
  variant = "default",
}: CampaignCardProps) {
  const discount = formatDiscount(campaign.originalPrice, campaign.campaignPrice);
  const progress = campaign.goalQuantity
    ? getProgressPercent(campaign.currentQuantity, campaign.goalQuantity)
    : null;
  const isActive = campaign.status === "ACTIVE";
  const isScheduled = campaign.status === "SCHEDULED";
  const imageUrl = campaign.bannerImage || campaign.product.thumbnail;

  /* ────────────────── LIST variant ────────────────── */
  if (variant === "list") {
    return (
      <Link
        href={`/campaigns/${campaign.id}`}
        className="group flex gap-3 p-3 bg-white rounded-xl card-hover"
      >
        {/* 썸네일 */}
        <div className="relative w-28 h-28 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
          <SafeImage
            src={imageUrl}
            alt={campaign.title}
            width={112}
            height={112}
            fallbackText={campaign.product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* 상태 배지 */}
          <div className="absolute top-1.5 left-1.5">
            {isActive && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-white shadow-sm">
                <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
                진행중
              </span>
            )}
            {isScheduled && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-500 text-white shadow-sm">
                오픈예정
              </span>
            )}
          </div>
        </div>

        {/* 정보 */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div>
            {/* 셀러 */}
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-4 h-4 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-gray-200">
                <SafeImage
                  src={campaign.seller.shopLogo}
                  alt=""
                  width={16}
                  height={16}
                  fallbackText={campaign.seller.shopName.charAt(0)}
                />
              </div>
              <span className="text-[11px] text-gray-500 truncate">
                {campaign.seller.shopName}
              </span>
            </div>

            {/* 제목 */}
            <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug mb-1.5">
              {campaign.title}
            </h3>

            {/* 가격 */}
            <div className="flex items-baseline gap-1.5">
              {discount > 0 && (
                <span className="text-sm font-bold text-brand-600">{discount}%</span>
              )}
              <span className="text-sm font-bold text-gray-900">
                {formatPrice(campaign.campaignPrice)}
              </span>
              {discount > 0 && (
                <span className="text-[11px] text-gray-400 line-through">
                  {formatPrice(campaign.originalPrice)}
                </span>
              )}
            </div>
          </div>

          {/* 하단: 참여자 & 타이머 */}
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              <span className="flex items-center gap-0.5">
                <Icon name="Users" size={11} strokeWidth={1.5} />
                {campaign.participantCount}명
              </span>
              {progress !== null && (
                <span className="flex items-center gap-0.5">
                  <Icon name="Chart" size={11} strokeWidth={1.5} />
                  {progress}%
                </span>
              )}
            </div>
            {isActive && (
              <CountdownTimer endDate={campaign.endDate} compact className="text-[11px]" />
            )}
          </div>
        </div>
      </Link>
    );
  }

  /* ────────────────── FEATURED variant ────────────────── */
  if (variant === "featured") {
    return (
      <Link
        href={`/campaigns/${campaign.id}`}
        className="group relative block overflow-hidden rounded-2xl bg-gray-100 aspect-[3/4] card-hover"
      >
        <SafeImage
          src={imageUrl}
          alt={campaign.title}
          width={400}
          height={500}
          fallbackText={campaign.product.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        
        {/* Badges - 진행 중 */}
        <div className="absolute top-4 left-4 flex gap-2">
          {isActive && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-lg">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              진행중
            </span>
          )}
          {discount > 0 && (
            <span className="px-2 py-1 rounded-full text-xs font-bold bg-brand-600 text-white shadow-lg">
              {discount}%
            </span>
          )}
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-white/20 overflow-hidden ring-1 ring-white/30">
              <SafeImage
                src={campaign.seller.shopLogo}
                alt=""
                width={24}
                height={24}
                fallbackText={campaign.seller.shopName.charAt(0)}
              />
            </div>
            <span className="text-xs font-medium text-white/80">
              {campaign.seller.shopName}
            </span>
          </div>

          <h3 className="text-lg font-semibold text-white mb-2 truncate">
            {campaign.title}
          </h3>

          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-xl font-bold text-white">
              {formatPrice(campaign.campaignPrice)}
            </span>
            {discount > 0 && (
              <span className="text-sm text-white/50 line-through">
                {formatPrice(campaign.originalPrice)}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-white/70">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Icon name="Users" size={12} strokeWidth={1.5} />
                {campaign.participantCount}명 참여
              </span>
              {progress !== null && (
                <span className="flex items-center gap-1">
                  <Icon name="Chart" size={12} strokeWidth={1.5} />
                  {progress}% 달성
                </span>
              )}
            </div>
            {isActive && (
              <CountdownTimer endDate={campaign.endDate} compact />
            )}
          </div>
        </div>
      </Link>
    );
  }

  /* ────────────────── DEFAULT (card) variant ────────────────── */
  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="group block card-hover rounded-xl overflow-hidden bg-white"
    >
      {/* Image */}
      <div className="relative aspect-[4/5] overflow-hidden bg-gray-100">
        <SafeImage
          src={imageUrl}
          alt={campaign.title}
          width={300}
          height={375}
          fallbackText={campaign.product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          {isActive && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white shadow-sm">
              <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
              진행중
            </span>
          )}
          {isScheduled && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white shadow-sm">
              오픈예정
            </span>
          )}
          {discount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-600 text-white shadow-sm">
              {discount}%
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="w-4 h-4 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-gray-200">
            <SafeImage
              src={campaign.seller.shopLogo}
              alt=""
              width={16}
              height={16}
              fallbackText={campaign.seller.shopName.charAt(0)}
            />
          </div>
          <span className="text-[11px] text-gray-500 truncate">
            {campaign.seller.shopName}
          </span>
        </div>

        <h3 className="text-sm font-medium text-gray-900 truncate mb-2">
          {campaign.title}
        </h3>

        <div className="flex items-baseline gap-1.5 mb-2">
          {discount > 0 && (
            <span className="text-sm font-bold text-brand-600">{discount}%</span>
          )}
          <span className="text-sm font-bold text-gray-900">
            {formatPrice(campaign.campaignPrice)}
          </span>
          {discount > 0 && (
            <span className="text-xs text-gray-400 line-through">
              {formatPrice(campaign.originalPrice)}
            </span>
          )}
        </div>

        {/* Progress */}
        {progress !== null && (
          <div className="mb-2">
            <div className="campaign-progress">
              <div
                className="campaign-progress-bar"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-1 text-[10px] text-gray-400">
              <span>{campaign.participantCount}명 참여</span>
              <span>{progress}% 달성</span>
            </div>
          </div>
        )}

        {/* Timer */}
        {isActive && (
          <CountdownTimer endDate={campaign.endDate} compact className="text-xs" />
        )}
      </div>
    </Link>
  );
}
