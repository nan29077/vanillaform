"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { useRouter } from "next/navigation";
import { NO_IMAGE } from "@/lib/defaults";
import {Loader2} from 'lucide-react';
import SafeImage from "@/components/shared/SafeImage";

export interface PastBroadcastItem {
  id: string;
  title: string;
  thumbnail: string | null;
  endedAt: string | null;
  startedAt: string | null;
  productCount: number;
  peakViewerCount: number;
  showPastInShop: boolean;
}

function formatDate(d: string | null): string {
  if (!d) return "방송일 미정";
  return new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

// 셀러 "샵 기능 관리"의 지난 방송 상품 노출 스위치.
// 켜면 셀러샵 "지난 방송 상품" 영역에 노출, 끄면 숨김.
export default function PastBroadcastToggles({ initialItems }: { initialItems: PastBroadcastItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [savingId, setSavingId] = useState<string | null>(null);
  const router = useRouter();

  const toggle = async (id: string) => {
    const target = items.find((i) => i.id === id);
    if (!target) return;
    const next = !target.showPastInShop;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, showPastInShop: next } : i)));
    setSavingId(id);
    try {
      const res = await fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_past_in_shop", liveId: id, show: next }),
      });
      if (!res.ok) throw new Error("저장 실패");
      router.refresh();
    } catch {
      // 롤백
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, showPastInShop: !next } : i)));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-gray-900">지난 방송 상품 노출</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">
          켠 방송만 라이브 셀러샵 &quot;지난 방송 상품&quot; 영역에 표시됩니다
        </p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl">
          <Icon name="Live" size={28} strokeWidth={1.5} className="mx-auto mb-2 opacity-30" />
          <p className="text-xs">종료된 라이브 방송이 아직 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                item.showPastInShop ? "border-gray-200 bg-white ring-1 ring-brand-100" : "border-gray-100 bg-gray-50/50"
              }`}
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                <SafeImage src={item.thumbnail} placeholder={NO_IMAGE} alt={item.title} width={48} height={48} fallbackText={item.title} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] font-medium truncate ${item.showPastInShop ? "text-gray-900" : "text-gray-500"}`}>
                  {item.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                    <Icon name="Calendar" size={10} /> {formatDate(item.endedAt || item.startedAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                    <Icon name="Video" size={10} /> 상품 {item.productCount}개
                  </span>
                  <span className="text-[10px] text-gray-300 flex items-center gap-0.5">
                    <Icon name="Eye" size={10} /> {item.peakViewerCount.toLocaleString()}명
                  </span>
                </div>
              </div>
              {savingId === item.id ? (
                <Loader2 size={16} className="animate-spin text-gray-400 flex-shrink-0" />
              ) : (
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  aria-label={item.showPastInShop ? "노출 끄기" : "노출 켜기"}
                  className={`relative w-10 rounded-full transition-colors flex-shrink-0 ${item.showPastInShop ? "bg-brand-600" : "bg-gray-300"}`}
                  style={{ height: "22px" }}
                >
                  <span
                    className="absolute rounded-full bg-white shadow-sm transition-transform"
                    style={{ width: "18px", height: "18px", top: "2px", left: "2px", transform: item.showPastInShop ? "translateX(18px)" : "translateX(0)" }}
                  />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
