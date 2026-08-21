"use client";

import { useEffect } from "react";

// 알림 목록 페이지 진입 시 전체 미읽음을 읽음 처리한다.
export default function NotificationsMarkRead() {
  useEffect(() => {
    fetch("/api/notifications/read", { method: "POST" }).catch(() => {});
  }, []);
  return null;
}
