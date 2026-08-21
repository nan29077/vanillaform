"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {Sparkles, X, Hash} from 'lucide-react';

interface ContentSearchHeaderProps {
  selectedCategory: string;
  selectedHashtag: string;
  categories: { label: string; value: string }[];
  popularHashtags: { tag: string; count: number }[];
}

export default function ContentSearchHeader({
  selectedCategory,
  selectedHashtag,
  categories,
  popularHashtags,
}: ContentSearchHeaderProps) {
  const router = useRouter();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = useCallback(() => {
    const q = searchQuery.trim();
    if (!q) return;
    // Treat search query as hashtag search
    const tag = q.startsWith("#") ? q : `#${q}`;
    router.push(`/content?hashtag=${encodeURIComponent(tag)}`);
    setShowSearch(false);
    setSearchQuery("");
  }, [searchQuery, router]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="sticky top-12 z-20 bg-white border-b border-gray-100">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-brand-500" />
            <h1 className="text-base font-bold text-gray-900">콘텐츠</h1>
          </div>
          <button
            onClick={() => {
              setShowSearch(!showSearch);
              if (showSearch) setSearchQuery("");
            }}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all flex-shrink-0 ${
              showSearch
                ? "bg-brand-100 text-brand-600"
                : "bg-gray-100 text-gray-400 hover:text-gray-600"
            }`}
            aria-label="해시태그 검색"
          >
            {showSearch ? <X size={16} strokeWidth={1.5} /> : <Icon name="Search" size={16} strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {/* 검색바 - 모바일 최적화 */}
      {showSearch && (
        <div className="px-4 pb-3">
          <div className="relative">
            <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="해시태그 검색... (예: 봄코디, 뷰티팁)"
              className="w-full pl-8 pr-16 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-300 focus:ring-1 focus:ring-brand-200 transition-all placeholder-gray-400"
              autoFocus
              style={{ fontSize: "16px", maxHeight: "40px" }}
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
              <button
                onClick={handleSearch}
                disabled={!searchQuery.trim()}
                className="px-2.5 py-1 text-xs font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                검색
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 카테고리 필터 탭 */}
      <div className="flex overflow-x-auto scrollbar-hide px-4 pb-2 gap-2">
        {categories.map((cat) => (
          <a
            key={cat.value}
            href={cat.value ? `/content?category=${encodeURIComponent(cat.value)}` : "/content"}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
              selectedCategory === cat.value && !selectedHashtag
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200 active:bg-gray-300"
            }`}
          >
            {cat.label}
          </a>
        ))}
      </div>

      {/* 인기 해시태그 */}
      {popularHashtags.length > 0 && (
        <div className="flex overflow-x-auto scrollbar-hide px-4 pb-2.5 gap-1.5">
          {popularHashtags.map(({ tag, count }) => (
            <a
              key={tag}
              href={`/content?hashtag=${encodeURIComponent(tag)}`}
              className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap ${
                (selectedHashtag.startsWith("#") ? selectedHashtag : `#${selectedHashtag}`) === tag
                  ? "bg-brand-600 text-white"
                  : "bg-brand-50 text-brand-600 hover:bg-brand-100 active:bg-brand-200"
              }`}
            >
              {tag}
              <span className="ml-0.5 text-[9px] opacity-70">{count}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
