"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {Crown, X, Building2, Trash2} from 'lucide-react';
import Pagination, { usePagination } from "@/components/shared/Pagination";

interface Brand {
  id: string;
  brandName: string;
  brandLogo: string | null;
  description: string | null;
  isApproved: boolean;
  businessRegistrationNo: string | null;
  representativeName: string | null;
  businessAddress: string | null;
  businessType: string | null;
  businessCategory: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  // 마진 정책 (읽기 전용 — 최고관리자 전용 설정)
  marginMethod: string;
  marginRate: number;
  userName: string;
  userEmail: string;
  userIsActive: boolean;
  productCount: number;
  createdAt: string;
}

// 마진 정책 읽기 전용 라벨
function marginLabel(method: string, rate: number): string {
  if (rate <= 0) return "마진 미설정";
  const methodLabel = method === "PERCENTAGE" ? "퍼센트" : "공급가";
  return `${methodLabel} ${rate}%`;
}

export default function MiddleBrandManagementClient({ brands }: { brands: Brand[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSoftDelete = async (brandId: string, brandName: string) => {
    if (!window.confirm(`'${brandName}' 브랜드사를 비활성화하시겠습니까?`)) return;
    setDeletingId(brandId);
    try {
      const res = await fetch(`/api/middle/brands/${brandId}`, { method: "PATCH" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "비활성화에 실패했습니다.");
      } else {
        router.refresh();
      }
    } catch {
      alert("비활성화 중 오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return brands;
    const q = searchQuery.toLowerCase();
    return brands.filter(
      (b) =>
        b.brandName.toLowerCase().includes(q) ||
        b.userName.toLowerCase().includes(q) ||
        b.userEmail.toLowerCase().includes(q) ||
        (b.representativeName && b.representativeName.toLowerCase().includes(q))
    );
  }, [brands, searchQuery]);

  const { pageItems, page, setPage, totalPages } = usePagination(filteredBrands, 20);

  const [form, setForm] = useState({
    brandName: "",
    email: "",
    password: "",
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
      password: "",
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
    setShowPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/middle/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "등록에 실패했습니다.");
      } else {
        setShowForm(false);
        resetForm();
        router.refresh();
      }
    } catch {
      setError("브랜드 등록 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">브랜드 관리</h1>
          <p className="text-sm text-gray-500">소속 브랜드 총 {brands.length}개</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            if (!showForm) resetForm();
          }}
          className="btn-primary text-sm flex items-center gap-1.5"
        >
          {showForm ? <X size={16} /> : <Icon name="Plus" size={16} />}
          {showForm ? "닫기" : "브랜드 등록"}
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="브랜드명, 담당자, 이메일 검색..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
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

      {/* 브랜드 등록 폼 */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Crown size={16} className="text-purple-500" />
            새 브랜드 등록
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
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">브랜드 설명</label>
                <textarea
                  className="input-field text-sm h-20 resize-none"
                  placeholder="브랜드 설명을 입력하세요"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>

            {/* 계정 정보 */}
            <div className="bg-blue-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                <Icon name="Mail" size={13} />
                로그인 계정 정보
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    비밀번호 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="input-field text-sm pr-10"
                      placeholder="비밀번호"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <Icon name="Eye" size={16} /> : <Icon name="Eye" size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 사업자 정보 */}
            <div className="bg-purple-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-purple-700 flex items-center gap-1.5">
                <Icon name="File" size={13} />
                사업자 정보
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">업종</label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="업종"
                    value={form.businessType}
                    onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">업태</label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="업태"
                    value={form.businessCategory}
                    onChange={(e) => setForm({ ...form, businessCategory: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">사업장 주소</label>
                <input
                  type="text"
                  className="input-field text-sm"
                  placeholder="사업장 주소"
                  value={form.businessAddress}
                  onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            {/* 마진 정책 안내 (입력 불가 — 최고관리자 전용) */}
            <p className="text-[11px] text-gray-400 px-1">
              ※ 브랜드 마진 정책(방식/요율)은 최고관리자가 설정합니다.
            </p>

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
                {loading ? "등록 중..." : "브랜드 등록"}
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
            <p className="text-sm text-gray-500">소속 브랜드가 없습니다</p>
            <p className="text-xs text-gray-400 mt-1">브랜드 등록 버튼을 눌러 새로운 브랜드를 추가하세요</p>
          </div>
        ) : (
          pageItems.map((brand) => (
            <div key={brand.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* 로고 */}
                  <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                    {brand.brandLogo ? (
                      <img src={brand.brandLogo} alt={brand.brandName} className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <Crown size={20} className="text-purple-400" />
                    )}
                  </div>
                  {/* 정보 */}
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
                    {brand.businessRegistrationNo && (
                      <p className="text-[10px] text-gray-400 mt-0.5">사업자번호: {brand.businessRegistrationNo}</p>
                    )}
                  </div>
                  {/* 액션 */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setExpandedBrand(expandedBrand === brand.id ? null : brand.id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100"
                    >
                      상세
                    </button>
                    <button
                      onClick={() => handleSoftDelete(brand.id, brand.brandName)}
                      disabled={deletingId === brand.id}
                      title="브랜드사 비활성화"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* 통계 */}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Icon name="Package" size={13} className="text-purple-400" />
                    <span className="font-semibold">{brand.productCount}</span> 상품
                  </div>
                  {/* 마진 정책 읽기 전용 */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Icon name="Discount" size={13} className="text-emerald-400" />
                    {marginLabel(brand.marginMethod, brand.marginRate)}
                  </div>
                  <div className="text-xs text-gray-400">
                    등록일: {new Date(brand.createdAt).toLocaleDateString("ko-KR")}
                  </div>
                </div>
              </div>

              {/* 상세 정보 (펼침) */}
              {expandedBrand === brand.id && (
                <div className="border-t border-gray-100 bg-gray-50 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-2">
                      <p className="font-semibold text-gray-700">사업자 정보</p>
                      <div className="space-y-1 text-gray-500">
                        <p><span className="text-gray-400">사업자번호:</span> {brand.businessRegistrationNo || "-"}</p>
                        <p><span className="text-gray-400">대표자:</span> {brand.representativeName || "-"}</p>
                        <p><span className="text-gray-400">업종:</span> {brand.businessType || "-"}</p>
                        <p><span className="text-gray-400">업태:</span> {brand.businessCategory || "-"}</p>
                        <p><span className="text-gray-400">주소:</span> {brand.businessAddress || "-"}</p>
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
                      {brand.description && (
                        <div className="mt-2">
                          <p className="font-semibold text-gray-700">설명</p>
                          <p className="text-gray-500 mt-1">{brand.description}</p>
                        </div>
                      )}
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
