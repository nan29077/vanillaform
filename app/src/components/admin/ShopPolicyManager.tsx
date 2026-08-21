"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useEffect } from "react";
import {Save, Loader2} from 'lucide-react';

const POLICIES = [
  {
    key: "refundPolicy",
    label: "교환·환불 규정",
    placeholder: `교환 및 환불 규정 내용을 입력하세요.

예시:
1. 특가 제품 (교환·환불 불가) 단순 변심에 의한 교환 및 환불은 불가합니다.
2. 상품 불량 또는 오배송 수령 후 7일 이내 고객센터로 문의해 주세요.
3. 교환·반품 배송비 단순 변심: 왕복 배송비 고객 부담. 제품 불량: 배송비 무료.
※ 법적 안내  소비자분쟁해결기준에 따라 피해보상이 이루어집니다.`,
  },
  {
    key: "shippingPolicy",
    label: "배송 정책",
    placeholder: `배송 안내 내용을 입력하세요.

예시:
- 배송기간: 결제 완료 후 3~5 영업일 이내 출고
- 도서산간 지역은 추가 1~2일 소요될 수 있습니다.
- 천재지변 등 불가항력적 상황에서는 배송이 지연될 수 있습니다.`,
  },
  {
    key: "usagePolicy",
    label: "이용 안내",
    placeholder: `서비스 이용 안내 내용을 입력하세요.

예시:
- 본 서비스는 만 14세 이상 이용 가능합니다.
- 주문 완료 후 취소는 출고 전까지만 가능합니다.
- 문의사항은 고객센터를 통해 접수해 주세요.`,
  },
];

export default function ShopPolicyManager() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // SNS 라이브 연동 토글 (Setting key: enableSnsLive, 기본값 true)
  const [snsLive, setSnsLive] = useState(true);
  const [snsSaving, setSnsSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/site-config")
      .then((r) => r.json())
      .then((data) => {
        setValues(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch("/api/admin/site-config?key=enableSnsLive")
      .then((r) => r.json())
      .then((data) => setSnsLive(data?.value !== "false"))
      .catch(() => {});
  }, []);

  const handleToggleSnsLive = async () => {
    if (snsSaving) return;
    const next = !snsLive;
    setSnsLive(next);
    setSnsSaving(true);
    try {
      await fetch("/api/admin/site-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "enableSnsLive", value: next ? "true" : "false" }),
      });
    } catch {
      setSnsLive(!next); // 롤백
    } finally {
      setSnsSaving(false);
    }
  };

  const handleSave = async (key: string) => {
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      await fetch("/api/admin/site-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: values[key] ?? "" }),
      });
      setSaved((s) => ({ ...s, [key]: true }));
      setTimeout(() => setSaved((s) => ({ ...s, [key]: false })), 2000);
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 라이브 커머스 관리 */}
      <div>
        <h2 className="text-sm font-bold text-gray-900">라이브 커머스 관리</h2>
        <div className="mt-2 bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
              <Icon name="Live" size={16} className="text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">SNS 라이브 연동 (외부 플랫폼)</p>
              <p className="text-xs text-gray-500 mt-0.5">
                켜면 셀러의 새 라이브 생성 시 외부 라이브 플랫폼(YouTube 등) 연동 옵션이 표시됩니다
              </p>
            </div>
            {snsSaving ? (
              <Loader2 size={18} className="animate-spin text-gray-400 flex-shrink-0" />
            ) : (
              <button
                type="button"
                onClick={handleToggleSnsLive}
                aria-label={snsLive ? "SNS 라이브 연동 끄기" : "SNS 라이브 연동 켜기"}
                className={`relative w-11 rounded-full transition-colors flex-shrink-0 ${snsLive ? "bg-brand-600" : "bg-gray-300"}`}
                style={{ height: "24px" }}
              >
                <span
                  className="absolute rounded-full bg-white shadow-sm transition-transform"
                  style={{ width: "20px", height: "20px", top: "2px", left: "2px", transform: snsLive ? "translateX(20px)" : "translateX(0)" }}
                />
              </button>
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-bold text-gray-900">라이브 셀러샵 정책 관리</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          저장된 내용은 각 상품 상세페이지 배송/교환 탭에 표시됩니다.
        </p>
      </div>

      {POLICIES.map(({ key, label, placeholder }) => (
        <div key={key} className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-800">{label}</label>
            <button
              onClick={() => handleSave(key)}
              disabled={saving[key]}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60 transition-colors"
            >
              {saving[key] ? (
                <Loader2 size={12} className="animate-spin" />
              ) : saved[key] ? (
                <Icon name="Check" size={12} />
              ) : (
                <Save size={12} />
              )}
              {saved[key] ? "저장됨" : "저장"}
            </button>
          </div>
          <textarea
            className="w-full input-field h-48 resize-y text-sm font-mono"
            placeholder={placeholder}
            value={values[key] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          />
        </div>
      ))}
    </div>
  );
}
