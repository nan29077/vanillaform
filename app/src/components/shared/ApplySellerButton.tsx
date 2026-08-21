"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {Loader2} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";

// 구매자 마이페이지: "셀러로 입점 신청하기" 버튼.
// - 미신청: /seller-apply 페이지로 이동
// - 신청 완료(대기 중): 상태 표시
export default function ApplySellerButton({ initialApplied }: { initialApplied: boolean }) {
  const [applied] = useState(initialApplied);

  if (applied) {
    return (
      <div className="w-full flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3.5">
        <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center text-black flex-shrink-0">
          <Icon name="Clock" size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">라이브 셀러 입점 신청 완료</p>
          <p className="text-[11px] text-gray-500 mt-0.5">최고관리자 승인 후 라이브 셀러 기능이 활성화돼요</p>
        </div>
      </div>
    );
  }

  return (
    <Link
      href="/seller-apply"
      className="w-full flex items-center gap-3 rounded-2xl border border-gray-900 bg-gray-900 text-white px-4 py-3.5 active:scale-[0.99] transition-transform"
    >
      <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center text-black flex-shrink-0">
        <Icon name="Store" size={16} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-bold">라이브 셀러로 입점 신청하기</p>
        <p className="text-[11px] text-white/60 mt-0.5">내 팬과 함께 나만의 샵을 열어보세요</p>
      </div>
      <Icon name="ChevronDown" size={18} className="text-white/50 flex-shrink-0 -rotate-90" />
    </Link>
  );
}
