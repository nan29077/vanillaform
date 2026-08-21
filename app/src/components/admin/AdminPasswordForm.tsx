"use client";

import { useState } from "react";
import { Lock, Loader2, Eye, EyeOff, Check, AlertTriangle } from "lucide-react";
import SavedPopup from "@/components/shared/SavedPopup";

type Field = "current" | "next" | "confirm";

const FIELDS: { key: Field; label: string; placeholder: string }[] = [
  { key: "current", label: "현재 비밀번호", placeholder: "현재 비밀번호 입력" },
  { key: "next", label: "새 비밀번호", placeholder: "8자 이상 입력" },
  { key: "confirm", label: "새 비밀번호 확인", placeholder: "새 비밀번호 재입력" },
];

const MIN_LENGTH = 8;

export default function AdminPasswordForm({ email }: { email: string }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showSavedPopup, setShowSavedPopup] = useState(false);

  const handleSave = async () => {
    if (!form.current || !form.next || !form.confirm) {
      setMsg({ type: "err", text: "모든 필드를 입력해주세요" });
      return;
    }
    if (form.next.length < MIN_LENGTH) {
      setMsg({ type: "err", text: `새 비밀번호는 ${MIN_LENGTH}자 이상이어야 합니다` });
      return;
    }
    if (form.next !== form.confirm) {
      setMsg({ type: "err", text: "새 비밀번호가 일치하지 않습니다" });
      return;
    }
    if (form.next === form.current) {
      setMsg({ type: "err", text: "현재 비밀번호와 다른 비밀번호를 입력해주세요" });
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "변경에 실패했습니다");
      setMsg({ type: "ok", text: "비밀번호가 변경되었습니다" });
      setForm({ current: "", next: "", confirm: "" });
      setShowSavedPopup(true);
    } catch (e: any) {
      setMsg({ type: "err", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-100 p-4">
      <SavedPopup show={showSavedPopup} onClose={() => setShowSavedPopup(false)} />

      <div className="flex items-center gap-2 mb-1">
        <Lock size={16} className="text-gray-700" />
        <h2 className="text-sm font-bold text-gray-900">비밀번호 변경</h2>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        최고관리자 계정({email})의 로그인 비밀번호를 변경합니다.
      </p>

      <div className="space-y-4 max-w-md">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-xs font-medium text-gray-600">{f.label}</label>
            <div className="relative mt-1">
              <input
                type={show[f.key] ? "text" : "password"}
                className="input-field text-sm pr-9"
                value={form[f.key]}
                autoComplete={f.key === "current" ? "current-password" : "new-password"}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !saving) handleSave();
                }}
                placeholder={f.placeholder}
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label={show[f.key] ? "비밀번호 숨기기" : "비밀번호 보기"}
                onClick={() => setShow((p) => ({ ...p, [f.key]: !p[f.key] }))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {show[f.key] ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        ))}

        {msg && (
          <div
            className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
              msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
            }`}
          >
            {msg.type === "ok" ? <Check size={13} /> : <AlertTriangle size={13} />}
            {msg.text}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-all"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
            {saving ? "변경 중..." : "비밀번호 변경"}
          </button>
        </div>
      </div>
    </section>
  );
}
