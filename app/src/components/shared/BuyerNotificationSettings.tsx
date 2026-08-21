"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { useRouter } from "next/navigation";
import {Radio, Package, Loader2} from 'lucide-react';

interface Props {
  initial: {
    liveAlimtalkOptIn: boolean;
    notifyOrder: boolean;
  };
}

type Key = "liveAlimtalkOptIn" | "notifyOrder";

const ITEMS: { key: Key; icon: any; label: string; desc: string; color: string }[] = [
  {
    key: "liveAlimtalkOptIn",
    icon: Radio,
    label: "라이브 시작 알림",
    desc: "PICK한 라이브 셀러가 라이브를 시작하면 알림(앱·카카오 알림톡)을 받아요",
    color: "text-rose-500",
  },
  {
    key: "notifyOrder",
    icon: Package,
    label: "주문·배송 알림",
    desc: "주문 완료, 배송 상태 변경 등 주문 관련 소식을 받아요",
    color: "text-blue-500",
  },
];

// 구매회원 알림 종류별 수신 ON/OFF 설정.
export default function BuyerNotificationSettings({ initial }: Props) {
  const [values, setValues] = useState(initial);
  const [savingKey, setSavingKey] = useState<Key | null>(null);
  const router = useRouter();

  const toggle = async (key: Key) => {
    const next = !values[key];
    setValues((v) => ({ ...v, [key]: next }));
    setSavingKey(key);
    try {
      const res = await fetch("/api/buyer/notification-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next }),
      });
      if (!res.ok) throw new Error("저장 실패");
      router.refresh();
    } catch {
      setValues((v) => ({ ...v, [key]: !next }));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
      <div className="flex items-center gap-1.5 mb-3">
        <Icon name="Notification" size={14} strokeWidth={1.7} className="text-gray-500" />
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">알림 설정</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const on = values[item.key];
          return (
            <div key={item.key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Icon size={18} strokeWidth={1.6} className={`${item.color} flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">{item.label}</p>
                <p className="text-[10px] text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
              {savingKey === item.key ? (
                <Loader2 size={16} className="animate-spin text-gray-400 flex-shrink-0" />
              ) : (
                <button
                  type="button"
                  onClick={() => toggle(item.key)}
                  aria-label={`${item.label} ${on ? "끄기" : "켜기"}`}
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
          );
        })}
      </div>
    </div>
  );
}
