"use client";

import { Icon } from "@/components/shared/Icon";
import FanPurchaseHistory from "@/components/shared/FanPurchaseHistory";
import FanMemberInfo from "@/components/shared/FanMemberInfo";
import Pagination, { usePagination } from "@/components/shared/Pagination";
import SignupBadges from "@/components/shared/SignupBadges";
import { pickBuyerAvatar } from "@/lib/defaults";

// 서버(page.tsx)에서 직렬화되어 전달되는 팬 행 데이터
interface FanItem {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  birthday: string | null;
  avatar: string | null;
  joinedAt: string;
  orderCount: number;
  authProviders?: string[];
  isPick: boolean;
  isVerified: boolean;
  isReferred: boolean;
  isPrimary: boolean;
}

// 픽 팬(통합 리스트) — 페이지당 20명씩 클라이언트 페이지네이션
export default function PaginatedFansList({ items }: { items: FanItem[] }) {
  const { pageItems, page, setPage, totalPages } = usePagination(items, 20);

  return (
    <>
      <div className="divide-y divide-gray-50">
        {pageItems.map((fan) => (
          <div key={fan.userId} className="flex items-center gap-3 px-4 py-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
              <img src={fan.avatar || pickBuyerAvatar(fan.userId, fan.gender)} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-medium text-gray-900">{fan.name}</p>
                {fan.isPrimary && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium">주력팬</span>
                )}
                {fan.isPick && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-600 font-medium">Pick</span>
                )}
                {fan.isVerified ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">채널인증</span>
                ) : fan.isPick ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">인증대기</span>
                ) : null}
                {fan.isReferred && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600 font-medium">추천인</span>
                )}
                <SignupBadges providers={fan.authProviders} />
              </div>
              <p className="text-[10px] text-gray-400 truncate">{fan.phone ? `${fan.email} · ${fan.phone}` : fan.email}</p>
            </div>
            <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
              <p className="text-[10px] text-gray-400">{new Date(fan.joinedAt).toLocaleDateString("ko-KR")} 가입</p>
              <div className="flex items-center gap-1.5">
                <FanPurchaseHistory userId={fan.userId} userName={fan.name} orderCount={fan.orderCount} variant="compact" />
                <FanMemberInfo
                  userId={fan.userId}
                  name={fan.name}
                  email={fan.email}
                  phone={fan.phone}
                  joinedAt={new Date(fan.joinedAt).toISOString()}
                  avatar={fan.avatar}
                  gender={fan.gender}
                  birthday={fan.birthday}
                  authProviders={fan.authProviders}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </>
  );
}
