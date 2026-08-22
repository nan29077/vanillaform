"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function DevBuyerLoginBanner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 이미 로그인된 경우 표시 안 함
  if (status === "loading" || session) return null;

  const handleBuyerLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: "buyer1@example.com",
        password: "password123",
        redirect: false,
      });
      if (result?.error) {
        setError("시드 데이터가 투입됐는지 확인하세요.");
      } else {
        router.refresh();
      }
    } catch {
      setError("로그인 오류");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-4 mt-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
      <p className="mb-2 text-[11px] font-medium text-gray-400 text-center">
        테스트 계정 — 구매자 로그인
      </p>
      <button
        type="button"
        onClick={handleBuyerLogin}
        disabled={loading}
        className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {loading ? "로그인 중..." : "구매자로 로그인 (buyer1@example.com)"}
      </button>
      {error && (
        <p className="mt-1.5 text-center text-[10px] text-red-500">{error}</p>
      )}
    </div>
  );
}
