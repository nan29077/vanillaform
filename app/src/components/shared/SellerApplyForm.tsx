"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { useRouter } from "next/navigation";
import {Loader2} from 'lucide-react';
import Link from "next/link";
import { useAppDialog } from "@/components/shared/AppDialog";

interface Props {
  initialApplied: boolean;
  initialApproved: boolean;
  isLoggedIn: boolean;
}

export default function SellerApplyForm({ initialApplied, initialApproved, isLoggedIn }: Props) {
  const router = useRouter();
  const { appConfirm, appAlert } = useAppDialog();
  const [applied, setApplied] = useState(initialApplied);
  const [approved, setApproved] = useState(initialApproved);
  const [loading, setLoading] = useState(false);

  // 비로그인
  if (!isLoggedIn) {
    return (
      <Link
        href="/auth/register?type=seller"
        className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-gray-900 text-white text-[14px] font-extrabold active:scale-[0.99] transition-transform"
      >
        회원가입하고 신청하기 <Icon name="ChevronDown" size={17} className="-rotate-90" />
      </Link>
    );
  }

  // 이미 승인됨
  if (approved) {
    return (
      <div className="w-full flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white flex-shrink-0">
          <Icon name="Check" size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-gray-900">라이브 셀러 승인 완료!</p>
          <p className="text-[11px] text-gray-500 mt-0.5">라이브 셀러 대시보드에서 샵을 운영해보세요.</p>
        </div>
        <Link href="/seller" className="text-[12px] font-bold text-emerald-700 flex items-center gap-0.5 flex-shrink-0">
          대시보드 <Icon name="ChevronDown" size={14} className="-rotate-90" />
        </Link>
      </div>
    );
  }

  // 이미 신청함 (승인 대기 중)
  if (applied) {
    return (
      <div className="w-full flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-4">
        <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-black flex-shrink-0">
          <Icon name="Clock" size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-gray-900">신청 접수 완료</p>
          <p className="text-[11px] text-gray-500 mt-0.5">최고관리자 승인 후 라이브 셀러 기능이 활성화돼요.</p>
        </div>
      </div>
    );
  }

  // 신청 가능
  const handleApply = async () => {
    const ok = await appConfirm({
      message: "라이브 셀러로 입점 신청하시겠습니까?\n신청 후 최고관리자 승인이 완료되면 라이브 셀러 기능을 이용할 수 있습니다.",
      confirmText: "신청하기",
    });
    if (!ok) return;
    setLoading(true);
    try {
      const res = await fetch("/api/my/apply-seller", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setApplied(true);
        await appAlert({ message: data.message || "라이브 셀러 입점 신청이 접수되었습니다.", type: "success" });
        router.refresh();
      } else if (data.alreadyApplied) {
        setApplied(true);
        if (data.approved) setApproved(true);
        await appAlert({ message: data.error, type: "warning" });
      } else {
        await appAlert({ message: data.error || "신청에 실패했습니다.", type: "warning" });
      }
    } catch {
      await appAlert({ message: "신청 중 오류가 발생했습니다.", type: "warning" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleApply}
      disabled={loading}
      className="w-full flex items-center gap-3 rounded-2xl bg-gray-900 text-white px-5 py-4 active:scale-[0.99] transition-transform disabled:opacity-60"
    >
      <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-black flex-shrink-0">
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Icon name="Store" size={18} strokeWidth={2} />}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[14px] font-extrabold">라이브 셀러 입점신청하기</p>
        <p className="text-[11px] text-white/60 mt-0.5">신청 즉시 접수 · 관리자 승인 후 활성화</p>
      </div>
      <Icon name="ChevronDown" size={18} className="text-white/50 flex-shrink-0 -rotate-90" />
    </button>
  );
}
