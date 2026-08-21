"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {Building2, Save, Loader2, ChevronRight, User, Phone, Mail, MapPin, FileText, Briefcase, Tag, X} from 'lucide-react';

import SavedPopup from "@/components/shared/SavedPopup";

interface BrandData {
  id: string;
  brandName: string;
  description: string | null;
  isApproved: boolean;
  businessRegistrationNo: string | null;
  representativeName: string | null;
  businessAddress: string | null;
  businessType: string | null;
  businessCategory: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  user: { name: string; email: string; avatar: string | null };
}

export default function BrandSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeSection, setActiveSection] = useState<"brand" | "business" | "contact" | "settlement">("brand");

  const [form, setForm] = useState({
    brandName: "",
    description: "",
    businessRegistrationNo: "",
    representativeName: "",
    businessAddress: "",
    businessType: "",
    businessCategory: "",
    contactPhone: "",
    contactEmail: "",
    userName: "",
    bankName: "",
    accountNumber: "",
    accountHolder: "",
  });

  const [isApproved, setIsApproved] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  // 저장 완료 팝업
  const [showSavedPopup, setShowSavedPopup] = useState(false);

  // Fetch brand data
  useEffect(() => {
    const fetchBrand = async () => {
      try {
        const res = await fetch("/api/brand/settings");
        if (!res.ok) {
          setError("브랜드 정보를 불러올 수 없습니다");
          setLoading(false);
          return;
        }
        const data = await res.json();
        const b: BrandData = data.brand;
        setForm({
          brandName: b.brandName || "",
          description: b.description || "",
          businessRegistrationNo: b.businessRegistrationNo || "",
          representativeName: b.representativeName || "",
          businessAddress: b.businessAddress || "",
          businessType: b.businessType || "",
          businessCategory: b.businessCategory || "",
          contactPhone: b.contactPhone || "",
          contactEmail: b.contactEmail || "",
          userName: b.user.name || "",
          bankName: (b as any).bankName || "",
          accountNumber: (b as any).accountNumber || "",
          accountHolder: (b as any).accountHolder || "",
        });
        setIsApproved(b.isApproved);
        setUserEmail(b.user.email);
      } catch {
        setError("데이터 로딩 실패");
      }
      setLoading(false);
    };
    fetchBrand();
  }, []);

  const handleSave = async () => {
    if (!form.brandName) {
      setError("브랜드명은 필수입니다");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/brand/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSuccess("브랜드 정보가 수정되었습니다");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-brand-500 mx-auto mb-3" />
          <p className="text-sm text-gray-400">브랜드 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const sections = [
    { key: "brand" as const, label: "브랜드 정보", icon: Building2, description: "이름, 소개" },
    { key: "business" as const, label: "사업자 정보", icon: Briefcase, description: "사업자등록번호, 대표자, 주소" },
    { key: "contact" as const, label: "담당자 연락처", icon: Phone, description: "이름, 이메일, 전화번호" },
    { key: "settlement" as const, label: "정산 계좌", icon: FileText, description: "은행, 계좌번호, 예금주" },
  ];

  return (
    <div className="animate-fade-in">
      <SavedPopup show={showSavedPopup} onClose={() => setShowSavedPopup(false)} />
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Icon name="Settings" size={20} className="text-gray-400" />
            브랜드 설정
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">브랜드 정보를 관리하고 수정합니다</p>
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
        {activeSection === "brand" && (
          <div className="space-y-5">
            <div className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Building2 size={16} className="text-brand-500" /> 브랜드 기본 정보
            </div>

            {/* Brand Name */}
            <div>
              <label className="text-xs font-medium text-gray-600">브랜드명 *</label>
              <input type="text" className="input-field mt-1 text-sm" value={form.brandName}
                onChange={e => setForm({ ...form, brandName: e.target.value })} placeholder="브랜드 이름" />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-gray-600">브랜드 소개</label>
              <textarea className="input-field mt-1 h-28 resize-none text-sm" value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })} placeholder="브랜드를 소개해주세요..." />
              <p className="text-[10px] text-gray-400 mt-1">{form.description.length}/500자</p>
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
              <label className="text-xs font-medium text-gray-600">사업자등록번호</label>
              <input type="text" className="input-field mt-1 text-sm" value={form.businessRegistrationNo}
                onChange={e => setForm({ ...form, businessRegistrationNo: e.target.value })} placeholder="000-00-00000" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">대표자명</label>
              <input type="text" className="input-field mt-1 text-sm" value={form.representativeName}
                onChange={e => setForm({ ...form, representativeName: e.target.value })} placeholder="대표자 이름" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">사업장 주소</label>
              <input type="text" className="input-field mt-1 text-sm" value={form.businessAddress}
                onChange={e => setForm({ ...form, businessAddress: e.target.value })} placeholder="사업장 주소" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">업종</label>
                <input type="text" className="input-field mt-1 text-sm" value={form.businessType}
                  onChange={e => setForm({ ...form, businessType: e.target.value })} placeholder="예: 소매" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">업태</label>
                <input type="text" className="input-field mt-1 text-sm" value={form.businessCategory}
                  onChange={e => setForm({ ...form, businessCategory: e.target.value })} placeholder="예: 화장품" />
              </div>
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
              <label className="text-xs font-medium text-gray-600">연락처 이메일</label>
              <input type="email" className="input-field mt-1 text-sm" value={form.contactEmail}
                onChange={e => setForm({ ...form, contactEmail: e.target.value })} placeholder="연락받을 이메일" />
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
                브랜드 공급가 정산 시 사용되는 계좌입니다. 최고관리자가 정산 처리 시 참고합니다.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">은행명</label>
              <input type="text" className="input-field mt-1 text-sm" value={form.bankName}
                onChange={e => setForm({ ...form, bankName: e.target.value })} placeholder="예: 국민은행" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">계좌번호</label>
              <input type="text" className="input-field mt-1 text-sm" value={form.accountNumber}
                onChange={e => setForm({ ...form, accountNumber: e.target.value })} placeholder="숫자만 입력" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">예금주</label>
              <input type="text" className="input-field mt-1 text-sm" value={form.accountHolder}
                onChange={e => setForm({ ...form, accountHolder: e.target.value })} placeholder="예금주명" />
            </div>
          </div>
        )}

        {/* Save Button */}
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
      </div>
    </div>
  );
}
