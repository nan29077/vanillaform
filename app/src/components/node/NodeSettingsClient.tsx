"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {Save, Loader2, X} from 'lucide-react';
import { ALL_AVATARS } from "@/lib/defaults";
import SavedPopup from "@/components/shared/SavedPopup";

interface NodeSettingsClientProps {
  initialName: string;
  initialEmail: string;
  initialAvatar: string | null;
}

export default function NodeSettingsClient({
  initialName,
  initialEmail,
  initialAvatar,
}: NodeSettingsClientProps) {
  const router = useRouter();
  const { update } = useSession();
  const [name, setName] = useState(initialName);
  const [selectedAvatar, setSelectedAvatar] = useState<string>(
    initialAvatar || ALL_AVATARS[0]
  );
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // 저장 완료 팝업
  const [showSavedPopup, setShowSavedPopup] = useState(false);

  // 비밀번호 변경
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("이름은 필수입니다");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), avatar: selectedAvatar }),
      });
      if (res.ok) {
        await update({ name: name.trim(), avatar: selectedAvatar });
        setSuccess("설정이 저장되었습니다");
        setTimeout(() => setSuccess(""), 3000);
        setShowSavedPopup(true);
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "저장 실패");
      }
    } catch {
      setError("오류가 발생했습니다");
    }
    setSaving(false);
  };

  const handlePasswordSave = async () => {
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) {
      setPwMsg({ type: "err", text: "모든 필드를 입력해주세요" });
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwMsg({ type: "err", text: "새 비밀번호가 일치하지 않습니다" });
      return;
    }
    if (pwForm.next.length < 6) {
      setPwMsg({ type: "err", text: "새 비밀번호는 6자 이상이어야 합니다" });
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "변경 실패");
      setPwMsg({ type: "ok", text: "비밀번호가 변경되었습니다" });
      setPwForm({ current: "", next: "", confirm: "" });
      setTimeout(() => setPwMsg(null), 3000);
      setShowSavedPopup(true);
    } catch (e: any) {
      setPwMsg({ type: "err", text: e.message });
    }
    setPwSaving(false);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <SavedPopup show={showSavedPopup} onClose={() => setShowSavedPopup(false)} />
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Icon name="Settings" size={20} className="text-gray-400" />
          노드 설정
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">계정 기본 정보를 관리합니다</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 flex items-center justify-between">
          <span className="flex items-center gap-2"><Icon name="Warning" size={14} /> {error}</span>
          <button onClick={() => setError("")}><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-xs text-green-600 flex items-center justify-between">
          <span className="flex items-center gap-2"><Icon name="Check" size={14} /> {success}</span>
          <button onClick={() => setSuccess("")}><X size={14} /></button>
        </div>
      )}

      {/* 기본 정보 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <p className="text-sm font-semibold text-gray-900">기본 정보</p>

        <div>
          <label className="text-xs font-medium text-gray-600">이름</label>
          <input
            type="text"
            className="input-field mt-1 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">계정 이메일</label>
          <div className="mt-1 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-500">
            {initialEmail}
          </div>
          <p className="text-[10px] text-gray-400 mt-1">계정 이메일은 변경할 수 없습니다</p>
        </div>

        {/* 아바타 선택 */}
        <div>
          <label className="text-xs font-medium text-gray-600 mb-2 block">프로필 아바타</label>
          <div className="flex items-center gap-3 mb-3">
            <img
              src={selectedAvatar}
              alt="선택된 아바타"
              className="w-14 h-14 rounded-full object-cover ring-2 ring-teal-400 ring-offset-2"
            />
            <p className="text-xs text-gray-400">아래에서 아바타를 선택하세요</p>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {ALL_AVATARS.map((avatar) => (
              <button
                key={avatar}
                type="button"
                onClick={() => setSelectedAvatar(avatar)}
                className={`relative rounded-xl overflow-hidden aspect-square transition-all ${
                  selectedAvatar === avatar
                    ? "ring-2 ring-teal-400 ring-offset-2 scale-105"
                    : "hover:scale-105 hover:ring-2 hover:ring-teal-200"
                }`}
              >
                <img src={avatar} alt="아바타" className="w-full h-full object-cover" />
                {selectedAvatar === avatar && (
                  <div className="absolute inset-0 bg-teal-400/10 flex items-center justify-center">
                    <Icon name="Check" size={16} className="text-teal-500 drop-shadow" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-all"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </div>

      {/* 비밀번호 변경 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Icon name="Lock" size={16} className="text-gray-400" />
          비밀번호 변경
        </p>

        {(["current", "next", "confirm"] as const).map((field) => {
          const labels = { current: "현재 비밀번호", next: "새 비밀번호", confirm: "새 비밀번호 확인" };
          const placeholders = { current: "현재 비밀번호 입력", next: "6자 이상 입력", confirm: "새 비밀번호 재입력" };
          return (
            <div key={field}>
              <label className="text-xs font-medium text-gray-600">{labels[field]}</label>
              <div className="relative mt-1">
                <input
                  type={showPw[field] ? "text" : "password"}
                  className="input-field text-sm pr-9"
                  value={pwForm[field]}
                  onChange={(e) => setPwForm((p) => ({ ...p, [field]: e.target.value }))}
                  placeholder={placeholders[field]}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((p) => ({ ...p, [field]: !p[field] }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPw[field] ? <Icon name="Eye" size={14} /> : <Icon name="Eye" size={14} />}
                </button>
              </div>
            </div>
          );
        })}

        {pwMsg && (
          <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
            pwMsg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}>
            {pwMsg.type === "ok" ? <Icon name="Check" size={13} /> : <Icon name="Warning" size={13} />}
            {pwMsg.text}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handlePasswordSave}
            disabled={pwSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-all"
          >
            {pwSaving ? <Loader2 size={16} className="animate-spin" /> : <Icon name="Lock" size={16} />}
            {pwSaving ? "변경 중..." : "비밀번호 변경"}
          </button>
        </div>
      </div>
    </div>
  );
}
