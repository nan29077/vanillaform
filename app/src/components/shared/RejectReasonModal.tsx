"use client";

import { useState } from "react";
import { X, Ban, Loader2 } from "lucide-react";

interface Props {
  productName?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

// 반려/거절 사유 입력 모달 — 승인 대기 목록에서 공통 사용
export default function RejectReasonModal({ productName, loading, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => !loading && onCancel()} />
      <div className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <Ban size={16} className="text-red-500" />
            </div>
            <h3 className="text-[15px] font-bold text-gray-900">반려 사유 입력</h3>
          </div>
          <button onClick={() => !loading && onCancel()} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-2.5">
          {productName && <p className="text-[12px] text-gray-500 truncate">{productName}</p>}
          <label className="text-[12px] font-medium text-gray-600 block">반려 사유를 입력해주세요</label>
          <textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="예) 판매가가 정책에 맞지 않습니다."
            className="w-full text-sm px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
          />
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={() => !loading && onCancel()}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={loading || !reason.trim()}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : "확인"}
          </button>
        </div>
      </div>
    </div>
  );
}
