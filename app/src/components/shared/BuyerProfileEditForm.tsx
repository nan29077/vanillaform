"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { useRouter } from "next/navigation";
import {Loader2} from 'lucide-react';
import SavedPopup from "@/components/shared/SavedPopup";

interface Props {
  initial: {
    name: string;
    email: string | null;
    phone: string | null;
    joinedAt: string; // 가입일 표시용 (ISO)
  };
}

// 구매회원 가입정보(닉네임/연락처) 확인·수정 카드. 이메일·가입일은 읽기 전용.
export default function BuyerProfileEditForm({ initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSavedPopup, setShowSavedPopup] = useState(false);

  const dirty = name.trim() !== initial.name || phone.trim() !== (initial.phone ?? "");

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "저장에 실패했습니다");
        return;
      }
      setSaved(true);
      setShowSavedPopup(true);
      router.refresh();
    } catch {
      setError("저장 중 오류가 발생했습니다");
    } finally {
      setSaving(false);
    }
  };

  const emailDisplay =
    initial.email && !initial.email.endsWith("@no-email.local") ? initial.email : "미등록";

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
      <SavedPopup show={showSavedPopup} onClose={() => setShowSavedPopup(false)} />
      <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">내 가입정보</h3>

      {/* 닉네임 */}
      <label className="block mb-3">
        <span className="text-[11px] text-gray-400">닉네임</span>
        <div className="mt-1 flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 focus-within:ring-2 focus-within:ring-brand-400/30">
          <Icon name="MyPage" size={15} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={name}
            maxLength={20}
            onChange={(e) => { setName(e.target.value); setSaved(false); }}
            placeholder="닉네임"
            className="flex-1 text-sm text-gray-900 focus:outline-none bg-transparent"
          />
        </div>
      </label>

      {/* 연락처 */}
      <label className="block mb-3">
        <span className="text-[11px] text-gray-400">연락처</span>
        <div className="mt-1 flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 focus-within:ring-2 focus-within:ring-brand-400/30">
          <Icon name="Phone" size={15} className="text-gray-400 flex-shrink-0" />
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setSaved(false); }}
            placeholder="010-0000-0000"
            className="flex-1 text-sm text-gray-900 focus:outline-none bg-transparent"
          />
        </div>
      </label>

      {/* 이메일 / 가입일 (읽기 전용) */}
      <div className="space-y-2 pt-1 border-t border-gray-50 mt-1 pb-1">
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-gray-500">이메일</span>
          <span className="text-sm font-medium text-gray-900">{emailDisplay}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">가입일</span>
          <span className="text-sm text-gray-400">
            {new Date(initial.joinedAt).toLocaleDateString("ko-KR")}
          </span>
        </div>
      </div>

      {error && <p className="text-[11px] text-red-500 mt-2">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !dirty}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-colors"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Icon name="Check" size={16} /> : null}
        {saved && !dirty ? "저장되었습니다" : "가입정보 저장"}
      </button>
    </div>
  );
}
