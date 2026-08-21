"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { useRouter } from "next/navigation";
import {Hash, Loader2, Save} from 'lucide-react';
import SafeImage from "@/components/shared/SafeImage";
import { DEFAULT_PRODUCT_IMAGE } from "@/lib/defaults";

interface ProductRow {
  id: string; // SellerShopProduct id
  name: string;
  thumbnail: string | null;
  shopNumber: number | null;
}

interface Props {
  initialDirectExpose: boolean;
  initialNumbering: boolean;
  products: ProductRow[];
}

export default function ShopExposeManager({ initialDirectExpose, initialNumbering, products }: Props) {
  const router = useRouter();
  const [directExpose, setDirectExpose] = useState(initialDirectExpose);
  const [numbering, setNumbering] = useState(initialNumbering);
  const [savingToggle, setSavingToggle] = useState<string | null>(null);
  const [numbers, setNumbers] = useState<Record<string, string>>(
    Object.fromEntries(products.map((p) => [p.id, p.shopNumber != null ? String(p.shopNumber) : ""])),
  );
  const [numSaving, setNumSaving] = useState(false);
  const [numSaved, setNumSaved] = useState(false);

  // 중복 번호 검출 (입력값 기준)
  const counts: Record<string, number> = {};
  for (const v of Object.values(numbers)) {
    const t = v.trim();
    if (t) counts[t] = (counts[t] || 0) + 1;
  }
  const dupValues = Object.entries(counts).filter(([, c]) => c > 1).map(([v]) => v);
  const hasDup = dupValues.length > 0;

  const saveToggle = async (patch: { shopDirectExpose?: boolean; shopNumbering?: boolean }, key: string) => {
    setSavingToggle(key);
    try {
      await fetch("/api/seller/shop-expose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      router.refresh();
    } finally {
      setSavingToggle(null);
    }
  };

  const toggleDirect = () => {
    const next = !directExpose;
    setDirectExpose(next);
    if (!next) setNumbering(false);
    saveToggle({ shopDirectExpose: next, ...(next ? {} : { shopNumbering: false }) }, "direct");
  };
  const toggleNumbering = () => {
    const next = !numbering;
    setNumbering(next);
    saveToggle({ shopNumbering: next }, "num");
  };

  const saveNumbers = async () => {
    if (hasDup) return;
    setNumSaving(true);
    setNumSaved(false);
    try {
      const payload = {
        numbers: products.map((p) => ({ id: p.id, shopNumber: numbers[p.id]?.trim() ? Number(numbers[p.id]) : null })),
      };
      const res = await fetch("/api/seller/shop-expose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) { setNumSaved(true); router.refresh(); }
    } finally {
      setNumSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5">
      {/* 샵에 바로 노출하기 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
            <Icon name="Store" size={17} className="text-brand-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">샵에 바로 노출하기</p>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
              ON: 라이브 방송 없이 등록한 상품을 라이브 셀러샵에 바로 노출합니다.<br />
              OFF: 기존처럼 라이브 방송을 생성해야 라이브 셀러샵에 노출됩니다.
            </p>
          </div>
        </div>
        <Toggle on={directExpose} loading={savingToggle === "direct"} onClick={toggleDirect} />
      </div>

      {/* 상품 번호 매기기 (바로 노출 ON일 때만) */}
      {directExpose && (
        <div className="mt-4 pt-4 border-t border-gray-50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Hash size={17} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">상품 번호 매기기</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                  ON: 판매중 상품에 번호를 매겨 라이브 셀러샵에 번호와 함께 노출합니다. (중복 번호 불가)
                </p>
              </div>
            </div>
            <Toggle on={numbering} loading={savingToggle === "num"} onClick={toggleNumbering} />
          </div>

          {/* 번호 입력 */}
          {numbering && (
            <div className="mt-3">
              {hasDup && (
                <div className="flex items-center gap-1.5 text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-2">
                  <Icon name="Warning" size={13} /> 중복된 번호({dupValues.join(", ")})가 있습니다. 번호를 다르게 입력하세요.
                </div>
              )}
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {products.length === 0 ? (
                  <p className="text-[11px] text-gray-400 text-center py-3">판매중인 상품이 없습니다.</p>
                ) : products.map((p) => {
                  const v = numbers[p.id] ?? "";
                  const isDup = v.trim() !== "" && counts[v.trim()] > 1;
                  return (
                    <div key={p.id} className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        <SafeImage src={p.thumbnail} placeholder={DEFAULT_PRODUCT_IMAGE} alt={p.name} width={36} height={36} fallbackText={p.name.charAt(0)} />
                      </div>
                      <p className="flex-1 min-w-0 text-[12px] text-gray-700 truncate">{p.name}</p>
                      <input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={v}
                        onChange={(e) => { setNumSaved(false); setNumbers((prev) => ({ ...prev, [p.id]: e.target.value })); }}
                        placeholder="번호"
                        className={`w-16 text-center text-sm rounded-lg border px-2 py-1.5 focus:outline-none focus:ring-2 ${isDup ? "border-red-300 ring-red-100 bg-red-50" : "border-gray-200 focus:ring-brand-200"}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={saveNumbers}
                  disabled={numSaving || hasDup}
                  className="inline-flex items-center gap-1.5 text-[12px] font-bold text-black bg-brand-500 hover:bg-brand-600 px-4 py-2 rounded-lg disabled:opacity-40"
                >
                  {numSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 번호 저장
                </button>
                {numSaved && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Icon name="Check" size={13} /> 저장됨</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Toggle({ on, loading, onClick }: { on: boolean; loading: boolean; onClick: () => void }) {
  if (loading) return <Loader2 size={18} className="animate-spin text-gray-400 flex-shrink-0" />;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${on ? "bg-brand-500" : "bg-gray-300"}`}
    >
      <span
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  );
}
