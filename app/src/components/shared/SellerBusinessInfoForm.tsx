"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { useRouter } from "next/navigation";
import {Building2, Save} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";

interface SellerBusinessInfoFormProps {
  initialData: {
    businessType: string | null;
    representativeName: string | null;
    businessRegistrationNo: string | null;
    telecomSalesLicenseNo: string | null;
    businessAddress: string | null;
    businessCategory: string | null;
  };
}

export default function SellerBusinessInfoForm({ initialData }: SellerBusinessInfoFormProps) {
  const router = useRouter();
  const { appAlert } = useAppDialog();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    businessType: initialData.businessType || "non_business",
    representativeName: initialData.representativeName || "",
    businessRegistrationNo: initialData.businessRegistrationNo || "",
    telecomSalesLicenseNo: initialData.telecomSalesLicenseNo || "",
    businessAddress: initialData.businessAddress || "",
    businessCategory: initialData.businessCategory || "",
  });

  const isBusiness = form.businessType === "business";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSaved(false);

    try {
      const res = await fetch("/api/seller/business-info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 3000);
      } else {
        appAlert("저장에 실패했습니다.");
      }
    } catch {
      appAlert("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Building2 size={16} strokeWidth={1.5} className="text-brand-500" />
          사업자 관리
        </h3>
        {saved && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <Icon name="Check" size={13} />
            저장 완료
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 사업자/비사업자 선택 */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">사업자 유형</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`p-3 rounded-xl border text-left transition-all ${
                form.businessType === "non_business"
                  ? "border-brand-500 bg-brand-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              onClick={() => setForm({ ...form, businessType: "non_business" })}
            >
              <p className="text-sm font-medium">비사업자</p>
              <p className="text-[10px] text-gray-400 mt-0.5">사업자등록 없이 판매</p>
            </button>
            <button
              type="button"
              className={`p-3 rounded-xl border text-left transition-all ${
                form.businessType === "business"
                  ? "border-brand-500 bg-brand-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              onClick={() => setForm({ ...form, businessType: "business" })}
            >
              <p className="text-sm font-medium">사업자</p>
              <p className="text-[10px] text-gray-400 mt-0.5">사업자등록 보유</p>
            </button>
          </div>
        </div>

        {/* 사업자 정보 입력 (사업자 선택 시에만 표시) */}
        {isBusiness && (
          <div className="bg-gray-50 rounded-xl p-4 space-y-3 animate-fade-in">
            <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
              <Icon name="File" size={13} />
              사업자 정보 입력
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  대표자명 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Icon name="MyPage" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    className="input-field text-sm pl-9"
                    placeholder="대표자 이름"
                    value={form.representativeName}
                    onChange={(e) => setForm({ ...form, representativeName: e.target.value })}
                    required={isBusiness}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  사업자등록번호 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Icon name="File" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    className="input-field text-sm pl-9"
                    placeholder="000-00-00000"
                    value={form.businessRegistrationNo}
                    onChange={(e) => setForm({ ...form, businessRegistrationNo: e.target.value })}
                    required={isBusiness}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  통신판매업번호 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Icon name="Phone" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    className="input-field text-sm pl-9"
                    placeholder="제0000-서울강남-00000호"
                    value={form.telecomSalesLicenseNo}
                    onChange={(e) => setForm({ ...form, telecomSalesLicenseNo: e.target.value })}
                    required={isBusiness}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">업종/업태</label>
                <input
                  type="text"
                  className="input-field text-sm"
                  placeholder="도소매 / 전자상거래"
                  value={form.businessCategory}
                  onChange={(e) => setForm({ ...form, businessCategory: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">사업장 주소</label>
              <div className="relative">
                <Icon name="Location" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  className="input-field text-sm pl-9"
                  placeholder="사업장 주소"
                  value={form.businessAddress}
                  onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
                />
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-3 mt-2">
              <p className="text-[10px] text-blue-600 leading-relaxed">
                💡 입력하신 사업자 정보는 라이브 셀러샵 하단(풋터)에 판매자 정보로 표시됩니다.
                정확한 정보를 입력해 주세요.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            className="btn-primary text-sm flex items-center gap-1.5"
            disabled={loading}
          >
            <Save size={14} />
            {loading ? "저장 중..." : "사업자 정보 저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
