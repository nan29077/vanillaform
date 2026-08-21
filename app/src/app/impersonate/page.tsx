"use client";

import { Icon } from '@/components/shared/Icon';
import { Suspense, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {Loader2} from 'lucide-react';

function dashPath(r: string): string {
  switch (r) {
    case "SUPER_ADMIN": return "/admin";
    case "MIDDLE_ADMIN": return "/middle";
    case "SELLER": return "/seller";
    case "BRAND_ADMIN": return "/brand";
    default: return "/";
  }
}

function ImpersonateInner() {
  const sp = useSearchParams();
  const token = sp?.get("token") ?? null;
  const role = sp?.get("role") ?? "";
  const ran = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) {
      setError("임시 로그인 토큰이 없습니다.");
      return;
    }
    // 이 탭에서만 임시 세션으로 로그인 → 완료 후 해당 역할 대시보드로 이동
    signIn("impersonate", { token, redirect: false })
      .then((res) => {
        if (res?.ok && !res.error) {
          window.location.replace(dashPath(role));
        } else {
          setError("임시 로그인에 실패했습니다. 토큰이 만료되었거나 대상 계정이 비활성 상태일 수 있습니다.");
        }
      })
      .catch(() => setError("임시 로그인 처리 중 오류가 발생했습니다."));
  }, [token, role]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="text-center">
        {error ? (
          <>
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-red-50 flex items-center justify-center">
              <Icon name="Warning" size={26} className="text-red-500" />
            </div>
            <p className="text-sm font-bold text-gray-900">임시 로그인 실패</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-xs">{error}</p>
            <button
              onClick={() => window.close()}
              className="mt-4 text-xs text-gray-400 underline"
            >
              이 창 닫기
            </button>
          </>
        ) : (
          <>
            <Loader2 size={28} className="animate-spin mx-auto text-brand-500 mb-3" />
            <p className="text-sm font-bold text-gray-900">임시 로그인 중…</p>
            <p className="text-xs text-gray-500 mt-1">잠시만 기다려 주세요</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function ImpersonatePage() {
  return (
    <Suspense>
      <ImpersonateInner />
    </Suspense>
  );
}
