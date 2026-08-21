"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { useRouter } from "next/navigation";
import {Save, Loader2} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";
import SavedPopup from "@/components/shared/SavedPopup";

export default function NodeSettingsForm({ initialNodeEnabled }: { initialNodeEnabled: boolean }) {
  const router = useRouter();
  const { appAlert } = useAppDialog();
  const [nodeEnabled, setNodeEnabled] = useState(initialNodeEnabled);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSavedPopup, setShowSavedPopup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/system-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeEnabled }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        await appAlert(d.error || "저장에 실패했습니다");
        return;
      }
      const data = await res.json();
      setNodeEnabled(data.nodeEnabled);
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
          <Icon name="Package" size={16} className="text-gray-700" />
          <h2 className="text-sm font-bold text-gray-900">노드 설정</h2>
        </div>
        <p className="text-[11px] text-gray-400 mb-3">노드(NODE) 계정 시스템을 켜고 끕니다.</p>

        <div className="py-3.5 border-t border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm font-medium text-gray-900">노드 활성화</p>
            <button
              type="button"
              role="switch"
              aria-checked={nodeEnabled}
              onClick={() => {
                setSaved(false);
                setNodeEnabled((v) => !v);
              }}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                nodeEnabled ? "bg-brand-500" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  nodeEnabled ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed pr-14">
            노드는 중간관리자·브랜드가 등록한 상품에 마진을 한 번 더 설정한 뒤 최고관리자 승인 단계로 넘기는
            중간 역할입니다. <b>켜면</b> 노드 계정이 노드 대시보드(주문관리)에 접근할 수 있고, 노드로 들어온 상품에
            마진을 설정해 최종 등록할 수 있습니다. <b>끄면</b> 노드 대시보드 접근이 차단되고, 상품 흐름은 노드 단계를
            건너뛴 기존 방식(중간관리자·브랜드 → 최고관리자 승인 → 셀러 신청)으로 동작합니다.
          </p>
        </div>

        <div className="flex items-start gap-1.5 rounded-lg bg-gray-50 p-2.5 mt-1">
          <Icon name="Info" size={13} strokeWidth={1.75} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-gray-500 leading-relaxed">
            노드가 최종 등록한 상품은 이미 설정된 마진 데이터가 보존되며, 노드를 껐다 켜도 데이터는 유지됩니다.
          </p>
        </div>
      </section>

      {/* 노드 계정 정보 */}
      <section className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="MyPage" size={16} className="text-gray-700" />
          <h2 className="text-sm font-bold text-gray-900">노드 계정 정보</h2>
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Icon name="MyPage" size={13} className="text-gray-400 flex-shrink-0" />
              <span className="text-[11px] text-gray-500">아이디 (이메일)</span>
            </div>
            <span className="text-xs font-mono font-semibold text-gray-800 select-all">node@vanillaform.local</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Icon name="Lock" size={13} className="text-gray-400 flex-shrink-0" />
              <span className="text-[11px] text-gray-500">비밀번호</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-gray-800 select-all">
                {showPassword ? "Node1234!" : "••••••••"}
              </span>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              >
                {showPassword ? <Icon name="Eye" size={14} /> : <Icon name="Eye" size={14} />}
              </button>
            </div>
          </div>
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
            <Icon name="Check" size={14} /> 저장되었습니다
          </span>
        )}
      </div>
    </div>
  );
}
