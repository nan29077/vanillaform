"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 셀러 라이브 상태(LIVE 배지)를 실시간에 가깝게 반영하기 위해 주기적으로 서버 컴포넌트를 새로고침.
// 탭이 보이는 동안에만 동작해 불필요한 요청을 줄인다.
export default function LiveStatusPoller({ intervalMs = 45000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        router.refresh();
      }
    };
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
