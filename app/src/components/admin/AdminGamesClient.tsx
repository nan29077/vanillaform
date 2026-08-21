"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import {Gamepad2, Save, Layers, LayoutTemplate} from 'lucide-react';

export type OverlayStyle = "classic" | "card";

export interface GameTypeRow {
  type: string;
  label: string;
  desc: string;
  sellerVisible: boolean;
  overlayStyle: OverlayStyle;
}

export default function AdminGamesClient({ rows }: { rows: GameTypeRow[] }) {
  const [items, setItems] = useState<GameTypeRow[]>(rows);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };

  const setVisible = (type: string, sellerVisible: boolean) =>
    setItems((prev) => prev.map((r) => (r.type === type ? { ...r, sellerVisible } : r)));

  const setStyle = (type: string, overlayStyle: OverlayStyle) =>
    setItems((prev) => prev.map((r) => (r.type === type ? { ...r, overlayStyle } : r)));

  const handleSave = async () => {
    setSaving(true);
    try {
      const gameTypes: Record<string, { sellerVisible: boolean; overlayStyle: OverlayStyle }> = {};
      for (const r of items) {
        gameTypes[r.type] = { sellerVisible: r.sellerVisible, overlayStyle: r.overlayStyle };
      }
      const res = await fetch("/api/admin/game-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameTypes }),
      });
      if (res.ok) showToast("게임 설정이 저장되었습니다");
      else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "저장에 실패했습니다", false);
      }
    } catch {
      showToast("오류가 발생했습니다", false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Gamepad2 size={20} className="text-brand-500" />
            게임관리
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            게임 유형별 셀러 노출 여부와 오버레이 스타일을 설정합니다
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-black text-sm font-semibold shadow-sm transition-colors shrink-0"
        >
          <Save size={15} />
          {saving ? "저장 중..." : "설정 저장"}
        </button>
      </div>

      {/* 안내 배너 */}
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 mb-6">
        <Icon name="Warning" size={15} className="text-amber-500 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <b>셀러 노출</b>을 끄면 해당 게임 유형은 셀러의 게임관리 화면에서 숨겨져 새로 만들 수 없습니다.
          <b>오버레이 스타일</b>은 <b>?overlay=true</b> 방송 화면의 표시 방식을 결정합니다.
          (기존 스타일 = 현재 동작 그대로, 새 카드 스타일 = 로고·제목·게임 카드 레이아웃)
        </p>
      </div>

      {/* 데스크톱 테이블 */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              <th className="px-4 py-3">게임 유형</th>
              <th className="px-4 py-3">설명</th>
              <th className="px-4 py-3 text-center whitespace-nowrap">셀러 노출</th>
              <th className="px-4 py-3">오버레이 스타일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((r) => (
              <tr key={r.type} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{r.label}</td>
                <td className="px-4 py-3 text-gray-500 text-[13px] max-w-xs">{r.desc}</td>
                <td className="px-4 py-3 text-center">
                  <Toggle
                    checked={r.sellerVisible}
                    onChange={(v) => setVisible(r.type, v)}
                    label={r.label}
                  />
                </td>
                <td className="px-4 py-3">
                  <StyleSelect value={r.overlayStyle} onChange={(v) => setStyle(r.type, v)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드 */}
      <div className="md:hidden space-y-3">
        {items.map((r) => (
          <div key={r.type} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{r.label}</p>
                <p className="text-[12px] text-gray-500 mt-0.5">{r.desc}</p>
              </div>
              <Toggle
                checked={r.sellerVisible}
                onChange={(v) => setVisible(r.type, v)}
                label={r.label}
              />
            </div>
            <StyleSelect value={r.overlayStyle} onChange={(v) => setStyle(r.type, v)} />
          </div>
        ))}
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[70] animate-toast-slide-down">
          <div className="bg-gray-900 text-white text-[13px] font-medium px-5 py-3 rounded-full shadow-xl flex items-center gap-2">
            {toast.ok ? (
              <Icon name="Check" size={16} className="text-emerald-400" />
            ) : (
              <Icon name="Warning" size={16} className="text-amber-400" />
            )}
            {toast.msg}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes toast-slide-down {
          0% { opacity: 0; transform: translate(-50%, -20px); }
          100% { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-toast-slide-down { animation: toast-slide-down 0.3s ease-out; }
      `}</style>
    </div>
  );
}

/* ─── 셀러 노출 스위치 ─── */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${label} 셀러 노출`}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? "bg-brand-500" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-flex h-5 w-5 items-center justify-center transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      >
        {checked ? (
          <Icon name="Eye" size={11} className="text-brand-600" />
        ) : (
          <Icon name="Eye" size={11} className="text-gray-400" />
        )}
      </span>
    </button>
  );
}

/* ─── 오버레이 스타일 선택 (토글) ─── */
function StyleSelect({
  value,
  onChange,
}: {
  value: OverlayStyle;
  onChange: (v: OverlayStyle) => void;
}) {
  const OPTIONS: { id: OverlayStyle; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { id: "classic", label: "기존 스타일", icon: Layers },
    { id: "card", label: "새 카드 스타일", icon: LayoutTemplate },
  ];
  return (
    <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
      {OPTIONS.map((o) => {
        const Icon = o.icon;
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all ${
              active
                ? "bg-white text-brand-700 shadow-sm"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <Icon size={13} className={active ? "text-brand-500" : "text-gray-300"} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
