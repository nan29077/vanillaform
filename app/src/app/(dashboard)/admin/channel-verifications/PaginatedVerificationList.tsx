"use client";

import { Icon } from "@/components/shared/Icon";
import SafeImage from "@/components/shared/SafeImage";
import { pickBuyerAvatar } from "@/lib/defaults";
import ChannelVerificationActions from "@/components/shared/ChannelVerificationActions";
import ScreenshotThumbnail from "@/components/shared/ScreenshotThumbnail";
import Pagination, { usePagination } from "@/components/shared/Pagination";

// 순수 표현용 헬퍼 (채널 라벨/색상)
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

// 승인 대기 행
function PendingRow({ v }: { v: any }) {
  return (
    <div key={v.id} className="flex items-center gap-3 px-4 py-3.5">
      {/* 구매자 */}
      <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
        <SafeImage src={v.buyer.user.avatar || pickBuyerAvatar(v.buyer.user.id)} alt={v.buyer.user.name} width={36} height={36} fallbackText={v.buyer.user.name.charAt(0)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-900">{v.buyer.user.name}</p>
          <span className="text-[9px] text-gray-400">→</span>
          <span className="text-xs text-gray-600 font-medium">{v.seller.shopName}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${channelColors[v.channelType] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
            {channelLabels[v.channelType] || v.channelType}
          </span>
          <span className="text-[10px] text-gray-400">
            {new Date(v.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
      {/* 캡쳐 보기 */}
      {v.screenshotUrl && (
        <ScreenshotThumbnail src={v.screenshotUrl} />
      )}
      {/* 승인/거부 */}
      <ChannelVerificationActions verificationId={v.id} />
    </div>
  );
}

// 처리 완료 행 (승인/거부)
function CompletedRow({ v }: { v: any }) {
  return (
    <div key={v.id} className="flex items-center gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
        <SafeImage src={v.buyer.user.avatar} alt={v.buyer.user.name} width={32} height={32} fallbackText={v.buyer.user.name.charAt(0)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-700">{v.buyer.user.name}</p>
          <span className="text-[9px] text-gray-400">→</span>
          <span className="text-xs text-gray-500">{v.seller.shopName}</span>
        </div>
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
  );
}

/**
 * SNS구독 인증 목록을 페이지당 20개씩 페이지네이션하여 렌더링하는 클라이언트 컴포넌트.
 * variant="pending"  → 승인 대기 행(캡쳐 보기 + 승인/거부 액션)
 * variant="completed" → 처리 완료 행(승인/거부 배지)
 */
export default function PaginatedVerificationList({
  items,
  variant,
}: {
  items: any[];
  variant: "pending" | "completed";
}) {
  const { pageItems, page, setPage, totalPages } = usePagination(items, 20);

  return (
    <>
      <div className="divide-y divide-gray-50">
        {pageItems.map((v: any) =>
          variant === "pending" ? <PendingRow key={v.id} v={v} /> : <CompletedRow key={v.id} v={v} />
        )}
      </div>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </>
  );
}
