"use client";

import { useState } from "react";
import { Icon } from '@/components/shared/Icon';
import BannerManager from "@/components/admin/BannerManager";
import HomeContentManager from "@/components/admin/HomeContentManager";
import SocialLinksManager from "@/components/admin/SocialLinksManager";
import FooterManager from "@/components/admin/FooterManager";
import FooterContentManager from "@/components/admin/FooterContentManager";
import FaviconManager from "@/components/admin/FaviconManager";
import ShopPolicyManager from "@/components/admin/ShopPolicyManager";
import type { SocialLinks } from "@/lib/featureFlags";
import type { FooterSettings } from "@/lib/settings";
import type { HomeBenefits } from "@/lib/siteContent";

type Banner = React.ComponentProps<typeof BannerManager>["initialBanners"];
type HomeStat = { value: string; label: string };
type HomeStory = { name: string; quote: string; metric: string; avatar: string };

type TabKey = "banners" | "favicon" | "home" | "social" | "footer" | "footer-content" | "policy";

export default function SiteManager({
  initialBanners,
  initialStats,
  initialStories,
  initialBenefits,
  initialSocialLinks,
  initialFooterSettings,
}: {
  initialBanners: Banner;
  initialStats: HomeStat[];
  initialStories: HomeStory[];
  initialBenefits: HomeBenefits;
  initialSocialLinks: SocialLinks;
  initialFooterSettings: FooterSettings;
}) {
  const [tab, setTab] = useState<TabKey>("banners");

  const tabs: { key: TabKey; iconName: string; label: string }[] = [
    { key: "banners",       iconName: "Megaphone",       label: "배너 관리" },
    { key: "favicon",       iconName: "Camera",          label: "파비콘" },
    { key: "home",          iconName: "Home",            label: "메인페이지" },
    { key: "social",        iconName: "Globe",           label: "소셜 링크" },
    { key: "footer",        iconName: "Warehouse",       label: "푸터 관리" },
    { key: "footer-content",iconName: "File",            label: "푸터 콘텐츠" },
    { key: "policy",        iconName: "Certified",       label: "셀러샵 정책" },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg sm:text-xl font-bold text-gray-900">사이트 관리</h1>
        <p className="text-xs sm:text-sm text-gray-500">배너, 파비콘, 메인페이지 콘텐츠, 소셜 링크, 푸터를 관리합니다</p>
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-1 mb-5 border-b border-gray-100 overflow-x-auto">
        {tabs.map(({ key, iconName, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === key ? "border-brand-500 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <Icon name={iconName} size={14} className={tab === key ? "" : "opacity-60"} /> {label}
          </button>
        ))}
      </div>

      {tab === "banners" ? (
        <BannerManager initialBanners={initialBanners} />
      ) : tab === "favicon" ? (
        <FaviconManager />
      ) : tab === "home" ? (
        <HomeContentManager
          initialStats={initialStats}
          initialStories={initialStories}
          initialBenefits={initialBenefits}
        />
      ) : tab === "social" ? (
        <SocialLinksManager initialLinks={initialSocialLinks} />
      ) : tab === "footer" ? (
        <FooterManager initialSettings={initialFooterSettings} />
      ) : tab === "footer-content" ? (
        <FooterContentManager />
      ) : (
        <ShopPolicyManager />
      )}
    </div>
  );
}
