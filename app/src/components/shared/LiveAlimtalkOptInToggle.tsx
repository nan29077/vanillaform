"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { useRouter } from "next/navigation";
import {Loader2} from 'lucide-react';

// PICK한 셀러의 라이브 시작 시 카카오 알림톡 수신 동의 토글.
export default function LiveAlimtalkOptInToggle({ initialValue }: { initialValue: boolean }) {
  const [on, setOn] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const toggle = async () => {
    const next = !on;
    setOn(next);
    setSaving(true);
    try {
      const res = await fetch("/api/buyer/notification-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveAlimtalkOptIn: next }),
      });
      if (!res.ok) throw new Error("저장 실패");
      router.refresh();
    } catch {
      setOn(!next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
      <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">알림 설정</h3>
      <div className="flex items-center gap-3">
        <Icon name="Notification" size={18} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800">라이브 시작 알림톡</p>
          <p className="text-[10px] text-gray-400">PICK한 라이브 셀러가 라이브를 시작하면 카카오 알림톡을 받아요</p>
        </div>
        {saving ? (
          <Loader2 size={16} className="animate-spin text-gray-400 flex-shrink-0" />
        ) : (
          <button
            type="button"
            onClick={toggle}
            aria-label={on ? "알림 끄기" : "알림 켜기"}
            className={`relative w-10 rounded-full transition-colors flex-shrink-0 ${on ? "bg-brand-600" : "bg-gray-300"}`}
            style={{ height: "22px" }}
          >
            <span
              className="absolute rounded-full bg-white shadow-sm transition-transform"
              style={{ width: "18px", height: "18px", top: "2px", left: "2px", transform: on ? "translateX(18px)" : "translateX(0)" }}
            />
          </button>
        )}
      </div>
    </div>
  );
}
