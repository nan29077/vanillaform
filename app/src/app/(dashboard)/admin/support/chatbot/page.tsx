"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useEffect } from "react";
import {Bot, Loader2, Power} from 'lucide-react';

export default function AdminChatbotPage() {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/chatbot-settings")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.enabled === "boolean") setEnabled(d.enabled);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async () => {
    if (saving) return;
    const next = !enabled;
    setEnabled(next); // 낙관적 업데이트
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/chatbot-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setEnabled(!next); // 롤백
      }
    } catch {
      setEnabled(!next); // 롤백
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Bot size={20} className="text-amber-500" /> 챗봇 관리
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">구매자 페이지의 문의하기(챗봇) 노출 여부를 관리합니다.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                  enabled ? "bg-amber-50 text-amber-500" : "bg-gray-100 text-gray-400"
                }`}
              >
                <Power size={22} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-base font-bold text-gray-900">
                  {enabled ? "챗봇 활성화 중" : "챗봇 비활성화됨"}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {enabled
                    ? "구매자 페이지에 문의하기 버튼이 표시됩니다."
                    : "구매자 페이지에서 문의하기 버튼이 숨겨집니다."}
                </p>
              </div>
            </div>

            {/* 큰 토글 스위치 (amber) */}
            <button
              onClick={handleToggle}
              disabled={saving}
              role="switch"
              aria-checked={enabled}
              aria-label="챗봇 활성화 토글"
              className={`relative inline-flex h-9 w-16 flex-shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-60 ${
                enabled ? "bg-amber-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-7 w-7 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                  enabled ? "translate-x-8" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {saved && (
            <div className="mt-4 flex items-center gap-1.5 text-xs text-green-600">
              <Icon name="Check" size={14} /> 저장되었습니다.
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-500 leading-relaxed">
              챗봇을 끄면 구매자 화면 우측 하단의 문의하기 버튼과 FAQ·1:1 문의 창이 모두 노출되지 않습니다.
              FAQ 내용과 고객센터 정보는 <span className="font-medium text-gray-700">고객센터 설정</span> 메뉴에서
              관리할 수 있으며, 접수된 1:1 문의는 <span className="font-medium text-gray-700">문의 관리</span> 메뉴에서
              확인할 수 있습니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
