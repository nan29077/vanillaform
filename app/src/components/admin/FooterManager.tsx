"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import {Save, Loader2, Building2} from 'lucide-react';
import type { FooterSettings } from "@/lib/settings";
import SavedPopup from "@/components/shared/SavedPopup";

export default function FooterManager({ initialSettings }: { initialSettings: FooterSettings }) {
  const [form, setForm] = useState<FooterSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showSavedPopup, setShowSavedPopup] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch("/api/admin/footer-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "저장에 실패했습니다");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setShowSavedPopup(true);
    } catch {
      setError("저장 중 오류가 발생했습니다");
    } finally {
      setSaving(false);
    }
  };

  const fields: { key: keyof FooterSettings; label: string; placeholder: string }[] = [
    { key: "companyName", label: "상호", placeholder: "바닐라폼 운영사" },
    { key: "ceoName", label: "대표자명", placeholder: "바닐라폼 운영사 정보 입력" },
    { key: "bizNum", label: "사업자등록번호", placeholder: "바닐라폼 사업자 정보 입력" },
    { key: "mailOrderNum", label: "통신판매신고번호", placeholder: "바닐라폼 신고 정보 입력" },
    { key: "phone", label: "대표번호", placeholder: "바닐라폼 고객센터 번호 입력" },
    { key: "address", label: "주소", placeholder: "바닐라폼 운영사 주소 입력" },
    { key: "copyright", label: "저작권 문구", placeholder: "2026 VanillaForm. All rights reserved." },
  ];

  return (
    <div className="space-y-4">
      <SavedPopup show={showSavedPopup} onClose={() => setShowSavedPopup(false)} />
      <div className="flex items-center gap-2 mb-1">
        <Building2 size={16} className="text-gray-500" />
        <h2 className="text-sm font-bold text-gray-900">푸터 회사정보 관리</h2>
      </div>
      <p className="text-[11px] text-gray-400 mb-4">메인페이지 푸터에 표시되는 회사 정보를 수정합니다. 저장 후 즉시 적용됩니다.</p>

      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        {fields.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>
            <input
              type="text"
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              placeholder={placeholder}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-60 transition-colors"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          저장
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
            <Icon name="Check" size={13} /> 저장되었습니다
          </span>
        )}
      </div>

      {/* 미리보기 */}
      <div className="bg-gray-950 text-gray-400 rounded-xl p-4 text-[10px] space-y-1">
        <p className="text-gray-300 font-medium text-[11px] mb-2">미리보기</p>
        <p><span className="text-gray-500">상호</span> {form.companyName} <span className="mx-1 text-gray-700">|</span> <span className="text-gray-500">대표</span> {form.ceoName}</p>
        <p><span className="text-gray-500">사업자등록번호</span> {form.bizNum} <span className="mx-1 text-gray-700">|</span> <span className="text-gray-500">통신판매신고번호</span> {form.mailOrderNum}</p>
        <p><span className="text-gray-500">대표번호</span> {form.phone}</p>
        <p><span className="text-gray-500">주소</span> {form.address}</p>
        <p className="pt-1 border-t border-gray-800 mt-1">&copy; {form.copyright}</p>
      </div>
    </div>
  );
}
