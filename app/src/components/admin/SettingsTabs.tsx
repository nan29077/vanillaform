"use client";

import { useState } from "react";
import { Percent, SlidersHorizontal, ClipboardList } from "lucide-react";

type TabKey = "fee" | "feature" | "register";

const TABS: { key: TabKey; label: string; icon: typeof Percent }[] = [
  { key: "fee", label: "플랫폼 수수료", icon: Percent },
  { key: "feature", label: "기능·정산 설정", icon: SlidersHorizontal },
  { key: "register", label: "회원가입 항목", icon: ClipboardList },
];

export default function SettingsTabs({
  feeForm,
  featureForm,
  registerForm,
}: {
  feeForm: React.ReactNode;
  featureForm: React.ReactNode;
  registerForm: React.ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("fee");

  return (
    <div>
      {/* 탭 바 (border-b 방식 — 대시보드 톤) */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-5">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
                active
                  ? "border-brand-500 text-brand-700"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon size={15} strokeWidth={active ? 2 : 1.75} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 선택된 탭 콘텐츠 */}
      <div>{tab === "fee" ? feeForm : tab === "feature" ? featureForm : registerForm}</div>
    </div>
  );
}
