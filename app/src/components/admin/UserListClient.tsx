"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import {ArrowUpDown, Filter, X, Loader2, Ban} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";
import FanPurchaseHistory from "@/components/shared/FanPurchaseHistory";
import { withVatRate } from "@/lib/utils";
import Pagination, { usePagination } from "@/components/shared/Pagination";
import SignupBadges from "@/components/shared/SignupBadges";
import SafeImage from "@/components/shared/SafeImage";
import { pickDefaultAvatar } from "@/lib/defaults";

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  gender?: string | null;
  birthday?: string | null;
  role: string;
  isActive: boolean;
  orderCount: number;
  reviewCount: number;
  createdAt: string;
  // 소셜 가입 제공자(kakao·naver·google). 비어 있으면 이메일 가입.
  authProviders?: string[];
  // 셀러 전용
  sellerId?: string | null;
  commissionRate?: number | null;
}

const dashPath = (r: string) =>
  r === "SUPER_ADMIN" ? "/admin" : r === "SELLER" ? "/seller" : r === "BRAND_ADMIN" ? "/brand" : "/";

const ROLE_MAP: Record<string, { label: string; color: string; order: number }> = {
  SUPER_ADMIN: { label: "관리자", color: "bg-red-50 text-red-600", order: 1 },
  BRAND_ADMIN: { label: "브랜드", color: "bg-purple-50 text-purple-600", order: 2 },
  SELLER: { label: "라이브 셀러", color: "bg-blue-50 text-blue-600", order: 3 },
  BUYER: { label: "구매자", color: "bg-green-50 text-green-600", order: 4 },
};

