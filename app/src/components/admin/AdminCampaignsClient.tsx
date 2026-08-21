"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useMemo } from "react";
import {X} from 'lucide-react';
import { formatPrice, getProgressPercent } from "@/lib/utils";
import Pagination, { usePagination } from "@/components/shared/Pagination";

interface Campaign {
  id: string;
  title: string;
  status: string;
  campaignPrice: number;
  participantCount: number;
  currentQuantity: number;
  goalQuantity: number | null;
  totalRevenue: number;
  sellerName: string;
  productName: string;
  brandName: string | null;
  thumbnail: string | null;
  createdAt: string;
}

export default function AdminCampaignsClient({ campaigns }: { campaigns: Campaign[] }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return campaigns;
    const q = searchQuery.toLowerCase();
    return campaigns.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.sellerName.toLowerCase().includes(q) ||
        c.productName.toLowerCase().includes(q) ||
        (c.brandName && c.brandName.toLowerCase().includes(q))
    );
  }, [campaigns, searchQuery]);

  const { pageItems, page, setPage, totalPages } = usePagination(filtered, 20);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">공동구매 관리</h1>
          <p className="text-sm text-gray-500">총 {campaigns.length}개</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="캠페인명, 라이브 셀러, 상품, 브랜드 검색..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Icon name="Cart" size={48} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{searchQuery ? "검색 결과가 없습니다." : "등록된 공동구매가 없습니다."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pageItems.map((c) => {
            const progress = c.goalQuantity ? getProgressPercent(c.currentQuantity, c.goalQuantity) : 0;
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium">
                        라이브 셀러: {c.sellerName}
                      </span>
                      {c.brandName && (
                        <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded font-medium">
                          브랜드: {c.brandName}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-500">{c.productName}</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                    c.status === "ACTIVE" ? "bg-red-50 text-red-600"
                    : c.status === "SCHEDULED" ? "bg-blue-50 text-blue-600"
                    : c.status === "SUCCESS" ? "bg-green-50 text-green-600"
                    : "bg-gray-100 text-gray-500"
                  }`}>
                    {c.status === "ACTIVE" ? "진행중" : c.status === "SCHEDULED" ? "예정" : c.status === "SUCCESS" ? "성공" : c.status}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <p className="text-xs font-bold">{formatPrice(c.campaignPrice)}</p>
                    <p className="text-[9px] text-gray-400">판매가</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <p className="text-xs font-bold">{c.participantCount}명</p>
                    <p className="text-[9px] text-gray-400">참여</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <p className="text-xs font-bold text-brand-600">{progress}%</p>
                    <p className="text-[9px] text-gray-400">달성</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <p className="text-xs font-bold">{formatPrice(c.totalRevenue)}</p>
                    <p className="text-[9px] text-gray-400">매출</p>
                  </div>
                </div>
              </div>
            );
          })}
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </>
  );
}
