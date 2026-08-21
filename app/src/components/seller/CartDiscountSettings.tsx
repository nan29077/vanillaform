"use client";

import { useEffect, useState } from "react";
import { BadgePercent, Loader2, AlertTriangle } from "lucide-react";

// 장바구니 할인 설정 (셀러 상품 관리 페이지 상단 카드)
// 셀러별 소계가 기준금액 이상이면 % 할인. 할인액은 셀러 정산에서 차감된다.
export default function CartDiscountSettings() {
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState("");
  const [rate, setRate] = useState("");
  const [maxRate, setMaxRate] = useState(20);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/seller/cart-discount")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setEnabled(data.enabled);
        setThreshold(data.threshold > 0 ? String(data.threshold) : "");
        setRate(data.rate > 0 ? String(data.rate) : "");
        if (data.maxRate) setMaxRate(data.maxRate);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const save = async (nextEnabled: boolean) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/seller/cart-discount", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: nextEnabled,
          threshold: Number(threshold || 0),
          rate: Number(rate || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "저장에 실패했습니다." });
        return;
      }
      setEnabled(data.enabled);
      setMessage({ type: "ok", text: data.enabled ? "장바구니 할인이 적용 중입니다." : "저장되었습니다. (할인 꺼짐)" });
    } catch {
      setMessage({ type: "error", text: "저장에 실패했습니다." });
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <BadgePercent size={18} className="text-brand-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-gray-900">장바구니 할인</p>
            <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
              내 샵 상품을 기준금액 이상 담은 구매자에게 자동으로 % 할인을 적용합니다.
            </p>
          </div>
        </div>
        {saving ? (
          <Loader2 size={18} className="animate-spin text-gray-400 flex-shrink-0 mt-1" />
        ) : (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => save(!enabled)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors mt-1 ${
              enabled ? "bg-brand-500" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        )}
      </div>

      <div className="mt-3.5 flex flex-wrap items-end gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-gray-500">기준금액 (원)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={10000}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder="예: 300000"
            className="w-36 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-gray-500">할인율 (%, 최대 {maxRate}%)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={maxRate}
            step={1}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="예: 10"
            className="w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => save(enabled)}
          disabled={saving}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          저장
        </button>
        {message && (
          <span className={`text-xs ${message.type === "ok" ? "text-brand-600" : "text-red-500"}`}>
            {message.text}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
        <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-gray-600 leading-relaxed">
          할인 금액은 <b className="text-gray-800">셀러 정산금에서 차감</b>됩니다. 공급가·수수료 상품은 할인액이
          내 마진보다 클 수 있으니 할인율을 신중히 설정해 주세요. 추천인·픽 할인과는 중복 적용되지 않고 더 큰
          할인 하나만 적용됩니다.
        </p>
      </div>
    </div>
  );
}