export default function UserListClient({ users }: { users: User[] }) {
  const router = useRouter();
  const { appAlert, appConfirm } = useAppDialog();
  const [impLoading, setImpLoading] = useState<string | null>(null);
  const [infoTarget, setInfoTarget] = useState<User | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"date" | "role" | "name">("date");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // 비밀번호 재설정 모달 상태
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // 수수료율 편집 모달 상태
  const [commTarget, setCommTarget] = useState<{ userId: string; sellerId: string; name: string; current: number } | null>(null);
  const [commRate, setCommRate] = useState("");
  const [commSaving, setCommSaving] = useState(false);

  const closeReset = () => {
    setResetTarget(null);
    setNewPw("");
    setShowPw(false);
  };

  const openCommEdit = (user: User) => {
    if (!user.sellerId) return;
    setCommTarget({ userId: user.id, sellerId: user.sellerId, name: user.name, current: user.commissionRate ?? 5 });
    setCommRate(String(user.commissionRate ?? 5));
  };

  const closeCommEdit = () => {
    setCommTarget(null);
    setCommRate("");
  };

  const handleCommSave = async () => {
    if (!commTarget) return;
    const numRate = Number(commRate);
    if (!Number.isFinite(numRate) || numRate < 0 || numRate > 100) {
      appAlert({ message: "수수료율은 0~100 사이 숫자여야 합니다.", type: "honeybee" });
      return;
    }
    setCommSaving(true);
    try {
      const res = await fetch(`/api/admin/sellers/${commTarget.sellerId}/commission`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionRate: numRate }),
      });
      if (res.ok) {
        closeCommEdit();
        appAlert({ message: `수수료율이 ${numRate}%로 저장되었습니다.`, type: "success" });
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        appAlert({ message: data.error || "수수료율 저장 실패", type: "warning" });
      }
    } catch {
      appAlert({ message: "수수료율 저장 오류", type: "warning" });
    } finally {
      setCommSaving(false);
    }
  };

  const handleResetSubmit = async () => {
    if (!resetTarget) return;
    if (newPw.length < 8) {
      appAlert({ message: "비밀번호는 8자 이상이어야 합니다.", type: "honeybee" });
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetTarget.id, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) {
        appAlert({ message: data.error || "재설정에 실패했습니다.", type: "warning" });
      } else {
        closeReset();
        appAlert({ message: data.message || "비밀번호가 재설정되었습니다.", type: "success" });
      }
    } catch {
      appAlert({ message: "비밀번호 재설정 중 오류가 발생했습니다.", type: "warning" });
    } finally {
      setPwLoading(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    const next = !user.isActive;
    const ok = await appConfirm({
      message: next
        ? `${user.name} 회원을 다시 활성화할까요?`
        : `${user.name} 회원을 활동 정지할까요?\n정지 시 해당 회원은 로그인할 수 없습니다.`,
    });
    if (!ok) return;
    setTogglingId(user.id);
    try {
      const res = await fetch("/api/admin/users/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, isActive: next }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        appAlert({ message: d.error || "처리에 실패했습니다.", type: "warning" });
        return;
      }
      setInfoTarget(null);
      router.refresh();
    } finally {
      setTogglingId(null);
    }
  };

  const handleImpersonate = async (user: User) => {
    const ok = await appConfirm({
      message: `${user.name}(${ROLE_MAP[user.role]?.label || user.role}) 계정으로 임시 로그인합니다.\n현재 관리자 세션은 로그아웃됩니다. 계속할까요?`,
    });
    if (!ok) return;
    setImpLoading(user.id);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        appAlert({ message: data.error || "임시 로그인에 실패했습니다.", type: "warning" });
        return;
      }
      await signIn("impersonate", { token: data.token, callbackUrl: dashPath(data.role) });
    } catch {
      appAlert({ message: "임시 로그인 중 오류가 발생했습니다.", type: "warning" });
    } finally {
      setImpLoading(null);
    }
  };

  const roleCounts = useMemo(() => ({
    all: users.length,
    SUPER_ADMIN: users.filter(u => u.role === "SUPER_ADMIN").length,
    MIDDLE_ADMIN: users.filter(u => u.role === "MIDDLE_ADMIN").length,
    SELLER: users.filter(u => u.role === "SELLER").length,
    BRAND_ADMIN: users.filter(u => u.role === "BRAND_ADMIN").length,
    BUYER: users.filter(u => u.role === "BUYER").length,
  }), [users]);

  const sortedUsers = useMemo(() => {
    let filtered = filterRole === "all" ? users : users.filter(u => u.role === filterRole);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    return [...filtered].sort((a, b) => {
      if (sortBy === "role") {
        const orderA = ROLE_MAP[a.role]?.order || 99;
        const orderB = ROLE_MAP[b.role]?.order || 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [users, sortBy, filterRole, searchQuery]);

  // 회원 목록 페이지네이션 (페이지당 20명) — 모바일 카드/데스크탑 테이블 공용
  const { pageItems, page, setPage, totalPages } = usePagination(sortedUsers, 20);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">회원 관리</h1>
          <p className="text-sm text-gray-500">총 {users.length}명</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5">
            <ArrowUpDown size={13} className="text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs bg-transparent outline-none text-gray-700 pr-1"
            >
              <option value="date">가입일순</option>
              <option value="role">회원 유형순</option>
              <option value="name">이름순</option>
            </select>
          </div>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5">
            <Filter size={13} className="text-gray-400" />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="text-xs bg-transparent outline-none text-gray-700 pr-1"
            >
              <option value="all">전체 ({roleCounts.all})</option>
              <option value="SUPER_ADMIN">관리자 ({roleCounts.SUPER_ADMIN})</option>
              <option value="MIDDLE_ADMIN">중간관리자 ({roleCounts.MIDDLE_ADMIN})</option>
              <option value="BRAND_ADMIN">브랜드 ({roleCounts.BRAND_ADMIN})</option>
              <option value="SELLER">라이브 셀러 ({roleCounts.SELLER})</option>
              <option value="BUYER">구매자 ({roleCounts.BUYER})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름, 이메일 검색..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white" />
          {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
        </div>
      </div>

      {/* Role Summary */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-5">
        {Object.entries(ROLE_MAP).map(([key, val]) => (
          <button
            key={key}
            onClick={() => setFilterRole(filterRole === key ? "all" : key)}
            className={`bg-white rounded-xl border p-3 text-center transition-all ${
              filterRole === key ? "border-brand-500 ring-1 ring-brand-200" : "border-gray-100 hover:border-gray-200"
            }`}
          >
            <p className="text-lg font-bold text-gray-900">{roleCounts[key as keyof typeof roleCounts]}</p>
            <p className="text-[10px] text-gray-400">{val.label}</p>
          </button>
        ))}
      </div>

      {/* Mobile Card View */}
      <div className="space-y-2 lg:hidden">
        {pageItems.map((user) => {
          const role = ROLE_MAP[user.role] || ROLE_MAP.BUYER;
          return (
            <div key={user.id} className="bg-white rounded-xl border border-gray-100 p-3.5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                  <SafeImage src={null} alt={user.name} width={36} height={36} placeholder={pickDefaultAvatar(user.id, user.gender)} fallbackText={user.name.charAt(0)} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${role.color}`}>
                      {role.label}
                    </span>
                    {user.role === "SELLER" && user.sellerId && (
                      <button
                        onClick={() => openCommEdit(user)}
                        className="text-[9px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 bg-indigo-50 text-indigo-600 flex items-center gap-0.5 hover:bg-indigo-100"
                      >
                        <Icon name="Discount" size={8} />
                        {withVatRate(user.commissionRate ?? 5)}% (부가세 포함)
                      </button>
                    )}
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${user.isActive ? "bg-green-500" : "bg-red-400"}`} />
                  </div>
                  <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                  <p className="text-[11px] text-gray-400 flex items-center gap-1">
                    <Icon name="Phone" size={10} className="text-gray-300" /> {user.phone || "연락처 미등록"}
                  </p>
                  <div className="mt-1"><SignupBadges providers={user.authProviders} /></div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-500">주문 {user.orderCount}</p>
                  <p className="text-[10px] text-gray-400">{new Date(user.createdAt).toLocaleDateString("ko-KR")}</p>
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  onClick={() => setInfoTarget(user)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg py-1.5 whitespace-nowrap"
                >
                  <Icon name="Info" size={12} /> 회원정보 확인
                </button>
                <button
                  onClick={() => handleImpersonate(user)}
                  disabled={impLoading === user.id || !user.isActive}
                  className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold text-white bg-gray-900 hover:bg-gray-800 rounded-lg py-1.5 disabled:opacity-40 whitespace-nowrap"
                >
                  {impLoading === user.id ? <Loader2 size={12} className="animate-spin" /> : <Icon name="Login" size={12} />} 임시 로그인
                </button>
              </div>
            </div>
          );
        })}
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">이름</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">이메일</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">연락처</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">가입경로</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 cursor-pointer hover:text-gray-700" onClick={() => setSortBy("role")}>
                  역할 {sortBy === "role" && "▾"}
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">주문</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">상태</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 cursor-pointer hover:text-gray-700" onClick={() => setSortBy("date")}>
                  가입일 {sortBy === "date" && "▾"}
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pageItems.map((user) => {
                const role = ROLE_MAP[user.role] || ROLE_MAP.BUYER;
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden">
                          <SafeImage src={null} alt={user.name} width={32} height={32} placeholder={pickDefaultAvatar(user.id, user.gender)} fallbackText={user.name.charAt(0)} className="w-full h-full object-cover" />
                        </div>
                        <span className="font-medium text-gray-900">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{user.email}</td>
                    <td className="px-4 py-3 text-gray-500">{user.phone || "-"}</td>
                    <td className="px-4 py-3"><SignupBadges providers={user.authProviders} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${role.color}`}>
                          {role.label}
                        </span>
                        {user.role === "SELLER" && user.sellerId && (
                          <button
                            onClick={() => openCommEdit(user)}
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 flex items-center gap-0.5 hover:bg-indigo-100 transition-colors"
                            title="수수료율 편집 (부가세 10% 포함 표시)"
                          >
                            <Icon name="Discount" size={9} />
                            {withVatRate(user.commissionRate ?? 5)}% (부가세 포함)
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{user.orderCount}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] ${user.isActive ? "text-green-600" : "text-red-500"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? "bg-green-500" : "bg-red-500"}`} />
                        {user.isActive ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => setInfoTarget(user)}
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg px-2.5 py-1.5 whitespace-nowrap"
                        >
                          <Icon name="Info" size={12} /> 회원정보 확인
                        </button>
                        <button
                          onClick={() => handleImpersonate(user)}
                          disabled={impLoading === user.id || !user.isActive}
                          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-gray-900 hover:bg-gray-800 rounded-lg px-2.5 py-1.5 disabled:opacity-40 whitespace-nowrap"
                        >
                          {impLoading === user.id ? <Loader2 size={12} className="animate-spin" /> : <Icon name="Login" size={12} />} 임시 로그인
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* 수수료율 편집 모달 */}
      {commTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={closeCommEdit}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Icon name="Discount" size={18} className="text-indigo-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">라이브 셀러 수수료율 설정</h3>
                <p className="text-[11px] text-gray-400">{commTarget.name}</p>
              </div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-2.5 my-3">
              <p className="text-[11px] text-indigo-700 leading-relaxed">
                현재 수수료율: {commTarget.current}% (부가세 포함 {withVatRate(commTarget.current)}%) · 정산 시 판매액에서 차감됩니다. 기본값 5%.
              </p>
            </div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">새 수수료율 (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              className="input-field text-sm"
              placeholder="5"
              value={commRate}
              onChange={(e) => setCommRate(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={closeCommEdit} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                취소
              </button>
              <button
                onClick={handleCommSave}
                disabled={commSaving}
                className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {commSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 재설정 모달 */}
      {resetTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={closeReset}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                <Icon name="Lock" size={18} className="text-amber-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">비밀번호 재설정</h3>
                <p className="text-[11px] text-gray-400">{resetTarget.name} · {resetTarget.email}</p>
              </div>
            </div>

            <div className="bg-amber-50 rounded-lg p-2.5 my-3">
              <p className="text-[11px] text-amber-700 leading-relaxed">
                기존 비밀번호는 복호화할 수 없습니다. 새 임시 비밀번호로 덮어쓰며, 변경한 값을 회원에게 직접 전달해 주세요.
              </p>
            </div>

            <label className="block text-xs font-semibold text-gray-600 mb-1.5">새 임시 비밀번호</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                className="input-field text-sm pr-10"
                placeholder="8자 이상 입력"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                minLength={8}
                autoFocus
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                onClick={() => setShowPw(!showPw)}
              >
                {showPw ? <Icon name="Eye" size={16} /> : <Icon name="Eye" size={16} />}
              </button>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={closeReset}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                취소
              </button>
              <button
                onClick={handleResetSubmit}
                disabled={pwLoading || newPw.length < 8}
                className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {pwLoading ? "처리 중..." : "재설정"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 회원정보 확인 모달 */}
      {infoTarget && (() => {
        const u = infoTarget;
        const ur = ROLE_MAP[u.role] || ROLE_MAP.BUYER;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-4" onClick={() => setInfoTarget(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5"><Icon name="Info" size={16} className="text-gray-500" /> 회원정보</h3>
                <button onClick={() => setInfoTarget(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                  <SafeImage src={null} alt={u.name} width={44} height={44} placeholder={pickDefaultAvatar(u.id, u.gender)} fallbackText={u.name.charAt(0)} className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-base font-bold text-gray-900">{u.name}</p>
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${ur.color}`}>{ur.label}</span>
                    {u.role === "SELLER" && u.sellerId && (
                      <button
                        onClick={() => { setInfoTarget(null); openCommEdit(u); }}
                        className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 flex items-center gap-0.5 hover:bg-indigo-100"
                      >
                        <Icon name="Discount" size={8} />
                        수수료 {withVatRate(u.commissionRate ?? 5)}% (부가세 포함)
                      </button>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium ${u.isActive ? "text-green-600" : "text-red-500"}`}>
                    {u.isActive ? "● 활성" : "● 활동 정지"}
                  </span>
                </div>
              </div>

              <div className="space-y-2 bg-gray-50 rounded-xl p-3 text-[12px]">
                <div className="flex items-center gap-2 text-gray-600"><Icon name="Mail" size={13} className="text-gray-400" /> {u.email || "-"}</div>
                <div className="flex items-center gap-2 text-gray-600"><Icon name="Phone" size={13} className="text-gray-400" /> {u.phone || "연락처 미등록"}</div>
                <div className="flex items-center gap-2 text-gray-600"><Icon name="Users" size={13} className="text-gray-400" /> 성별 {u.gender === "male" ? "남성" : u.gender === "female" ? "여성" : "미입력"}</div>
                <div className="flex items-center gap-2 text-gray-600"><Icon name="Calendar" size={13} className="text-gray-400" /> 생년월일 {u.birthday || "미입력"}</div>
                <div className="flex items-center gap-2 text-gray-600"><Icon name="Login" size={13} className="text-gray-400" /> 가입경로 <SignupBadges providers={u.authProviders} /></div>
                <div className="flex items-center gap-2 text-gray-600"><Icon name="Calendar" size={13} className="text-gray-400" /> 가입 {new Date(u.createdAt).toLocaleDateString("ko-KR")}</div>
                <div className="flex items-center gap-3 pt-1">
                  <span className="flex items-center gap-1 text-gray-600"><Icon name="Cart" size={13} className="text-gray-400" /> 주문 {u.orderCount}</span>
                  <span className="flex items-center gap-1 text-gray-600"><Icon name="Star" size={13} className="text-gray-400" /> 리뷰 {u.reviewCount}</span>
                </div>
              </div>

              {u.orderCount > 0 && (
                <div className="mt-3">
                  <FanPurchaseHistory userId={u.id} userName={u.name} orderCount={u.orderCount} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  onClick={() => { setResetTarget(u); setInfoTarget(null); }}
                  className="inline-flex items-center justify-center gap-1.5 text-[12px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg py-2.5 whitespace-nowrap"
                >
                  <Icon name="Lock" size={13} /> 비밀번호 재설정
                </button>
                <button
                  onClick={() => handleToggleActive(u)}
                  disabled={togglingId === u.id}
                  className={`inline-flex items-center justify-center gap-1.5 text-[12px] font-bold rounded-lg py-2.5 whitespace-nowrap disabled:opacity-50 ${
                    u.isActive ? "text-red-600 bg-red-50 hover:bg-red-100" : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                  }`}
                >
                  {togglingId === u.id ? <Loader2 size={13} className="animate-spin" /> : u.isActive ? <Ban size={13} /> : <Icon name="Certified" size={13} />}
                  {u.isActive ? "활동 정지" : "활성화"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
