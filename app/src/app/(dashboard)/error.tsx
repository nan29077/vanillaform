"use client";

import { Icon } from '@/components/shared/Icon';
import { useEffect } from "react";
import Link from "next/link";
;

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Prisma 등 다른 오류 메시지에 "session"/"auth" 단어가 포함돼도 인증 오류로 오판하지 않도록
  // 명확한 인증 관련 패턴만 인증 오류로 판별
  const msg = error.message || "";
  const isPrismaError =
    msg.includes("Prisma") || msg.includes("prisma") || msg.includes("Invalid `");
  const isAuthError =
    !isPrismaError &&
    (/unauthorized|unauthenticated|not authenticated|로그인이 필요|세션이 만료|jwt|token/i.test(msg) ||
      msg.includes("NEXT_REDIRECT"));

  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <Icon name="Warning" size={48} className="text-amber-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          {isAuthError ? "인증 오류가 발생했습니다" : "페이지를 불러올 수 없습니다"}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {isAuthError
            ? "세션이 만료되었거나 인증에 문제가 있습니다. 다시 로그인해 주세요."
            : "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Icon name="Reorder" size={16} />
            다시 시도
          </button>
          {isAuthError ? (
            <Link
              href="/auth/login"
              className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Icon name="Login" size={16} />
              로그인
            </Link>
          ) : (
            <Link
              href="/"
              className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Icon name="Home" size={16} />
              홈으로
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
