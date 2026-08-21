"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {Building2, X, Crown, Eye, EyeOff} from 'lucide-react';
import Pagination, { usePagination } from "@/components/shared/Pagination";

interface Brand {
  id: string;
  brandName: string;
  brandLogo: string | null;
  isApproved: boolean;
  businessRegistrationNo: string | null;
  representativeName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  userName: string;
  userEmail: string;
  userIsActive: boolean;
  productCount: number;
  createdAt: string;
}

export default function NodeBrandManagementClient({ brands }: { brands: Brand[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copiedPw, setCopiedPw] = useState(false);

  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return brands;
    const q = searchQuery.toLowerCase();
    return brands.filter(
      (b) =>
        b.brandName.toLowerCase().includes(q) ||
        b.userName.toLowerCase().includes(q) ||
        b.userEmail.toLowerCase().includes(q)
    );
  }, [brands, searchQuery]);

  const { pageItems, page, setPage, totalPages } = usePagination(filteredBrands, 20);

  const [form, setForm] = useState({
    brandName: "",
    email: "",
    contactName: "",
    description: "",
    businessRegistrationNo: "",
    representativeName: "",
    businessAddress: "",
    businessType: "",
    businessCategory: "",
    contactPhone: "",
    contactEmail: "",
  });

  const resetForm = () => {
    setForm({
      brandName: "",
      email: "",
      contactName: "",
      description: "",
      businessRegistrationNo: "",
      representativeName: "",
      businessAddress: "",
      businessType: "",
      businessCategory: "",
      contactPhone: "",
      contactEmail: "",
    });
    setError("");
    setTempPassword(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/node/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "등록에 실패했습니다.");
      } else {
        setTempPassword(data.tempPassword);
        resetForm();
        setShowForm(false);
        router.refresh();
      }
    } catch {
      setError("브랜드 등록 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPw = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword).catch(() => {});
      setCopiedPw(true);
      setTimeout(() => setCopiedPw(false), 2000);
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">브랜드 관리</h1>
          <p className="text-sm text-gray-500">전체 브랜드 {brands.length}개</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            if (!showForm) resetForm();
          }}
          className="btn-primary text-sm flex items-center gap-1.5"
        >
          {showForm ? <X size={16} /> : <Icon name="Plus" size={16} />}
          {showForm ? "닫기" : "브랜드 초대"}
        </button>
      </div>

      {/* 검색 */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="브랜드명, 담당자, 이메일 검색..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 임시 비밀번호 표시 */}
      {tempPassword && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-5">
          <p className="text-xs font-semibold text-teal-700 mb-2 flex items-center gap-1.5">
            <Icon name="Check" size={14} />
            브랜드 계정이 생성되었습니다. 임시 비밀번호를 전달해주세요.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white rounded-lg border border-teal-200 px-3 py-2 text-sm font-mono text-teal-800 tracking-wider">
              {tempPassword}
            </div>
            <button
              onClick={handleCopyPw}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              {copiedPw ? <Icon name="Check" size={12} /> : <Icon name="Copy" size={12} />}
              {copiedPw ? "복사됨" : "복사"}
            </button>
          </div>
          <button onClick={() => setTempPassword(null)} className="mt-2 text-[10px] text-teal-400 hover:text-teal-600">닫기</button>
        </div>
      )}

      {/* 브랜드 초대 폼 */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 size={16} className="text-teal-500" />
            새 브랜드 초대
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 기본 정보 */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                <Building2 size={13} />
                기본 정보
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    브랜드명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="브랜드명"
                    value={form.brandName}
                    onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">담당자 이름</label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="담당자 이름"
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* 계정 정보 */}
            <div className="bg-teal-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-teal-700 flex items-center gap-1.5">
                <Icon name="Mail" size={13} />
                로그인 계정 정보
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  로그인 이메일 <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  className="input-field text-sm"
                  placeholder="brand@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <p className="text-[10px] text-teal-600">
                ※ 비밀번호는 8자리 랜덤으로 자동 생성되며, 계정 생성 후 화면에 표시됩니다.
              </p>
            </div>

            {/* 사업자 정보 */}
            <div className="bg-purple-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-purple-700 flex items-center gap-1.5">
                <Icon name="File" size={13} />
                사업자 정보 (선택)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">사업자등록번호</label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="000-00-00000"
                    value={form.businessRegistrationNo}
                    onChange={(e) => setForm({ ...form, businessRegistrationNo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">대표자명</label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="대표자명"
                    value={form.representativeName}
                    onChange={(e) => setForm({ ...form, representativeName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">연락처</label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="02-1234-5678"
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">담당자 이메일</label>
                  <input
                    type="email"
                    className="input-field text-sm"
                    placeholder="contact@brand.com"
                    value={form.contactEmail}
                    onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                취소
              </button>
              <button type="submit" className="btn-primary text-sm" disabled={loading}>
                {loading ? "등록 중..." : "브랜드 초대"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 브랜드 목록 */}
      <div className="space-y-3">
        {filteredBrands.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <Crown size={40} strokeWidth={1.5} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">등록된 브랜드가 없습니다</p>
            <p className="text-xs text-gray-400 mt-1">브랜드 초대 버튼을 눌러 새로운 브랜드를 추가하세요</p>
          </div>
        ) : (
          pageItems.map((brand) => (
            <div key={brand.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
                    {brand.brandLogo ? (
                      <img src={brand.brandLogo} alt={brand.brandName} className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <Crown size={20} className="text-teal-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-gray-900">{brand.brandName}</h3>
                      <span
                        className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                          brand.isApproved ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"
                        }`}
                      >
                        {brand.isApproved ? "승인됨" : "대기중"}
                      </span>
                      {!brand.userIsActive && (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">
                          비활성
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      {brand.userName} · {brand.userEmail}
                    </p>
                  </div>
                  <button
                    onClick={() => setExpandedBrand(expandedBrand === brand.id ? null : brand.id)}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 flex-shrink-0"
                  >
                    상세
                  </button>
                </div>

                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Icon name="Package" size={13} className="text-teal-400" />
                    <span className="font-semibold">{brand.productCount}</span> 상품
                  </div>
                  <div className="text-xs text-gray-400">
                    등록일: {new Date(brand.createdAt).toLocaleDateString("ko-KR")}
                  </div>
                </div>
              </div>

              {expandedBrand === brand.id && (
                <div className="border-t border-gray-100 bg-gray-50 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-2">
                      <p className="font-semibold text-gray-700">사업자 정보</p>
                      <div className="space-y-1 text-gray-500">
                        <p><span className="text-gray-400">사업자번호:</span> {brand.businessRegistrationNo || "-"}</p>
                        <p><span className="text-gray-400">대표자:</span> {brand.representativeName || "-"}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="font-semibold text-gray-700">연락처 정보</p>
                      <div className="space-y-1 text-gray-500">
                        <p><span className="text-gray-400">담당자:</span> {brand.userName}</p>
                        <p><span className="text-gray-400">이메일:</span> {brand.userEmail}</p>
                        <p><span className="text-gray-400">연락처:</span> {brand.contactPhone || "-"}</p>
                        <p><span className="text-gray-400">담당 이메일:</span> {brand.contactEmail || "-"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </>
  );
}
