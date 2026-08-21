"use client";

import { Icon } from '@/components/shared/Icon';
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {Loader2} from 'lucide-react';

export default function PublicError({
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
    console.error("Page error:", error);
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

  if (isRetrying && retryCount.current <= MAX_RETRIES) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-gray-400" />
          <p className="text-sm text-gray-400">페이지를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center max-w-xs">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-50 flex items-center justify-center">
          <Icon name="Warning" size={24} className="text-amber-500" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          페이지 로딩 오류
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          일시적인 문제가 발생했습니다.<br />잠시 후 다시 시도해 주세요.
        </p>
        <div className="space-y-2">
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
        </div>
      </div>
    </div>
  );
}
