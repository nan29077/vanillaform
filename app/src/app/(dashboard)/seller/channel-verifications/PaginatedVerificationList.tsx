"use client";

import { Icon } from "@/components/shared/Icon";
import SafeImage from "@/components/shared/SafeImage";
import { pickBuyerAvatar } from "@/lib/defaults";
import ChannelVerificationActions from "@/components/shared/ChannelVerificationActions";
import ScreenshotThumbnail from "@/components/shared/ScreenshotThumbnail";
import Pagination, { usePagination } from "@/components/shared/Pagination";

const channelLabels: Record<string, string> = {
  youtube: "유튜브",
  instagram: "인스타그램",
  tiktok: "틱톡",
  facebook: "페이스북",
  twitter: "X(트위터)",
};

const channelColors: Record<string, string> = {
  youtube: "bg-red-50 text-red-600 border-red-200",
  instagram: "bg-pink-50 text-pink-600 border-pink-200",
  tiktok: "bg-gray-900 text-white border-gray-700",
  facebook: "bg-blue-50 text-blue-600 border-blue-200",
  twitter: "bg-sky-50 text-sky-600 border-sky-200",
};

// 승인 대기 목록 — 페이지당 20건씩 클라이언트 페이지네이션 (승인/거절 액션 포함)
export function PaginatedPendingList({ items }: { items: any[] }) {
  const { pageItems, page, setPage, totalPages } = usePagination(items, 20);

  return (
    <>
      <div className="divide-y divide-gray-50">
        {pageItems.map((v) => (
          <div key={v.id} className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
              <SafeImage src={v.buyer.user.avatar || pickBuyerAvatar(v.buyer.user.id)} alt={v.buyer.user.name} width={36} height={36} fallbackText={v.buyer.user.name.charAt(0)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{v.buyer.user.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${channelColors[v.channelType] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                  {channelLabels[v.channelType] || v.channelType}
                </span>
                <span className="text-[10px] text-gray-400">
                  {new Date(v.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
            {v.screenshotUrl && (
              <ScreenshotThumbnail src={v.screenshotUrl} />
            )}
            <ChannelVerificationActions verificationId={v.id} />
          </div>
        ))}
      </div>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </>
  );
}

// 처리 완료 목록(승인 + 거절) — 페이지당 20건씩 클라이언트 페이지네이션
export function PaginatedProcessedList({ items }: { items: any[] }) {
  const { pageItems, page, setPage, totalPages } = usePagination(items, 20);

  return (
    <>
      <div className="divide-y divide-gray-50">
        {pageItems.map((v) => (
          <div key={v.id} className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
              <SafeImage src={v.buyer.user.avatar || pickBuyerAvatar(v.buyer.user.id)} alt={v.buyer.user.name} width={32} height={32} fallbackText={v.buyer.user.name.charAt(0)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700">{v.buyer.user.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${channelColors[v.channelType] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                  {channelLabels[v.channelType] || v.channelType}
                </span>
                {v.verifiedAt && (
                  <span className="text-[10px] text-gray-400">
                    {new Date(v.verifiedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
            </div>
            {v.status === "APPROVED" ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full font-medium">
                <Icon name="Check" size={12} /> 승인
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-red-500 bg-red-50 px-2 py-1 rounded-full font-medium">
                <Icon name="Close" size={12} /> 거부
              </span>
            )}
          </div>
        ))}
      </div>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </>
  );
}
