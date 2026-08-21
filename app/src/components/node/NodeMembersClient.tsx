"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {Building2, Crown, Store, X, Phone, UserCog} from 'lucide-react';
import Pagination, { usePagination } from "@/components/shared/Pagination";
import SignupBadges from "@/components/shared/SignupBadges";

interface MiddleAdmin {
  id: string;
  name: string;
  contactPhone: string | null;
  isActive: boolean;
  isApproved: boolean;
  commissionRate: string;
  userName: string;
  userEmail: string;
  userIsActive: boolean;
  authProviders?: string[];
  brandCount: number;
  sellerCount: number;
  createdAt: string;
}

interface Brand {
  id: string;
  brandName: string;
  brandLogo: string | null;
  isApproved: boolean;
  userName: string;
  userEmail: string;
  userIsActive: boolean;
  authProviders?: string[];
  middleAdminName: string | null;
  productCount: number;
  createdAt: string;
}

interface Seller {
  id: string;
  slug: string;
  shopName: string;
  isApproved: boolean;
  userName: string;
  userEmail: string;
  userIsActive: boolean;
  authProviders?: string[];
  middleAdminName: string | null;
  createdAt: string;
}

type TabType = "middleAdmins" | "brands" | "sellers";

export default function NodeMembersClient({
  middleAdmins,
  brands,
  sellers,
}: {
  middleAdmins: MiddleAdmin[];
  brands: Brand[];
  sellers: Seller[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabType>("middleAdmins");
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copiedPw, setCopiedPw] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    commissionRate: "5",
    bizNumber: "",
    companyName: "",
    bankName: "",
    accountNumber: "",
    accountHolder: "",
  });

  const resetForm = () => {
    setForm({ name: "", email: "", phone: "", commissionRate: "5", bizNumber: "", companyName: "", bankName: "", accountNumber: "", accountHolder: "" });
    setError("");
    setTempPassword(null);
  };

  const filteredMiddleAdmins = useMemo(() => {
    if (!searchQuery.trim()) return middleAdmins;
    const q = searchQuery.toLowerCase();
    return middleAdmins.filter(m =>
      m.name.toLowerCase().includes(q) || m.userEmail.toLowerCase().includes(q) || m.userName.toLowerCase().includes(q)
    );
  }, [middleAdmins, searchQuery]);

  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return brands;
    const q = searchQuery.toLowerCase();
    return brands.filter(b =>
      b.brandName.toLowerCase().includes(q) || b.userEmail.toLowerCase().includes(q) || b.userName.toLowerCase().includes(q)
    );
  }, [brands, searchQuery]);

  const filteredSellers = useMemo(() => {
    if (!searchQuery.trim()) return sellers;
    const q = searchQuery.toLowerCase();
    return sellers.filter(s =>
      s.shopName.toLowerCase().includes(q) || s.userEmail.toLowerCase().includes(q) || s.userName.toLowerCase().includes(q)
    );
  }, [sellers, searchQuery]);

  const {
    pageItems: middleAdminItems,
    page: middleAdminPage,
    setPage: setMiddleAdminPage,
    totalPages: middleAdminTotalPages,
  } = usePagination(filteredMiddleAdmins, 20);
  const {
    pageItems: brandItems,
    page: brandPage,
    setPage: setBrandPage,
    totalPages: brandTotalPages,
  } = usePagination(filteredBrands, 20);
  const {
    pageItems: sellerItems,
    page: sellerPage,
    setPage: setSellerPage,
    totalPages: sellerTotalPages,
  } = usePagination(filteredSellers, 20);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/node/middle-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, commissionRate: Number(form.commissionRate) }),
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
      setError("중간관리자 등록 중 오류가 발생했습니다.");
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

  const TABS: { key: TabType; label: string; icon: any; count: number }[] = [
    { key: "middleAdmins", label: "중간관리자", icon: UserCog, count: middleAdmins.length },
    { key: "brands", label: "브랜드", icon: Building2, count: brands.length },
    { key: "sellers", label: "셀러", icon: Store, count: sellers.length },
  ];

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">회원 관리</h1>
          <p className="text-sm text-gray-500">
            중간관리자 {middleAdmins.length} · 브랜드 {brands.length} · 셀러 {sellers.length}
          </p>
        </div>
        {tab === "middleAdmins" && (
          <button
            onClick={() => { setShowForm(!showForm); if (!showForm) resetForm(); }}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            {showForm ? <X size={16} /> : <Icon name="Plus" size={16} />}
            {showForm ? "닫기" : "중간관리자 초대"}
          </button>
        )}
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-4">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); setSearchQuery(""); setExpandedId(null); }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
                active ? "border-teal-500 text-teal-700" : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon size={14} strokeWidth={active ? 2 : 1.75} />
              {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-500"}`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 검색 */}
      <div className="relative mb-4">
        <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="이름, 이메일 검색..."
          className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* 임시 비밀번호 */}
      {tempPassword && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-5">
          <p className="text-xs font-semibold text-teal-700 mb-2 flex items-center gap-1.5">
            <Icon name="Check" size={14} />
            중간관리자 계정이 생성되었습니다. 임시 비밀번호를 전달해주세요.
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

      {/* 중간관리자 초대 폼 */}
      {showForm && tab === "middleAdmins" && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Icon name="Settings" size={16} className="text-teal-500" />
            중간관리자 초대
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-600">기본 정보</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">이름 <span className="text-red-500">*</span></label>
                  <input type="text" className="input-field text-sm" placeholder="담당자 이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">연락처</label>
                  <input type="tel" className="input-field text-sm" placeholder="010-1234-5678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">커미션율 (%)</label>
                  <input type="number" className="input-field text-sm" placeholder="5" min="0" max="100" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="bg-teal-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-teal-700 flex items-center gap-1.5"><Icon name="Mail" size={13} />로그인 계정 정보</p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">로그인 이메일 <span className="text-red-500">*</span></label>
                <input type="email" className="input-field text-sm" placeholder="manager@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <p className="text-[10px] text-teal-600">※ 비밀번호는 8자리 랜덤으로 자동 생성됩니다.</p>
            </div>

            <div className="bg-purple-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-purple-700">사업자·정산 정보 (선택)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">사업자번호</label>
                  <input type="text" className="input-field text-sm" placeholder="000-00-00000" value={form.bizNumber} onChange={(e) => setForm({ ...form, bizNumber: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">회사명</label>
                  <input type="text" className="input-field text-sm" placeholder="회사명" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">은행명</label>
                  <input type="text" className="input-field text-sm" placeholder="예) 국민은행" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">계좌번호</label>
                  <input type="text" className="input-field text-sm" placeholder="계좌번호" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">예금주</label>
                  <input type="text" className="input-field text-sm" placeholder="예금주명" value={form.accountHolder} onChange={(e) => setForm({ ...form, accountHolder: e.target.value })} />
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">취소</button>
              <button type="submit" className="btn-primary text-sm" disabled={loading}>{loading ? "등록 중..." : "중간관리자 초대"}</button>
            </div>
          </form>
        </div>
      )}

      {/* 중간관리자 목록 */}
      {tab === "middleAdmins" && (
        <div className="space-y-3">
          {filteredMiddleAdmins.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
              <Icon name="Settings" size={40} strokeWidth={1.5} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">담당 중간관리자가 없습니다</p>
              <p className="text-xs text-gray-400 mt-1">중간관리자 초대 버튼을 눌러 추가하세요</p>
            </div>
          ) : (
            middleAdminItems.map((m) => (
              <div key={m.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Icon name="Settings" size={18} className="text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-900">{m.name}</p>
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${m.isApproved ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>
                          {m.isApproved ? "승인됨" : "대기중"}
                        </span>
                        {!m.userIsActive && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">비활성</span>}
                        <SignupBadges providers={m.authProviders} />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">{m.userEmail}</p>
                    </div>
                    <button onClick={() => setExpandedId(expandedId === m.id ? null : m.id)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                      {expandedId === m.id ? <Icon name="ChevronDown" size={16} className="rotate-180" /> : <Icon name="ChevronDown" size={16} />}
                    </button>
                  </div>
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 flex-wrap text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Building2 size={11} />{m.brandCount}개 브랜드</span>
                    <span className="flex items-center gap-1"><Icon name="Store" size={11} />{m.sellerCount}명 셀러</span>
                    <span>커미션 {m.commissionRate}%</span>
                    <span>등록일 {new Date(m.createdAt).toLocaleDateString("ko-KR")}</span>
                  </div>
                </div>
                {expandedId === m.id && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500 space-y-1">
                    <p><span className="text-gray-400">이름:</span> {m.name}</p>
                    <p><span className="text-gray-400">이메일:</span> {m.userEmail}</p>
                    {m.contactPhone && <p><span className="text-gray-400">연락처:</span> {m.contactPhone}</p>}
                  </div>
                )}
              </div>
            ))
          )}
          <Pagination currentPage={middleAdminPage} totalPages={middleAdminTotalPages} onPageChange={setMiddleAdminPage} />
        </div>
      )}

      {/* 브랜드 목록 */}
      {tab === "brands" && (
        <div className="space-y-3">
          {filteredBrands.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
              <Crown size={40} strokeWidth={1.5} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">담당 브랜드가 없습니다</p>
            </div>
          ) : (
            brandItems.map((b) => (
              <div key={b.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                    {b.brandLogo ? (
                      <img src={b.brandLogo} alt={b.brandName} className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <Crown size={18} className="text-purple-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900">{b.brandName}</p>
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${b.isApproved ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>
                        {b.isApproved ? "승인됨" : "대기중"}
                      </span>
                      <SignupBadges providers={b.authProviders} />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{b.userEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 flex-wrap text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Icon name="Package" size={11} />{b.productCount}개 상품</span>
                  {b.middleAdminName && <span>담당 중간관리자: {b.middleAdminName}</span>}
                  <span>등록일 {new Date(b.createdAt).toLocaleDateString("ko-KR")}</span>
                </div>
              </div>
            ))
          )}
          <Pagination currentPage={brandPage} totalPages={brandTotalPages} onPageChange={setBrandPage} />
        </div>
      )}

      {/* 셀러 목록 */}
      {tab === "sellers" && (
        <div className="space-y-3">
          {filteredSellers.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
              <Icon name="Store" size={40} strokeWidth={1.5} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">담당 셀러가 없습니다</p>
            </div>
          ) : (
            sellerItems.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
                    <Icon name="Users" size={18} className="text-teal-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900">{s.shopName}</p>
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${s.isApproved ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>
                        {s.isApproved ? "승인됨" : "대기중"}
                      </span>
                      <SignupBadges providers={s.authProviders} />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{s.userName} · {s.userEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 flex-wrap text-xs text-gray-400">
                  <span>/{s.slug}</span>
                  {s.middleAdminName && <span>담당 중간관리자: {s.middleAdminName}</span>}
                  <span>등록일 {new Date(s.createdAt).toLocaleDateString("ko-KR")}</span>
                </div>
              </div>
            ))
          )}
          <Pagination currentPage={sellerPage} totalPages={sellerTotalPages} onPageChange={setSellerPage} />
        </div>
      )}
    </>
  );
}
