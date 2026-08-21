"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useEffect } from "react";
import {Save, X, GripVertical, Loader2, Coffee, Moon} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";
import SavedPopup from "@/components/shared/SavedPopup";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  isActive: boolean;
  sortOrder: number;
}

interface ContactSettings {
  phone: string;
  email: string;
  operatingHours: string;
  lunchBreak: string;
  offHoursNotice: string;
  chatTerminationNotice: string;
  faqs: FAQ[];
  updatedAt: string;
}

export default function AdminContactSettingsPage() {
    const { appConfirm, appAlert } = useAppDialog();
const [settings, setSettings] = useState<ContactSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSavedPopup, setShowSavedPopup] = useState(false);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [showAddFaq, setShowAddFaq] = useState(false);
  const [newFaq, setNewFaq] = useState({ question: "", answer: "" });

  useEffect(() => {
    fetch("/api/admin/contact-settings")
      .then((r) => r.json())
      .then((d) => setSettings(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/contact-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setSaved(true);
        setShowSavedPopup(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {}
    setSaving(false);
  };

  const addFaq = () => {
    if (!settings || !newFaq.question.trim() || !newFaq.answer.trim()) return;
    const maxOrder = settings.faqs.length > 0 ? Math.max(...settings.faqs.map((f) => f.sortOrder)) : 0;
    const faq: FAQ = {
      id: `f${Date.now()}`,
      question: newFaq.question.trim(),
      answer: newFaq.answer.trim(),
      isActive: true,
      sortOrder: maxOrder + 1,
    };
    setSettings({ ...settings, faqs: [...settings.faqs, faq] });
    setNewFaq({ question: "", answer: "" });
    setShowAddFaq(false);
  };

  const updateFaq = (id: string, updates: Partial<FAQ>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      faqs: settings.faqs.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    });
  };

  const deleteFaq = async (id: string) => {
    if (!settings) return;
    if (!await appConfirm("정말 삭제하시겠습니까?")) return;
    setSettings({ ...settings, faqs: settings.faqs.filter((f) => f.id !== id) });
  };

  const moveFaq = (id: string, direction: "up" | "down") => {
    if (!settings) return;
    const sorted = [...settings.faqs].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((f) => f.id === id);
    if (direction === "up" && idx > 0) {
      const temp = sorted[idx].sortOrder;
      sorted[idx].sortOrder = sorted[idx - 1].sortOrder;
      sorted[idx - 1].sortOrder = temp;
    } else if (direction === "down" && idx < sorted.length - 1) {
      const temp = sorted[idx].sortOrder;
      sorted[idx].sortOrder = sorted[idx + 1].sortOrder;
      sorted[idx + 1].sortOrder = temp;
    }
    setSettings({ ...settings, faqs: sorted });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!settings) return null;

  const activeFaqs = settings.faqs.filter((f) => f.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const sortedFaqs = [...settings.faqs].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="animate-fade-in max-w-3xl">
      <SavedPopup show={showSavedPopup} onClose={() => setShowSavedPopup(false)} />
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Icon name="CustomerService" size={20} className="text-brand-500" /> 고객센터 설정
          </h1>
          <p className="text-sm text-gray-500">
            응대시간, 챗봇 FAQ를 관리하고 메인 페이지에 자동 동기화됩니다
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary text-sm flex items-center gap-1.5"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : saved ? (
            <Icon name="Check" size={14} />
          ) : (
            <Save size={14} />
          )}
          {saving ? "저장 중..." : saved ? "저장 완료!" : "설정 저장"}
        </button>
      </div>

      {saved && (
        <div className="mb-4 flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-xl px-4 py-2.5 border border-green-100">
          <Icon name="Check" size={16} /> 설정이 저장되었습니다. 메인 페이지에 즉시 반영됩니다.
        </div>
      )}

      {/* Operating Hours */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
        <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Icon name="Clock" size={16} className="text-blue-500" /> 응대 시간 설정
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              <Icon name="Phone" size={11} className="inline mr-1" />전화번호
            </label>
            <input
              type="text"
              value={settings.phone}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="input-field text-sm !py-2"
              placeholder="02-1234-5678"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              <Icon name="Mail" size={11} className="inline mr-1" />이메일
            </label>
            <input
              type="email"
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              className="input-field text-sm !py-2"
              placeholder="support@example.com"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              <Icon name="Clock" size={11} className="inline mr-1" />운영시간
            </label>
            <input
              type="text"
              value={settings.operatingHours}
              onChange={(e) => setSettings({ ...settings, operatingHours: e.target.value })}
              className="input-field text-sm !py-2"
              placeholder="평일 09:00 ~ 18:00"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              <Coffee size={11} className="inline mr-1" />점심시간
            </label>
            <input
              type="text"
              value={settings.lunchBreak}
              onChange={(e) => setSettings({ ...settings, lunchBreak: e.target.value })}
              className="input-field text-sm !py-2"
              placeholder="점심시간 12:00 ~ 13:00"
            />
          </div>
        </div>
      </div>

      {/* Notices */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
        <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Moon size={16} className="text-indigo-500" /> 안내 메시지
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              업무 외 시간 안내 메시지
            </label>
            <textarea
              value={settings.offHoursNotice}
              onChange={(e) => setSettings({ ...settings, offHoursNotice: e.target.value })}
              className="input-field text-sm !py-2 h-16 resize-none"
              placeholder="영업시간 외 안내 메시지"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              상담 종료 안내 메시지
            </label>
            <textarea
              value={settings.chatTerminationNotice}
              onChange={(e) => setSettings({ ...settings, chatTerminationNotice: e.target.value })}
              className="input-field text-sm !py-2 h-16 resize-none"
              placeholder="상담 종료 시 안내 메시지"
            />
          </div>
        </div>
      </div>

      {/* FAQ Management */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Icon name="Message" size={16} className="text-brand-500" /> 챗봇 FAQ 관리
            <span className="text-xs text-gray-400 font-normal">
              ({activeFaqs.length}개 활성 / {settings.faqs.length}개 전체)
            </span>
          </h2>
          <button
            onClick={() => setShowAddFaq(true)}
            className="text-sm flex items-center gap-1 px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
          >
            <Icon name="Plus" size={14} /> FAQ 추가
          </button>
        </div>

        {/* Add FAQ form */}
        {showAddFaq && (
          <div className="mb-4 bg-brand-50 rounded-xl p-4 border border-brand-100">
            <h3 className="text-xs font-bold text-brand-700 mb-3">새 FAQ 추가</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">질문 *</label>
                <input
                  type="text"
                  value={newFaq.question}
                  onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
                  className="input-field text-sm !py-2"
                  placeholder="자주 묻는 질문을 입력하세요"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">답변 *</label>
                <textarea
                  value={newFaq.answer}
                  onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
                  className="input-field text-sm !py-2 h-20 resize-none"
                  placeholder="답변을 입력하세요"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowAddFaq(false); setNewFaq({ question: "", answer: "" }); }}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                >
                  취소
                </button>
                <button
                  onClick={addFaq}
                  disabled={!newFaq.question.trim() || !newFaq.answer.trim()}
                  className="px-4 py-1.5 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-40"
                >
                  추가
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FAQ list */}
        <div className="space-y-2">
          {sortedFaqs.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Icon name="Message" size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">FAQ가 없습니다. 추가해 주세요.</p>
            </div>
          ) : (
            sortedFaqs.map((faq) => (
              <div
                key={faq.id}
                className={`rounded-xl border p-3 transition-all ${
                  faq.isActive ? "border-gray-100 bg-white" : "border-gray-200 bg-gray-50 opacity-60"
                }`}
              >
                {editingFaqId === faq.id ? (
                  /* Edit mode */
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={faq.question}
                      onChange={(e) => updateFaq(faq.id, { question: e.target.value })}
                      className="input-field text-sm !py-2"
                      placeholder="질문"
                    />
                    <textarea
                      value={faq.answer}
                      onChange={(e) => updateFaq(faq.id, { answer: e.target.value })}
                      className="input-field text-sm !py-2 h-20 resize-none"
                      placeholder="답변"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={() => setEditingFaqId(null)}
                        className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg"
                      >
                        <Icon name="Check" size={12} className="inline mr-1" /> 완료
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{faq.question}</p>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{faq.answer}</p>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={() => moveFaq(faq.id, "up")}
                          className="p-1 text-gray-300 hover:text-gray-600"
                          title="위로"
                        >
                          <Icon name="ChevronDown" size={14} className="rotate-180" />
                        </button>
                        <button
                          onClick={() => moveFaq(faq.id, "down")}
                          className="p-1 text-gray-300 hover:text-gray-600"
                          title="아래로"
                        >
                          <Icon name="ChevronDown" size={14} />
                        </button>
                        <button
                          onClick={() => setEditingFaqId(faq.id)}
                          className="p-1 text-gray-400 hover:text-brand-600"
                          title="수정"
                        >
                          <Icon name="Edit" size={13} />
                        </button>
                        <button
                          onClick={() => updateFaq(faq.id, { isActive: !faq.isActive })}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title={faq.isActive ? "비활성화" : "활성화"}
                        >
                          {faq.isActive ? <Icon name="Eye" size={13} /> : <Icon name="Eye" size={13} />}
                        </button>
                        <button
                          onClick={() => deleteFaq(faq.id)}
                          className="p-1 text-gray-400 hover:text-red-500"
                          title="삭제"
                        >
                          <Icon name="Delete" size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${faq.isActive ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                        {faq.isActive ? "활성" : "비활성"}
                      </span>
                      <span className="text-[9px] text-gray-300">순서: {faq.sortOrder}</span>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <Icon name="Warning" size={12} />
            <span>설정 저장 후 메인 페이지 챗봇에 자동으로 반영됩니다.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
