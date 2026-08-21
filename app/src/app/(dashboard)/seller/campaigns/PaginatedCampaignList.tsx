"use client";

import { formatPrice, getProgressPercent } from "@/lib/utils";
import Pagination, { usePagination } from "@/components/shared/Pagination";

// 서버(page.tsx)에서 직렬화되어 전달되는 캠페인 행 데이터
interface CampaignItem {
  id: string;
  title: string;
  status: string;
  campaignPrice: number;
  participantCount: number;
  currentQuantity: number;
  goalQuantity: number | null;
  product: { name: string };
}

// 공동구매 목록 — 페이지당 20개씩 클라이언트 페이지네이션
export default function PaginatedCampaignList({ campaigns, label }: { campaigns: CampaignItem[]; label: string }) {
  const { pageItems, page, setPage, totalPages } = usePagination(campaigns, 20);

  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold text-gray-700 mb-3">{label} ({campaigns.length})</h3>
      <div className="space-y-3">
        {pageItems.map((c) => {
          const progress = c.goalQuantity ? getProgressPercent(c.currentQuantity, c.goalQuantity) : 0;
          return (
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.title}</p>
                  <p className="text-[11px] text-gray-400">{c.product.name}</p>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  c.status === "ACTIVE" ? "bg-red-50 text-red-600"
                  : c.status === "SCHEDULED" ? "bg-blue-50 text-blue-600"
                  : c.status === "SUCCESS" ? "bg-green-50 text-green-600"
                  : "bg-gray-100 text-gray-500"
                }`}>
                  {c.status === "ACTIVE" ? "진행중" : c.status === "SCHEDULED" ? "예정" : c.status === "SUCCESS" ? "성공" : c.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <p className="text-xs font-bold text-gray-900">{formatPrice(Number(c.campaignPrice))}</p>
                  <p className="text-[9px] text-gray-400">판매가</p>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <p className="text-xs font-bold text-gray-900">{c.participantCount}명</p>
                  <p className="text-[9px] text-gray-400">참여자</p>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <p className="text-xs font-bold text-brand-600">{progress}%</p>
                  <p className="text-[9px] text-gray-400">달성률</p>
                </div>
              </div>
              {c.goalQuantity && (
                <div className="campaign-progress h-1.5">
                  <div className="campaign-progress-bar" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
