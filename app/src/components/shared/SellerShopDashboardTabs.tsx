"use client";

import { useState } from "react";
import { Store, Radio, Star, Package } from "lucide-react";
import SellerReviewManager from "@/components/shared/SellerReviewManager";
import ShopDirectExposureManager from "@/components/shared/ShopDirectExposureManager";

const TABS = [
  { key: "basic", label: "기본 정보", icon: Store },
  { key: "live", label: "라이브 설정", icon: Radio },
  { key: "direct", label: "일반상품", icon: Package },
  { key: "reviews", label: "리뷰 관리", icon: Star },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface Props {
  basicContent: React.ReactNode;
  liveContent: React.ReactNode;
}

export default function SellerShopDashboardTabs({ basicContent, liveContent }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("basic");

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg sm:text-xl font-bold text-gray-900">샵 관리</h1>
        <p className="text-xs sm:text-sm text-gray-500">샵 정보, 라이브 설정, 리뷰를 관리합니다</p>
      </div>

      {/* 탭 헤더 */}
      <div className="flex items-center gap-1 mb-5 border-b border-gray-100 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              activeTab === key
                ? "border-brand-500 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <Icon size={14} strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === "basic" && <div className="animate-fade-in">{basicContent}</div>}
      {activeTab === "live" && <div className="animate-fade-in">{liveContent}</div>}
      {activeTab === "direct" && (
        <div className="animate-fade-in">
          <ShopDirectExposureManager />
        </div>
      )}
      {activeTab === "reviews" && (
        <div className="animate-fade-in">
          <SellerReviewManager />
        </div>
      )}
    </div>
  );
}
