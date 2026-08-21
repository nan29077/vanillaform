"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {UserCog, Save, Loader2, Briefcase, Phone, FileText, X, Lock, Bell} from 'lucide-react';
import ImageUploader from "@/components/shared/ImageUploader";
import SavedPopup from "@/components/shared/SavedPopup";

type Section = "admin" | "business" | "contact" | "settlement" | "password" | "notifications";

const BANKS = ["국민은행", "신한은행", "우리은행", "하나은행", "농협", "카카오뱅크", "토스뱅크", "기업은행", "SC제일은행", "새마을금고", "농협중앙회"];

export default function MiddleSettingsClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeSection, setActiveSection] = useState<Section>("admin");

  const [form, setForm] = useState({
    userName: "",
    avatar: "",
    companyName: "",
    bizNumber: "",
    contactPhone: "",
    bankName: "",
    accountNumber: "",
    accountHolder: "",
  });

  const [isApproved, setIsApproved] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  // 비밀번호 변경
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // 알림 (UI 전용)
  const [notifications, setNotifications] = useState({ settlement: true, seller: true, brand: true, marketing: false });
  const [notiSaved, setNotiSaved] = useState(false);

  // 저장 완료 팝업
  const [showSavedPopup, setShowSavedPopup] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/middle/settings");
        if (!res.ok) {
          setError("관리자 정보를 불러올 수 없습니다");
          setLoading(false);
          return;
        }
        const data = await res.json();
        const p = data.profile;
        setForm({
          userName: p.user?.name || p.name || "",
          avatar: p.user?.avatar || "",
          companyName: p.companyName || "",
          bizNumber: p.bizNumber || "",
          contactPhone: p.contactPhone || p.user?.phone || "",
          bankName: p.bankName || "",
          accountNumber: p.accountNumber || "",
          accountHolder: p.accountHolder || "",
        });
        setIsApproved(p.isApproved);
        setUserEmail(p.user?.email || "");
      } catch {
        setError("데이터 로딩 실패");
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!form.userName) {
      setError("관리자명은 필수입니다");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/middle/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSuccess("관리자 정보가 수정되었습니다");
        setTimeout(() => setSuccess(""), 3000);
        setShowSavedPopup(true);
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "수정 실패");
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

  const handleNotiSave = () => {
    setNotiSaved(true);
    setTimeout(() => setNotiSaved(false), 2000);
    setShowSavedPopup(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-brand-500 mx-auto mb-3" />
          <p className="text-sm text-gray-400">관리자 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const sections = [
    { key: "admin" as const, label: "관리자 정보", icon: UserCog },
    { key: "business" as const, label: "사업자 정보", icon: Briefcase },
    { key: "contact" as const, label: "담당자 연락처", icon: Phone },
    { key: "settlement" as const, label: "정산 계좌", icon: FileText },
    { key: "password" as const, label: "비밀번호", icon: Lock },
    { key: "notifications" as const, label: "알림 설정", icon: Bell },
  ];

  const notiList = [
    { key: "settlement" as const, label: "정산 알림", desc: "마진 정산 처리 및 지급" },
    { key: "seller" as const, label: "셀러 알림", desc: "관리 셀러 활동 소식" },
    { key: "brand" as const, label: "브랜드 알림", desc: "관리 브랜드 활동 소식" },
    { key: "marketing" as const, label: "마케팅 알림", desc: "이벤트, 프로모션 소식" },
  ];

  const showBottomSave = ["admin", "business", "contact", "settlement"].includes(activeSection);

  return (
    <div className="animate-fade-in">
      <SavedPopup show={showSavedPopup} onClose={() => setShowSavedPopup(false)} />
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Icon name="Settings" size={20} className="text-gray-400" />
            중간관리자 설정
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">관리자 정보를 관리하고 수정합니다</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full ${isApproved ? "text-green-600 bg-green-50 border border-green-200" : "text-yellow-600 bg-yellow-50 border border-yellow-200"}`}>
            {isApproved ? <><Icon name="Check" size={11} /> 승인됨</> : <><Icon name="Warning" size={11} /> 승인 대기</>}
          </span>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 flex items-center justify-between">
          <span className="flex items-center gap-2"><Icon name="Warning" size={14} /> {error}</span>
          <button onClick={() => setError("")}><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-xl text-xs text-green-600 flex items-center justify-between">
          <span className="flex items-center gap-2"><Icon name="Check" size={14} /> {success}</span>
          <button onClick={() => setSuccess("")}><X size={14} /></button>
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {sections.map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
              activeSection === s.key
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}>
            <s.icon size={16} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Form Content */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        {activeSection === "admin" && (
          <div className="space-y-5">
            <div className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Icon name="Settings" size={16} className="text-brand-500" /> 관리자 기본 정보
            </div>

            {/* 프로필 이미지 */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">프로필 이미지</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-200">
                  {form.avatar ? (
                    <img src={form.avatar} alt="프로필" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Icon name="Camera" size={24} />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <ImageUploader
                    images={form.avatar ? [form.avatar] : []}
                    onChange={urls => setForm(prev => ({ ...prev, avatar: urls[0] || "" }))}
                    maxImages={1}
                    compact
                  />
                  <p className="text-[10px] text-gray-400 mt-1">권장: 200x200px, JPG/PNG</p>
                </div>
              </div>
            </div>

            {/* 관리자명 */}
            <div>
              <label className="text-xs font-medium text-gray-600">관리자명 *</label>
              <input type="text" className="input-field mt-1 text-sm" value={form.userName}
                onChange={e => setForm({ ...form, userName: e.target.value })} placeholder="관리자 이름" />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">계정 이메일</label>
              <div className="mt-1 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-500">
                {userEmail}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">계정 이메일은 변경할 수 없습니다</p>
            </div>
          </div>
        )}

        {activeSection === "business" && (
          <div className="space-y-5">
            <div className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Briefcase size={16} className="text-brand-500" /> 사업자 정보
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
              <p className="text-xs text-yellow-700 flex items-center gap-1.5">
                <Icon name="Certified" size={12} /> 사업자 정보는 정산 및 세금계산서 발행에 사용됩니다
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">상호명</label>
              <input type="text" className="input-field mt-1 text-sm" value={form.companyName}
                onChange={e => setForm({ ...form, companyName: e.target.value })} placeholder="사업자 상호명" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">사업자등록번호</label>
              <input type="text" className="input-field mt-1 text-sm" value={form.bizNumber}
                onChange={e => setForm({ ...form, bizNumber: e.target.value })} placeholder="000-00-00000" />
            </div>
          </div>
        )}

        {activeSection === "contact" && (
          <div className="space-y-5">
            <div className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Icon name="Phone" size={16} className="text-brand-500" /> 담당자 연락처
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">담당자 이름</label>
              <input type="text" className="input-field mt-1 text-sm" value={form.userName}
                onChange={e => setForm({ ...form, userName: e.target.value })} placeholder="담당자 이름" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">계정 이메일</label>
              <div className="mt-1 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-500">
                {userEmail}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">계정 이메일은 변경할 수 없습니다</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">연락처 전화번호</label>
              <input type="tel" className="input-field mt-1 text-sm" value={form.contactPhone}
                onChange={e => setForm({ ...form, contactPhone: e.target.value })} placeholder="010-0000-0000" />
            </div>
          </div>
        )}

        {activeSection === "settlement" && (
          <div className="space-y-5">
            <div className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Icon name="File" size={16} className="text-brand-500" /> 정산 계좌
            </div>
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-[11px] text-blue-700">
                마진 정산 시 사용되는 계좌입니다. 최고관리자가 정산 처리 시 참고합니다.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">은행명</label>
              <select className="input-field mt-1 text-sm" value={form.bankName}
                onChange={e => setForm({ ...form, bankName: e.target.value })}>
                <option value="">선택</option>
                {BANKS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">계좌번호</label>
              <input type="text" className="input-field mt-1 text-sm" value={form.accountNumber}
                onChange={e => setForm({ ...form, accountNumber: e.target.value })} placeholder="계좌번호 (- 없이)" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">예금주</label>
              <input type="text" className="input-field mt-1 text-sm" value={form.accountHolder}
                onChange={e => setForm({ ...form, accountHolder: e.target.value })} placeholder="예금주명" />
            </div>
          </div>
        )}

        {activeSection === "password" && (
          <div className="space-y-5">
            <div className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Icon name="Lock" size={16} className="text-brand-500" /> 비밀번호 변경
            </div>

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
        )}

        {activeSection === "notifications" && (
          <div className="space-y-5">
            <div className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Icon name="Notification" size={16} className="text-brand-500" /> 알림 설정
            </div>

            <div className="space-y-2">
              {notiList.map((n) => (
                <div key={n.key} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                  <div>
                    <p className="text-[13px] font-medium text-gray-800">{n.label}</p>
                    <p className="text-[10px] text-gray-400">{n.desc}</p>
                  </div>
                  <button
                    onClick={() => setNotifications((p) => ({ ...p, [n.key]: !p[n.key] }))}
                    className={`relative w-10 rounded-full transition-colors flex-shrink-0 ${
                      notifications[n.key] ? "bg-brand-600" : "bg-gray-300"
                    }`}
                    style={{ height: "22px" }}
                  >
                    <div
                      className="absolute rounded-full bg-white shadow-sm transition-transform"
                      style={{ width: "18px", height: "18px", top: "2px", left: "2px", transform: notifications[n.key] ? "translateX(18px)" : "translateX(0)" }}
                    />
                  </button>
                </div>
              ))}
            </div>

            {notiSaved && (
              <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-green-50 text-green-700">
                <Icon name="Check" size={13} /> 저장되었습니다
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleNotiSave}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all"
              >
                <Save size={16} /> 저장하기
              </button>
            </div>
          </div>
        )}

        {/* Save Button (프로필 성격 섹션에만 노출) */}
        {showBottomSave && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-all"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "저장 중..." : "저장하기"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
