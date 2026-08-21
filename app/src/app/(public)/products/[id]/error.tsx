"use client";

import { Icon } from '@/components/shared/Icon';
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {Loader2} from 'lucide-react';

export default function ProductError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const retryCount = useRef(0);
  const [isRetrying, setIsRetrying] = useState(true);
  const MAX_RETRIES = 3;

  useEffect(() => {
    console.error("Product page error:", error);
    // Auto-retry up to MAX_RETRIES times to handle transient errors
    if (retryCount.current < MAX_RETRIES) {
      retryCount.current += 1;
      setIsRetrying(true);
      const delay = retryCount.current === 1 ? 300 : 600;
      const timer = setTimeout(() => {
        reset();
      }, delay);
      return () => clearTimeout(timer);
    }
    setIsRetrying(false);
  }, [error, reset]);

  // Show loading state during auto-retry
  if (isRetrying && retryCount.current <= MAX_RETRIES) {
    return (
      <div className="min-h-[60vh] bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-gray-400" />
          <p className="text-sm text-gray-400">상품을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] bg-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm mx-auto">
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 pt-10 pb-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
              <Icon name="Warning" size={28} className="text-amber-500" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">상품을 불러올 수 없습니다</h2>
            <p className="text-sm text-gray-500 text-center px-6">
              일시적인 오류가 발생했습니다.<br/>잠시 후 다시 시도해 주세요.
            </p>
          </div>
          <div className="p-5 space-y-2.5">
            <button
              onClick={() => { retryCount.current = 0; setIsRetrying(true); reset(); }}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition-colors"
            >
              <Icon name="Reorder" size={16} />
              다시 시도
            </button>
            <Link
              href="/"
              className="w-full flex items-center justify-center gap-2 px-5 py-3 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Icon name="Home" size={16} />
              홈으로
            </Link>
            <Link
              href="/search"
              className="w-full flex items-center justify-center gap-2 px-5 py-3 text-gray-400 text-xs font-medium rounded-xl hover:text-gray-600 transition-colors"
            >
              <Icon name="Cart" size={14} />
              상품 둘러보기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
