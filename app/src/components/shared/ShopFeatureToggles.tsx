"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { useRouter } from "next/navigation";
import {ShoppingBag, Sparkles, Radio, Loader2} from 'lucide-react';

interface ShopFeatureTogglesProps {
  initialFeatures: {
    groupBuy: boolean;
    content: boolean;
    liveCommerce: boolean;
  };
  // 최고관리자 권한설정(Phase1) 전역 토글. OFF인 기능은 셀러 샵기능관리에서도 숨긴다(토글 존중).
  adminFlags?: {
    groupBuy: boolean;
    content: boolean;
    liveCommerce: boolean;
  };
}

export default function ShopFeatureToggles({ initialFeatures, adminFlags }: ShopFeatureTogglesProps) {
  const admin = adminFlags ?? { groupBuy: true, content: true, liveCommerce: true };
  const [features, setFeatures] = useState(initialFeatures);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const toggleFeature = async (feature: keyof typeof features) => {
    const newFeatures = { ...features, [feature]: !features[feature] };
    setFeatures(newFeatures);
    setSaving(true);
    try {
      await fetch("/api/seller/shop-features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFeatures),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      router.refresh();
    } catch {} finally {
      setSaving(false);
    }
  };

  const featureList = [
    {
      key: "groupBuy" as const,
      label: "공동구매",
      description: "팬들과 함께하는 공동구매 캠페인",
      icon: ShoppingBag,
      color: "text-purple-500",
      bgColor: "bg-purple-50",
      activeRing: "ring-purple-200",
    },
    {
      key: "content" as const,
      label: "콘텐츠",
      description: "스타일링, 룩북 콘텐츠 관리",
      icon: Sparkles,
      color: "text-amber-500",
      bgColor: "bg-amber-50",
      activeRing: "ring-amber-200",
    },
    {
      key: "liveCommerce" as const,
      label: "라이브 커머스",
      description: "실시간 라이브 방송으로 판매",
      icon: Radio,
      color: "text-red-500",
      bgColor: "bg-red-50",
      activeRing: "ring-red-200",
    },
  ];

  // 최고관리자가 끈 기능은 셀러 화면에서도 숨긴다(토글 존중)
  const visibleList = featureList.filter((f) => admin[f.key]);
  const hiddenByAdmin = featureList.filter((f) => !admin[f.key]);

  // Determine active combination for display
  const activeFeatures = visibleList.filter(f => features[f.key]);
  const activeCount = activeFeatures.length;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">샵 기능 관리</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            활성화된 기능만 샵에 표시됩니다
          </p>
        </div>
        {saving ? (
          <Loader2 size={14} className="animate-spin text-gray-400" />
        ) : saved ? (
          <span className="text-[11px] text-green-600 flex items-center gap-1">
            <Icon name="Check" size={12} /> 저장됨
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        {visibleList.map((feature) => {
          const isActive = features[feature.key];
          const Icon = feature.icon;
          return (
            <button
              key={feature.key}
              type="button"
              onClick={() => toggleFeature(feature.key)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                isActive
                  ? `border-gray-200 bg-white ring-1 ${feature.activeRing}`
                  : "border-gray-100 bg-gray-50/50 opacity-60"
              }`}
            >
              <div className={`w-9 h-9 rounded-lg ${isActive ? feature.bgColor : "bg-gray-100"} flex items-center justify-center flex-shrink-0`}>
                <Icon size={16} className={isActive ? feature.color : "text-gray-400"} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] font-medium ${isActive ? "text-gray-900" : "text-gray-500"}`}>
                  {feature.label}
                </p>
                <p className="text-[10px] text-gray-400">{feature.description}</p>
                {feature.key === "liveCommerce" && (
                  <p className="text-[10px] text-blue-500 mt-0.5">
                    이 스위치를 켜야 현재 라이브 중인 상품이 라이브 셀러샵에 표시됩니다.
                  </p>
                )}
              </div>
              {/* Toggle Switch */}
              <div className={`relative w-10 rounded-full transition-colors flex-shrink-0 ${
                isActive ? "bg-brand-600" : "bg-gray-300"
              }`} style={{ height: "22px" }}>
                <div className={`absolute rounded-full bg-white shadow-sm transition-transform`} style={{ width: "18px", height: "18px", top: "2px", left: "2px", transform: isActive ? "translateX(18px)" : "translateX(0)" }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* 관리자가 끈 기능 안내 */}
      {hiddenByAdmin.length > 0 && (
        <p className="text-[10px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
          {hiddenByAdmin.map((f) => f.label).join(", ")} 기능은 현재 운영 정책으로 비활성화되어 있어 샵에 표시되지 않습니다.
        </p>
      )}

      {/* Active Features Summary */}
      {activeCount > 0 && (
        <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[11px] text-gray-500 font-medium">
            활성 기능: {activeFeatures.map((f) => f.label).join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}
