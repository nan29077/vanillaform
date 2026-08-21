"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {X} from 'lucide-react';
import Pagination, { usePagination } from "@/components/shared/Pagination";
import SignupBadges from "@/components/shared/SignupBadges";

interface Seller {
  id: string;
  slug: string;
  shopName: string;
  isApproved: boolean;
  middleAdminMarginRate: number;
  userName: string;
  userEmail: string;
  userIsActive: boolean;
  authProviders?: string[];
  createdAt: string;
}

export default function MiddleSellerManagementClient({ sellers }: { sellers: Seller[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSellers = useMemo(() => {
    if (!searchQuery.trim()) return sellers;
    const q = searchQuery.toLowerCase();
    return sellers.filter(
      (s) =>
        s.shopName.toLowerCase().includes(q) ||
        s.userName.toLowerCase().includes(q) ||
        s.userEmail.toLowerCase().includes(q)
    );
  }, [sellers, searchQuery]);

  const { pageItems, page, setPage, totalPages } = usePagination(filteredSellers, 20);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    passwordConfirm: "",
    phone: "",
    shopName: "",
  });

  const resetForm = () => {
    setForm({ name: "", email: "", password: "", passwordConfirm: "", phone: "", shopName: "" });
    setError("");
    setShowPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch("/api/middle/sellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone,
          shopName: form.shopName,
        }),
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
      setError("라이브 셀러 등록 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">라이브 셀러 관리</h1>
          <p className="text-sm text-gray-500">소속 라이브 셀러 총 {sellers.length}명</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            if (!showForm) resetForm();
          }}
          className="btn-primary text-sm flex items-center gap-1.5"
        >
          {showForm ? <X size={16} /> : <Icon name="Plus" size={16} />}
          {showForm ? "닫기" : "라이브 셀러 등록"}
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="샵명, 이름, 이메일 검색..."
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

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Icon name="Store" size={16} className="text-blue-500" />
            새 라이브 셀러 등록
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="라이브 셀러 이름"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">연락처</label>
                  <input
                    type="tel"
                    className="input-field text-sm"
                    placeholder="010-1234-5678"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">샵명</label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="미입력 시 '이름의 샵'"
                    value={form.shopName}
                    onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                  />
                </div>
              </div>
            </div>

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
                    placeholder="seller@example.com"
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
                      placeholder="8자 이상"
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
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    비밀번호 확인 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="input-field text-sm"
                    placeholder="비밀번호를 다시 입력"
                    value={form.passwordConfirm}
                    onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })}
                    minLength={8}
                    required
                  />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-gray-400 px-1">
              ※ 라이브 셀러 마진율은 최고관리자가 설정합니다.
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
                {loading ? "등록 중..." : "라이브 셀러 등록"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {filteredSellers.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <Icon name="Store" size={40} strokeWidth={1.5} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">소속 라이브 셀러가 없습니다</p>
            <p className="text-xs text-gray-400 mt-1">라이브 셀러 등록 버튼을 눌러 새로운 라이브 셀러를 추가하세요</p>
          </div>
        ) : (
          pageItems.map((seller) => (
            <div key={seller.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Icon name="Store" size={20} className="text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-gray-900">{seller.shopName}</h3>
                    <span
                      className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                        seller.isApproved ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"
                      }`}
                    >
                      {seller.isApproved ? "승인됨" : "대기중"}
                    </span>
                    {!seller.userIsActive && (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">
                        비활성
                      </span>
                    )}
                    <SignupBadges providers={seller.authProviders} />
                  </div>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">
                    {seller.userName} · {seller.userEmail}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Icon name="Discount" size={13} className="text-emerald-400" />
                  {seller.middleAdminMarginRate > 0
                    ? `마진 ${seller.middleAdminMarginRate}%`
                    : "마진 미설정"}
                </div>
                <div className="text-xs text-gray-400">/{seller.slug}</div>
                <div className="text-xs text-gray-400">
                  등록일: {new Date(seller.createdAt).toLocaleDateString("ko-KR")}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </>
  );
}
