"use client";

import { useRouter } from "next/navigation";
import { Hexagon, X } from "lucide-react";

interface GuestPurchaseModalProps {
  open: boolean;
  onClose: () => void;
  onGuestPurchase: () => void;
  returnUrl: string;
}

export default function GuestPurchaseModal({
  open,
  onClose,
  onGuestPurchase,
  returnUrl,
}: GuestPurchaseModalProps) {
  const router = useRouter();

  if (!open) return null;

  const handleRegister = () => {
    onClose();
    router.push(`/auth/register?returnUrl=${encodeURIComponent(returnUrl)}`);
  };

  const handleGuestPurchase = () => {
    onClose();
    onGuestPurchase();
  };

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 z-[89] bg-black/50"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="fixed inset-0 z-[90] flex items-center justify-center px-5 pointer-events-none">
        <div className="w-full max-w-sm bg-amber-50 rounded-2xl shadow-xl overflow-hidden pointer-events-auto">
          {/* 헤더 */}
          <div className="bg-amber-500 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hexagon size={20} className="text-white" strokeWidth={1.75} />
              <span className="text-white font-bold text-[15px]">비회원으로 구매하시겠습니까?</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-amber-400/50 text-white hover:bg-amber-400 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* 본문 */}
          <div className="px-5 py-4">
            <p className="text-sm text-amber-800 leading-relaxed">
              카카오톡, 네이버 등으로도 쉽게 회원 가입을 할 수 있습니다. 회원 가입 시 다양한 혜택이 주어집니다.
            </p>
          </div>

          {/* 버튼 */}
          <div className="px-5 pb-5 flex gap-2.5">
            <button
              type="button"
              onClick={handleGuestPurchase}
              className="flex-1 h-11 border border-amber-400 text-amber-700 font-semibold text-sm rounded-xl hover:bg-amber-100 transition-colors"
            >
              비회원 구매
            </button>
            <button
              type="button"
              onClick={handleRegister}
              className="flex-1 h-11 bg-amber-500 text-white font-semibold text-sm rounded-xl hover:bg-amber-600 transition-colors"
            >
              회원 가입
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
