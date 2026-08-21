"use client";

import { Icon } from "@/components/shared/Icon";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppDialog } from "@/components/shared/AppDialog";
import {
  MARGIN_METHOD_LABEL,
  MARGIN_BASE_LABEL,
  type MarginMethod,
  type MarginBase,
} from "@/lib/margin";
import { Crown, X, Building2, Minus, Plus } from "lucide-react";
import Pagination, { usePagination } from "@/components/shared/Pagination";
import SafeImage from "@/components/shared/SafeImage";
import { pickBrandAvatar } from "@/lib/defaults";

interface Brand {
  id: string;
  userId: string;
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
  userName: string;
  userEmail: string;
  userPhone?: string | null;
  userIsActive: boolean;
  userCreatedAt?: string;
  productCount: number;
  createdAt: string;
  // 마진 정책
  middleAdminId: string | null;
  middleAdminName: string | null;
  marginMethod: MarginMethod;
  marginBase: MarginBase;
  marginRate: number;
  // 정산
  settlementAvailable: number;
  settlementScheduled: number;
}

interface MiddleAdminOption {
  id: string;
  name: string;
}

const won = (n: number) => Math.round(n).toLocaleString("ko-KR") + "원";

export default function BrandManagementClient({
  brands,
  middleAdmins,
}: {
  brands: Brand[];
  middleAdmins: MiddleAdminOption[];
}) {
  const router = useRouter();
  const { appConfirm, appAlert } = useAppDialog();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [detailBrand, setDetailBrand] = useState<Brand | null>(null);

  // +/- 조정 모달 상태
  const [adjustTarget, setAdjustTarget] = useState<{
    brand: Brand;
    mode: "add" | "sub";
  } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustMemo, setAdjustMemo] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);

  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return brands;
    const q = searchQuery.toLowerCase();
    return brands.filter(
      (b) =>
        b.brandName.toLowerCase().includes(q) ||
        b.userName.toLowerCase().includes(q) ||
        b.userEmail.toLowerCase().includes(q) ||
        (b.representativeName &&
          b.representativeName.toLowerCase().includes(q)),
    );
  }, [brands, searchQuery]);
  const { pageItems, page, setPage, totalPages } = usePagination(
    filteredBrands,
    20,
  );
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

  const openAdjust = (brand: Brand, mode: "add" | "sub") => {
    setAdjustTarget({ brand, mode });
    setAdjustAmount("");
    setAdjustMemo("");
  };
  const closeAdjust = () => {
    setAdjustTarget(null);
    setAdjustAmount("");
    setAdjustMemo("");
  };

  const handleAdjustSubmit = async () => {
    if (!adjustTarget) return;
    const num = parseInt(adjustAmount.replace(/,/g, ""), 10);
    if (!Number.isFinite(num) || num <= 0) {
      appAlert({ message: "올바른 금액을 입력해주세요.", type: "warning" });
      return;
    }
    const finalAmount = adjustTarget.mode === "sub" ? -num : num;
    const label = adjustTarget.mode === "add" ? "추가" : "차감";

    const ok = await appConfirm({
      message: `${adjustTarget.brand.brandName}의 정산 가능 금액에서\n${won(Math.abs(finalAmount))}을 ${label}합니다.\n계속하시겠습니까?`,
    });
    if (!ok) return;

    setAdjustLoading(true);
    try {
      const res = await fetch("/api/admin/balance-adjustment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientType: "BRAND_ADMIN",
          userId: adjustTarget.brand.userId,
          amount: finalAmount,
          memo: adjustMemo || null,
        }),
      });
      if (res.ok) {
        closeAdjust();
        appAlert({
          message: `정산 가능 금액이 ${label}되었습니다.`,
          type: "success",
        });
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        appAlert({
          message: data.error || "조정에 실패했습니다.",
          type: "warning",
        });
      }
    } catch {
      appAlert({ message: "조정 중 오류가 발생했습니다.", type: "warning" });
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "등록에 실패했습니다.");
      else {
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

  const handleToggleApproval = async (brandId: string, isApproved: boolean) => {
    try {
      const res = await fetch("/api/admin/brands", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, isApproved: !isApproved }),
      });
      if (res.ok) router.refresh();
    } catch {
      appAlert({ message: "상태 변경에 실패했습니다.", type: "warning" });
    }
  };

  const handleDelete = async (brandId: string) => {
    if (
      !(await appConfirm({
        message: "이 브랜드를 비활성화하시겠습니까?",
        type: "warning",
      }))
    )
      return;
    try {
      const res = await fetch("/api/admin/brands", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId }),
      });
      if (res.ok) router.refresh();
    } catch {
      appAlert({ message: "삭제에 실패했습니다.", type: "warning" });
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">브랜드사 관리</h1>
          <p className="text-sm text-gray-500">총 {brands.length}개 브랜드</p>
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

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Icon
            name="Search"
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
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
            <Crown size={16} className="text-purple-500" /> 새 브랜드사 등록
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                <Building2 size={13} /> 기본 정보
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
                    onChange={(e) =>
                      setForm({ ...form, brandName: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    담당자 이름
                  </label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="담당자 이름"
                    value={form.contactName}
                    onChange={(e) =>
                      setForm({ ...form, contactName: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  브랜드 설명
                </label>
                <textarea
                  className="input-field text-sm h-20 resize-none"
                  placeholder="브랜드 설명을 입력하세요"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                <Icon name="Mail" size={13} /> 로그인 계정 정보
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
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
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
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <Icon name="Eye" size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-purple-700 flex items-center gap-1.5">
                <Icon name="File" size={13} /> 사업자 정보
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    사업자등록번호
                  </label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="000-00-00000"
                    value={form.businessRegistrationNo}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        businessRegistrationNo: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    대표자명
                  </label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="대표자명"
                    value={form.representativeName}
                    onChange={(e) =>
                      setForm({ ...form, representativeName: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    업종
                  </label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="업종"
                    value={form.businessType}
                    onChange={(e) =>
                      setForm({ ...form, businessType: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    업태
                  </label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="업태"
                    value={form.businessCategory}
                    onChange={(e) =>
                      setForm({ ...form, businessCategory: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  사업장 주소
                </label>
                <input
                  type="text"
                  className="input-field text-sm"
                  placeholder="사업장 주소"
                  value={form.businessAddress}
                  onChange={(e) =>
                    setForm({ ...form, businessAddress: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    연락처
                  </label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="02-1234-5678"
                    value={form.contactPhone}
                    onChange={(e) =>
                      setForm({ ...form, contactPhone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    담당자 이메일
                  </label>
                  <input
                    type="email"
                    className="input-field text-sm"
                    placeholder="contact@brand.com"
                    value={form.contactEmail}
                    onChange={(e) =>
                      setForm({ ...form, contactEmail: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">
                {error}
              </p>
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
              <button
                type="submit"
                className="btn-primary text-sm"
                disabled={loading}
              >
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
            <Crown
              size={40}
              strokeWidth={1.5}
              className="mx-auto mb-3 text-gray-300"
            />
            <p className="text-sm text-gray-500">등록된 브랜드가 없습니다</p>
            <p className="text-xs text-gray-400 mt-1">
              브랜드 등록 버튼을 눌러 새로운 브랜드를 추가하세요
            </p>
          </div>
        ) : (
          pageItems.map((brand) => (
            <div
              key={brand.id}
              className="bg-white rounded-xl border border-gray-100 overflow-hidden"
            >
              <div className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* 로고 — brandLogo 있으면 사용, 없으면 브랜드사 캐릭터 아바타 */}
                    <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <SafeImage
                        src={brand.brandLogo || pickBrandAvatar(brand.id)}
                        alt={brand.brandName}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover rounded-xl"
                        fallbackText={brand.brandName.charAt(0)}
                      />
                    </div>
                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-gray-900">
                          {brand.brandName}
                        </h3>
                        <span
                          className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${brand.isApproved ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}
                        >
                          {brand.isApproved ? "승인됨" : "대기중"}
                        </span>
                        {!brand.userIsActive && (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">
                            비활성
                          </span>
                        )}
                        {brand.middleAdminName && (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 flex items-center gap-0.5">
                            <Icon name="Settings" size={9} /> 중간관리자:{" "}
                            {brand.middleAdminName}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">
                        {brand.userName} · {brand.userEmail}
                      </p>
                      {brand.businessRegistrationNo && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          사업자번호: {brand.businessRegistrationNo}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* 액션 — 모바일: 정보 아래 줄바꿈, sm 이상: 우측 정렬 */}
                  <div className="flex items-center gap-1.5 flex-wrap sm:flex-shrink-0 sm:justify-end">
                    <button
                      onClick={() => setDetailBrand(brand)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 flex items-center gap-1"
                    >
                      <Icon name="Info" size={11} /> 상세보기
                    </button>
                    <button
                      onClick={() =>
                        setExpandedBrand(
                          expandedBrand === brand.id ? null : brand.id,
                        )
                      }
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100"
                    >
                      {expandedBrand === brand.id ? "접기" : "사업자정보"}
                    </button>
                    <button
                      onClick={() =>
                        handleToggleApproval(brand.id, brand.isApproved)
                      }
                      className={`text-xs px-2.5 py-1.5 rounded-lg ${brand.isApproved ? "bg-yellow-50 text-yellow-600 hover:bg-yellow-100" : "bg-green-50 text-green-600 hover:bg-green-100"}`}
                    >
                      {brand.isApproved ? "승인 해제" : "승인"}
                    </button>
                    <button
                      onClick={() => handleDelete(brand.id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      비활성화
                    </button>
                  </div>
                </div>

                {/* 통계 + 정산 */}
                <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-3 pt-2.5 border-t border-gray-50">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Icon
                      name="Package"
                      size={13}
                      className="text-purple-400"
                    />
                    <span className="font-semibold">{brand.productCount}</span>{" "}
                    상품
                  </div>
                  <div className="text-xs text-gray-400">
                    등록일:{" "}
                    {new Date(brand.createdAt).toLocaleDateString("ko-KR")}
                  </div>
                </div>

                {/* 정산 금액 요약 */}
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  <div className="bg-emerald-50 rounded-lg px-2.5 py-2 text-center">
                    <p className="text-[9px] text-emerald-600 mb-0.5">
                      정산 가능
                    </p>
                    <p className="text-[11px] font-bold text-emerald-700">
                      {won(brand.settlementAvailable)}
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-lg px-2.5 py-2 text-center">
                    <p className="text-[9px] text-orange-500 mb-0.5">
                      정산 예정
                    </p>
                    <p className="text-[11px] font-bold text-orange-600">
                      {won(brand.settlementScheduled)}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-2.5 py-2">
                    <p className="text-[9px] text-gray-500 mb-0.5">합계</p>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] font-bold text-gray-800">
                        {won(
                          brand.settlementAvailable + brand.settlementScheduled,
                        )}
                      </p>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => openAdjust(brand, "add")}
                          className="w-5 h-5 flex items-center justify-center rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                          title="추가"
                        >
                          <Plus size={10} strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => openAdjust(brand, "sub")}
                          className="w-5 h-5 flex items-center justify-center rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                          title="차감"
                        >
                          <Minus size={10} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 사업자 정보 펼침 */}
              {expandedBrand === brand.id && (
                <div className="border-t border-gray-100 bg-gray-50 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-2">
                      <p className="font-semibold text-gray-700">사업자 정보</p>
                      <div className="space-y-1 text-gray-500">
                        <p>
                          <span className="text-gray-400">사업자번호:</span>{" "}
                          {brand.businessRegistrationNo || "-"}
                        </p>
                        <p>
                          <span className="text-gray-400">대표자:</span>{" "}
                          {brand.representativeName || "-"}
                        </p>
                        <p>
                          <span className="text-gray-400">업종:</span>{" "}
                          {brand.businessType || "-"}
                        </p>
                        <p>
                          <span className="text-gray-400">업태:</span>{" "}
                          {brand.businessCategory || "-"}
                        </p>
                        <p>
                          <span className="text-gray-400">주소:</span>{" "}
                          {brand.businessAddress || "-"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="font-semibold text-gray-700">연락처 정보</p>
                      <div className="space-y-1 text-gray-500">
                        <p>
                          <span className="text-gray-400">담당자:</span>{" "}
                          {brand.userName}
                        </p>
                        <p>
                          <span className="text-gray-400">이메일:</span>{" "}
                          {brand.contactEmail || "-"}
                        </p>
                        <p>
                          <span className="text-gray-400">전화:</span>{" "}
                          {brand.contactPhone || "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      {/* 상세보기 모달 */}
      {detailBrand && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-4"
          onClick={() => setDetailBrand(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Crown size={15} className="text-purple-500" /> 브랜드사 상세
              </h3>
              <button
                onClick={() => setDetailBrand(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={17} />
              </button>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                <SafeImage
                  src={detailBrand.brandLogo || pickBrandAvatar(detailBrand.id)}
                  alt={detailBrand.brandName}
                  width={56}
                  height={56}
                  className="w-full h-full object-cover rounded-xl"
                  fallbackText={detailBrand.brandName.charAt(0)}
                />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {detailBrand.brandName}
                </p>
                <span
                  className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${detailBrand.isApproved ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}
                >
                  {detailBrand.isApproved ? "승인됨" : "대기중"}
                </span>
              </div>
            </div>

            {/* 가입 정보 */}
            <div className="space-y-1.5 text-[12px] bg-gray-50 rounded-xl p-3 mb-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                가입 정보
              </p>
              <div className="flex items-center gap-2 text-gray-600">
                <Icon name="Users" size={13} className="text-gray-400" />{" "}
                {detailBrand.userName}
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Icon name="Mail" size={13} className="text-gray-400" />{" "}
                {detailBrand.userEmail}
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Icon name="Phone" size={13} className="text-gray-400" />{" "}
                {detailBrand.contactPhone ||
                  detailBrand.userPhone ||
                  "연락처 미등록"}
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Icon name="Calendar" size={13} className="text-gray-400" />{" "}
                가입일{" "}
                {detailBrand.userCreatedAt
                  ? new Date(detailBrand.userCreatedAt).toLocaleDateString(
                      "ko-KR",
                    )
                  : "-"}
              </div>
              {detailBrand.middleAdminName && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Icon name="Settings" size={13} className="text-gray-400" />{" "}
                  중간관리자: {detailBrand.middleAdminName}
                </div>
              )}
            </div>

            {/* 사업자 정보 */}
            <div className="space-y-1.5 text-[12px] bg-purple-50 rounded-xl p-3 mb-3">
              <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wide mb-2">
                사업자 정보
              </p>
              <div className="space-y-1 text-gray-600">
                <p>
                  <span className="text-gray-400">사업자번호:</span>{" "}
                  {detailBrand.businessRegistrationNo || "-"}
                </p>
                <p>
                  <span className="text-gray-400">대표자:</span>{" "}
                  {detailBrand.representativeName || "-"}
                </p>
                <p>
                  <span className="text-gray-400">업종:</span>{" "}
                  {detailBrand.businessType || "-"}
                </p>
                <p>
                  <span className="text-gray-400">업태:</span>{" "}
                  {detailBrand.businessCategory || "-"}
                </p>
                <p>
                  <span className="text-gray-400">주소:</span>{" "}
                  {detailBrand.businessAddress || "-"}
                </p>
                <p>
                  <span className="text-gray-400">전화:</span>{" "}
                  {detailBrand.contactPhone || "-"}
                </p>
                <p>
                  <span className="text-gray-400">이메일:</span>{" "}
                  {detailBrand.contactEmail || "-"}
                </p>
              </div>
            </div>

            {/* 정산 요약 */}
            <div className="grid grid-cols-3 gap-1.5 mb-4">
              <div className="bg-emerald-50 rounded-lg p-2 text-center">
                <p className="text-[9px] text-emerald-600">정산 가능</p>
                <p className="text-xs font-bold text-emerald-700">
                  {won(detailBrand.settlementAvailable)}
                </p>
              </div>
              <div className="bg-orange-50 rounded-lg p-2 text-center">
                <p className="text-[9px] text-orange-500">정산 예정</p>
                <p className="text-xs font-bold text-orange-600">
                  {won(detailBrand.settlementScheduled)}
                </p>
              </div>
              <div className="bg-gray-100 rounded-lg p-2 text-center">
                <p className="text-[9px] text-gray-500">합계</p>
                <p className="text-xs font-bold text-gray-800">
                  {won(
                    detailBrand.settlementAvailable +
                      detailBrand.settlementScheduled,
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={() => setDetailBrand(null)}
              className="w-full py-2.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 금액 조정 모달 */}
      {adjustTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={closeAdjust}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${adjustTarget.mode === "add" ? "bg-emerald-50" : "bg-red-50"}`}
              >
                {adjustTarget.mode === "add" ? (
                  <Plus size={18} className="text-emerald-600" />
                ) : (
                  <Minus size={18} className="text-red-600" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  정산 가능 금액 {adjustTarget.mode === "add" ? "추가" : "차감"}
                </h3>
                <p className="text-[11px] text-gray-400">
                  {adjustTarget.brand.brandName}
                </p>
              </div>
            </div>
            <div
              className={`rounded-lg p-2.5 my-3 text-[11px] leading-relaxed ${adjustTarget.mode === "add" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
            >
              현재 정산 가능 금액: {won(adjustTarget.brand.settlementAvailable)}
            </div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              {adjustTarget.mode === "add" ? "추가" : "차감"} 금액 (원)
            </label>
            <input
              type="number"
              min={1}
              step={1}
              className="input-field text-sm"
              placeholder="예: 10000"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              autoFocus
            />
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 mt-3">
              메모 (선택)
            </label>
            <input
              type="text"
              className="input-field text-sm"
              placeholder="조정 사유를 입력하세요"
              value={adjustMemo}
              onChange={(e) => setAdjustMemo(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={closeAdjust}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                취소
              </button>
              <button
                onClick={handleAdjustSubmit}
                disabled={adjustLoading}
                className={`px-4 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-40 ${adjustTarget.mode === "add" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-500 hover:bg-red-600"}`}
              >
                {adjustLoading
                  ? "처리 중..."
                  : adjustTarget.mode === "add"
                    ? "추가"
                    : "차감"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
