"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, ClipboardList, Lock, Check } from "lucide-react";
import SavedPopup from "@/components/shared/SavedPopup";
import {
  REGISTER_FIELD_META,
  isRegisterFieldLocked,
  type RegisterFieldSettings,
  type RegisterFieldStatus,
  type RegisterFieldKey,
} from "@/lib/registerFields";
import { useAppDialog } from "@/components/shared/AppDialog";

const STATUS_OPTIONS: { value: RegisterFieldStatus; label: string }[] = [
  { value: "required", label: "필수" },
  { value: "optional", label: "선택" },
  { value: "hidden", label: "숨김" },
];

export default function RegisterFieldSettingsForm({
  initialFields,
}: {
  initialFields: RegisterFieldSettings;
}) {
  const router = useRouter();
  const { appAlert } = useAppDialog();
  const [fields, setFields] = useState<RegisterFieldSettings>(initialFields);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSavedPopup, setShowSavedPopup] = useState(false);

  const setStatus = (key: RegisterFieldKey, status: RegisterFieldStatus) => {
    if (isRegisterFieldLocked(key)) return; // 잠금 항목은 변경 불가
    setSaved(false);
    setFields((prev) => ({ ...prev, [key]: status }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/register-fields", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        await appAlert(d.error || "저장에 실패했습니다");
        return;
      }
      const data = await res.json();
      if (data.fields) setFields(data.fields);
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
    <div className="space-y-5">
      <SavedPopup show={showSavedPopup} onClose={() => setShowSavedPopup(false)} />
      <section className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList size={16} className="text-gray-700" />
          <h2 className="text-sm font-bold text-gray-900">회원가입 항목 권한 설정</h2>
        </div>
        <p className="text-[11px] text-gray-400 mb-3">
          이메일 회원가입 폼의 항목별 노출 방식을 지정합니다. <b>필수</b>는 미입력 시 가입 불가, <b>선택</b>은 입력해도 되고 안 해도 되며,
          <b>숨김</b>은 가입 폼에서 아예 표시되지 않습니다. 이름·이메일·비밀번호·비밀번호 확인은 계정 생성에 반드시 필요해 변경할 수 없습니다.
        </p>

        <div className="divide-y divide-gray-100">
          {REGISTER_FIELD_META.map((f) => {
            const locked = isRegisterFieldLocked(f.key);
            const current = fields[f.key];
            return (
              <div key={f.key} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-gray-900">{f.label}</p>
                    {locked && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-gray-400 bg-gray-50 border border-gray-200 rounded px-1 py-0.5">
                        <Lock size={9} /> 고정
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">{f.desc}</p>
                </div>
                {/* 세그먼트 컨트롤 */}
                <div className="inline-flex flex-shrink-0 rounded-lg border border-gray-200 overflow-hidden">
                  {STATUS_OPTIONS.map((opt) => {
                    const active = current === opt.value;
                    const disabled = locked && opt.value !== "required";
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={disabled}
                        onClick={() => setStatus(f.key, opt.value)}
                        className={`px-3 py-1.5 text-[12px] font-semibold transition-colors border-l first:border-l-0 border-gray-200 ${
                          active
                            ? "bg-brand-500 text-white"
                            : disabled
                            ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                            : "bg-white text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-60 transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          저장
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
            <Check size={14} /> 저장되었습니다
          </span>
        )}
      </div>
    </div>
  );
}
