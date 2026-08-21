"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useMemo } from "react";
import {List, X} from 'lucide-react';
import { cn } from "@/lib/utils";
import CampaignCard from "./CampaignCard";

type ViewMode = "card" | "list";
type TabType = "live" | "scheduled" | "ended";

interface CampaignData {
  id: string;
  title: string;
  campaignPrice: number;
  originalPrice: number;
  status: string;
  endDate: string;
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
}

interface CampaignListClientProps {
  live: CampaignData[];
  scheduled: CampaignData[];
  ended: CampaignData[];
}

export default function CampaignListClient({
  live,
  scheduled,
  ended,
}: CampaignListClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [activeTab, setActiveTab] = useState<TabType>("live");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const tabs: { key: TabType; label: string; count: number; dot?: boolean }[] = [
    { key: "live", label: "진행중", count: live.length, dot: true },
    { key: "scheduled", label: "오픈예정", count: scheduled.length },
    { key: "ended", label: "종료", count: ended.length },
  ];

  const rawList =
    activeTab === "live" ? live : activeTab === "scheduled" ? scheduled : ended;

  // Filter by search query
  const currentList = useMemo(() => {
    if (!searchQuery.trim()) return rawList;
    const q = searchQuery.trim().toLowerCase();
    return rawList.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.product.name.toLowerCase().includes(q) ||
        c.seller.shopName.toLowerCase().includes(q)
    );
  }, [rawList, searchQuery]);

  const toCampaign = (c: CampaignData) => ({
    ...c,
    endDate: new Date(c.endDate),
  });

  return (
    <div className="animate-fade-in pb-20">
      {/* ── 헤더 ── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Icon name="Cart" size={20} strokeWidth={1.5} className="text-brand-600 flex-shrink-0" />
              <h1 className="text-lg font-bold text-gray-900 truncate">공동구매</h1>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* 검색 토글 버튼 */}
              <button
                onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(""); }}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-lg transition-all",
                  showSearch
                    ? "bg-brand-100 text-brand-600"
                    : "bg-gray-100 text-gray-400 hover:text-gray-600"
                )}
                aria-label="검색"
              >
                {showSearch ? <X size={16} strokeWidth={1.5} /> : <Icon name="Search" size={16} strokeWidth={1.5} />}
              </button>
              {/* 뷰 모드 토글 */}
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("card")}
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-md transition-all",
                    viewMode === "card"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-400 hover:text-gray-600"
                  )}
                  aria-label="카드형 보기"
                >
                  <Icon name="Category" size={16} strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-md transition-all",
                    viewMode === "list"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-400 hover:text-gray-600"
                  )}
                  aria-label="리스트형 보기"
                >
                  <List size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>

          {/* ── 검색바 - 모바일 최적화 ── */}
          {showSearch && (
            <div className="mb-3 relative">
              <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="상품명, 라이브 셀러명으로 검색..."
                className="w-full pl-8 pr-8 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-300 focus:ring-1 focus:ring-brand-200 transition-all placeholder-gray-400"
                autoFocus
                style={{ fontSize: "16px", maxHeight: "40px" }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {/* ── 탭 ── */}
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all",
                  activeTab === tab.key
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                )}
              >
                {tab.dot && activeTab === tab.key && (
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                )}
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className={cn(
                      "text-xs",
                      activeTab === tab.key ? "text-gray-300" : "text-gray-400"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 검색 결과 표시 ── */}
      {searchQuery && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-700 truncate max-w-[60%]">&apos;{searchQuery}&apos;</span>
            <span className="text-xs text-gray-400 flex-shrink-0">{currentList.length}개의 결과</span>
            <button onClick={() => setSearchQuery("")} className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex-shrink-0">
              초기화
            </button>
          </div>
        </div>
      )}

      {/* ── 콘텐츠 ── */}
      <div className="px-4 pt-4">
        {currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Icon name="Cart" size={48} strokeWidth={1} className="mb-4 text-gray-200" />
            <p className="text-sm font-medium text-gray-500 mb-1">
              {searchQuery
                ? `'${searchQuery}' 검색 결과가 없습니다`
                : activeTab === "live"
                  ? "진행중인 공동구매가 없습니다"
                  : activeTab === "scheduled"
                    ? "오픈 예정인 공동구매가 없습니다"
                    : "종료된 공동구매가 없습니다"}
            </p>
            <p className="text-xs text-gray-400">
              {searchQuery ? "다른 검색어를 시도해보세요" : "새로운 딜이 곧 오픈됩니다!"}
            </p>
          </div>
        ) : viewMode === "card" ? (
          /* ── 카드형 (2열 그리드) ── */
          <div className="grid grid-cols-2 gap-3">
            {currentList.map((c) => (
              <CampaignCard key={c.id} campaign={toCampaign(c)} variant="default" />
            ))}
          </div>
        ) : (
          /* ── 리스트형 ── */
          <div className="space-y-2">
            {currentList.map((c) => (
              <CampaignCard key={c.id} campaign={toCampaign(c)} variant="list" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
