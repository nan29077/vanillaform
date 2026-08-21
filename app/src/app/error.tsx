"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

// 모듈 수준 카운터 — 컴포넌트 리마운트에도 초기화되지 않음
let globalRetryCount = 0;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isRetrying, setIsRetrying] = useState(globalRetryCount < 3);
  const MAX_RETRIES = 3;

  useEffect(() => {
    console.error("Global error:", error);
    if (globalRetryCount < MAX_RETRIES) {
      globalRetryCount += 1;
      setIsRetrying(true);
      const delay = globalRetryCount === 1 ? 300 : 600;
      const timer = setTimeout(() => {
        reset();
      }, delay);
      return () => clearTimeout(timer);
    }
    setIsRetrying(false);
  }, [error, reset]);

  if (isRetrying && globalRetryCount <= MAX_RETRIES) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-gray-400" />
          <p className="text-sm text-gray-400">페이지를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          오류가 발생했습니다
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          일시적인 문제가 발생했습니다. 다시 시도해 주세요.
        </p>
        <div className="space-y-2">
          <button
            onClick={() => { globalRetryCount = 0; setIsRetrying(true); reset(); }}
            className="w-full px-5 py-3 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition-colors"
          >
            다시 시도
          </button>
          <Link
            href="/"
            className="block w-full px-5 py-3 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
