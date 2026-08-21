"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { useRouter } from "next/navigation";
import {Save, Loader2, User, Users, Building2} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";
import SavedPopup from "@/components/shared/SavedPopup";

interface Fees {
  sellerFeeRate: number;
  middleAdminFeeRate: number;
  brandFeeRate: number;
}

const FIELDS: { key: keyof Fees; label: string; desc: string; icon: typeof User }[] = [
  { key: "sellerFeeRate", label: "셀러 플랫폼 수수료율", desc: "셀러 정산액에서 차감", icon: User },
  { key: "middleAdminFeeRate", label: "중간관리자 플랫폼 수수료율", desc: "중간관리자 공급 정산액에서 차감", icon: Users },
  { key: "brandFeeRate", label: "브랜드사 플랫폼 수수료율", desc: "브랜드 공급 정산액에서 차감", icon: Building2 },
];

// 부가세 포함 실효율 (rate × 1.1), 소수 둘째자리까지
const effective = (rate: number) => Math.round(rate * 1.1 * 100) / 100;

export default function PlatformFeeSettingsForm({ initialFees }: { initialFees: Fees }) {
  const router = useRouter();
  const { appAlert } = useAppDialog();
  const [fees, setFees] = useState<Fees>(initialFees);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSavedPopup, setShowSavedPopup] = useState(false);

  const setRate = (key: keyof Fees, value: string) => {
    setSaved(false);
    const n = value === "" ? 0 : parseFloat(value);
    setFees((prev) => ({ ...prev, [key]: Number.isFinite(n) ? n : 0 }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/platform-fees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fees),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        await appAlert(d.error || "저장에 실패했습니다");
        return;
      }
      const data = await res.json();
      setFees(data);
      setSaved(true);
      setShowSavedPopup(true);
      router.refresh();
    } catch {
      await appAlert("저장 중 오류가 발생했습니다");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-100 p-4">
      <SavedPopup show={showSavedPopup} onClose={() => setShowSavedPopup(false)} />
      <div className="flex items-center gap-2 mb-1">
        <Icon name="Discount" size={16} className="text-gray-700" />
        <h2 className="text-sm font-bold text-gray-900">역할별 플랫폼 수수료율</h2>
      </div>
      <p className="text-[11px] text-gray-400 mb-3">
        정산 시 각 역할의 정산액에서 차감되는 플랫폼 수수료율입니다. 실제 차감은 부가세 10%를 포함한 실효율 기준입니다.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {FIELDS.map((f) => {
          const Icon = f.icon;
          const rate = fees[f.key];
          return (
            <div key={f.key} className="rounded-lg border border-gray-100 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="w-5 h-5 rounded-md bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <Icon size={12} className="text-brand-600" />
                </span>
                <label className="text-[11px] font-medium text-gray-700">{f.label}</label>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={rate}
                  onChange={(e) => setRate(f.key, e.target.value)}
                  className="w-20 text-right border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30"
                />
                <span className="text-[11px] text-gray-400">%</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">{f.desc}</p>
              <p className="text-[10px] font-medium text-brand-600 mt-0.5">
                부가세 포함 실효율: {effective(rate)}%
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-60 transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          수수료율 저장
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
            <Icon name="Check" size={14} /> 저장되었습니다
          </span>
        )}
      </div>
    </section>
  );
}
