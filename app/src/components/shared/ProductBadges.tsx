"use client";

const BADGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  FREE_SHIPPING: { label: "무료배송", color: "text-white", bg: "bg-blue-500" },
  CONDITIONAL_FREE_SHIPPING: { label: "조건부무료배송", color: "text-white", bg: "bg-cyan-500" },
  NEW: { label: "NEW", color: "text-white", bg: "bg-emerald-500" },
  BEST: { label: "BEST", color: "text-white", bg: "bg-orange-500" },
  HOT_DEAL: { label: "특가", color: "text-white", bg: "bg-red-500" },
  LIMITED: { label: "한정", color: "text-white", bg: "bg-purple-500" },
  ECO: { label: "친환경", color: "text-white", bg: "bg-green-600" },
  HANDMADE: { label: "핸드메이드", color: "text-white", bg: "bg-amber-500" },
};

interface ProductBadgesProps {
  badges: string | null;
  className?: string;
  maxShow?: number;
}

export default function ProductBadges({ badges, className = "", maxShow = 3 }: ProductBadgesProps) {
  if (!badges) return null;

  let badgeList: string[];
  try {
    badgeList = JSON.parse(badges);
    if (!Array.isArray(badgeList) || badgeList.length === 0) return null;
  } catch {
    return null;
  }

  const visibleBadges = badgeList.slice(0, maxShow);

  return (
    <div className={`flex flex-wrap gap-0.5 ${className}`}>
      {visibleBadges.map((badge) => {
        const config = BADGE_CONFIG[badge];
        if (!config) return null;
        return (
          <span
            key={badge}
            className={`${config.bg} ${config.color} text-[8px] font-bold px-1.5 py-0.5 rounded leading-none`}
          >
            {config.label}
          </span>
        );
      })}
    </div>
  );
}
