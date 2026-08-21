"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppDialog } from "@/components/shared/AppDialog";
import {X, Building2, Minus, Plus} from 'lucide-react';
import Pagination, { usePagination } from "@/components/shared/Pagination";
import SafeImage from "@/components/shared/SafeImage";
import { MIDDLE_ADMIN_AVATARS } from "@/lib/defaults";

function pickMiddleAdminAvatar(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return MIDDLE_ADMIN_AVATARS[Math.abs(hash) % MIDDLE_ADMIN_AVATARS.length];
}

interface MiddleAdmin {
  id: string;
  userId: string;
  name: string;
  contactPhone: string | null;
  isActive: boolean;
  isApproved: boolean;
  userAvatar: string | null;
  userName: string;
  userEmail: string;
  userPhone?: string | null;
  userIsActive: boolean;
  userCreatedAt?: string;
  brandCount: number;
  sellerCount: number;
  createdAt: string;
  settlementAvailable: number;
  settlementScheduled: number;
}

const won = (n: number) => Math.round(n).toLocaleString("ko-KR") + "원";

export default function MiddleAdminManagementClient({
  middleAdmins,
}: {
  middleAdmins: MiddleAdmin[];
}) {
  const router = useRouter();
  const { appConfirm, appAlert } = useAppDialog();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [detailMA, setDetailMA] = useState<MiddleAdmin | null>(null);

  // +/- 조정 모달 상태
  const [adjustTarget, setAdjustTarget] = useState<{ ma: MiddleAdmin; mode: "add" | "sub" } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustMemo, setAdjustMemo] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return middleAdmins;
    const q = searchQuery.toLowerCase();
    return middleAdmins.filter(
      (m) => m.name.toLowerCase().includes(q) || m.userName.toLowerCase().includes(q) || m.userEmail.toLowerCase().includes(q)
    );
  }, [middleAdmins, searchQuery]);

  const { pageItems, page, setPage, totalPages } = usePagination(filtered, 20);

  const [form, setForm] = useState({ name: "", email: "", password: "", contactPhone: "" });
  const resetForm = () => { setForm({ name: "", email: "", password: "", contactPhone: "" }); setError(""); setShowPassword(false); };

  const openAdjust = (ma: MiddleAdmin, mode: "add" | "sub") => {
    setAdjustTarget({ ma, mode }); setAdjustAmount(""); setAdjustMemo("");
  };
  const closeAdjust = () => { setAdjustTarget(null); setAdjustAmount(""); setAdjustMemo(""); };

  const handleAdjustSubmit = async () => {
    if (!adjustTarget) return;
    const num = parseInt(adjustAmount.replace(/,/g, ""), 10);
    if (!Number.isFinite(num) || num <= 0) {
      appAlert({ message: "올바른 금액을 입력해주세요.", type: "warning" }); return;
    }
    const finalAmount = adjustTarget.mode === "sub" ? -num : num;
    const label = adjustTarget.mode === "add" ? "추가" : "차감";

    const ok = await appConfirm({
      message: `${adjustTarget.ma.name}의 정산 가능 금액에서\n${won(Math.abs(finalAmount))}을 ${label}합니다.\n계속하시겠습니까?`,
    });
    if (!ok) return;

    setAdjustLoading(true);
    try {
      const res = await fetch("/api/admin/balance-adjustment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientType: "MIDDLE_ADMIN", userId: adjustTarget.ma.userId, amount: finalAmount, memo: adjustMemo || null }),
      });
      if (res.ok) {
        closeAdjust();
        appAlert({ message: `정산 가능 금액이 ${label}되었습니다.`, type: "success" });
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        appAlert({ message: data.error || "조정에 실패했습니다.", type: "warning" });
      }
    } catch {
      appAlert({ message: "조정 중 오류가 발생했습니다.", type: "warning" });
    } finally { setAdjustLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await fetch("/api/admin/middle-admins", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "등록에 실패했습니다.");
      else { setShowForm(false); resetForm(); router.refresh(); }
    } catch { setError("중간관리자 등록 중 오류가 발생했습니다."); } finally { setLoading(false); }
  };

  const handleDelete = async (middleAdminId: string) => {
    if (!(await appConfirm({ message: "이 중간관리자를 비활성화하시겠습니까?", type: "warning" }))) return;
    try {
      const res = await fetch("/api/admin/middle-admins", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ middleAdminId }) });
      if (res.ok) router.refresh();
    } catch { appAlert({ message: "비활성화에 실패했습니다.", type: "warning" }); }
  };

  const handleReactivate = async (middleAdminId: string) => {
    if (!(await appConfirm({ message: "이 중간관리자를 다시 활성화하시겠습니까?", type: "confirm" }))) return;
    try {
      const res = await fetch("/api/admin/middle-admins", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ middleAdminId, isActive: true }) });
      if (res.ok) router.refresh();
    } catch { appAlert({ message: "활성화에 실패했습니다.", type: "warning" }); }
  };

  const handleToggleApprove = async (middleAdminId: string, next: boolean) => {
    try {
      const res = await fetch("/api/admin/middle-admins", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ middleAdminId, isApproved: next }) });
      if (res.ok) router.refresh();
      else appAlert({ message: "승인 처리에 실패했습니다.", type: "warning" });
    } catch { appAlert({ message: "승인 처리에 실패했습니다.", type: "warning" }); }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">중간관리자 관리</h1>
          <p className="text-sm text-gray-500">총 {middleAdmins.length}명</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); if (!showForm) resetForm(); }}
          className="btn-primary text-sm flex items-center gap-1.5">
          {showForm ? <X size={16} /> : <Icon name="Plus" size={16} />}
          {showForm ? "닫기" : "중간관리자 등록"}
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름, 이메일 검색..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white" />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Icon name="Settings" size={16} className="text-indigo-500" /> 새 중간관리자 등록
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5"><Icon name="Settings" size={13} /> 기본 정보</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">이름 <span className="text-red-500">*</span></label>
                  <input type="text" className="input-field text-sm" placeholder="중간관리자/조직명"
                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">연락처</label>
                  <input type="text" className="input-field text-sm" placeholder="010-1234-5678"
                    value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5"><Icon name="Mail" size={13} /> 로그인 계정 정보</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">로그인 이메일 <span className="text-red-500">*</span></label>
                  <input type="email" className="input-field text-sm" placeholder="manager@example.com"
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">비밀번호 <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} className="input-field text-sm pr-10" placeholder="비밀번호"
                      value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required />
                    <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowPassword(!showPassword)}>
                      <Icon name="Eye" size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">취소</button>
              <button type="submit" className="btn-primary text-sm" disabled={loading}>
                {loading ? "등록 중..." : "중간관리자 등록"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <Icon name="Settings" size={40} strokeWidth={1.5} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">{searchQuery ? "검색 결과가 없습니다." : "등록된 중간관리자가 없습니다"}</p>
            <p className="text-xs text-gray-400 mt-1">중간관리자 등록 버튼을 눌러 새로운 중간관리자를 추가하세요</p>
          </div>
        ) : (
          pageItems.map((m) => (
            <div key={m.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  <SafeImage src={m.userAvatar || pickMiddleAdminAvatar(m.userId)} alt={m.name} width={48} height={48} className="w-full h-full object-cover" fallbackText={m.name.charAt(0)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-gray-900">{m.name}</h3>
                    {!m.userIsActive && (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">비활성</span>
                    )}
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${m.isApproved ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>
                      {m.isApproved ? "승인됨" : "미승인"}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">{m.userName} · {m.userEmail}</p>
                  {m.contactPhone && (
                    <p className="text-[10px] text-gray-400 mt-0.5">연락처: {m.contactPhone}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                  <button onClick={() => setDetailMA(m)}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 flex items-center gap-1">
                    <Icon name="Info" size={11} /> 상세보기
                  </button>
                  <button onClick={() => handleToggleApprove(m.id, !m.isApproved)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg ${m.isApproved ? "bg-gray-50 text-gray-500 hover:bg-gray-100" : "bg-brand-500 text-black hover:bg-brand-400"}`}>
                    {m.isApproved ? "승인취소" : "승인"}
                  </button>
                  {m.userIsActive ? (
                    <button onClick={() => handleDelete(m.id)} className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">비활성화</button>
                  ) : (
                    <button onClick={() => handleReactivate(m.id)} className="text-xs px-2.5 py-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100">활성화</button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-gray-50">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Building2 size={13} className="text-purple-400" />
                  <span className="font-semibold">{m.brandCount}</span> 브랜드
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Icon name="Store" size={13} className="text-indigo-400" />
                  <span className="font-semibold">{m.sellerCount}</span> 라이브 셀러
                </div>
                <div className="text-xs text-gray-400 ml-auto">
                  등록일: {new Date(m.createdAt).toLocaleDateString("ko-KR")}
                </div>
              </div>

              {/* 정산 금액 요약 */}
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <div className="bg-emerald-50 rounded-lg px-2.5 py-2 text-center">
                  <p className="text-[9px] text-emerald-600 mb-0.5">정산 가능</p>
                  <p className="text-[11px] font-bold text-emerald-700">{won(m.settlementAvailable)}</p>
                </div>
                <div className="bg-orange-50 rounded-lg px-2.5 py-2 text-center">
                  <p className="text-[9px] text-orange-500 mb-0.5">정산 예정</p>
                  <p className="text-[11px] font-bold text-orange-600">{won(m.settlementScheduled)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg px-2.5 py-2">
                  <p className="text-[9px] text-gray-500 mb-0.5">합계</p>
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[11px] font-bold text-gray-800">{won(m.settlementAvailable + m.settlementScheduled)}</p>
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => openAdjust(m, "add")}
                        className="w-5 h-5 flex items-center justify-center rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors" title="추가">
                        <Plus size={10} strokeWidth={2.5} />
                      </button>
                      <button onClick={() => openAdjust(m, "sub")}
                        className="w-5 h-5 flex items-center justify-center rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors" title="차감">
                        <Minus size={10} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

      {/* 상세보기 모달 */}
      {detailMA && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-4" onClick={() => setDetailMA(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Icon name="Settings" size={15} className="text-indigo-500" /> 중간관리자 상세
              </h3>
              <button onClick={() => setDetailMA(null)} className="text-gray-400 hover:text-gray-600"><X size={17} /></button>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                <SafeImage src={detailMA.userAvatar || pickMiddleAdminAvatar(detailMA.userId)} alt={detailMA.name} width={48} height={48} className="w-full h-full object-cover" fallbackText={detailMA.name.charAt(0)} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{detailMA.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${detailMA.isApproved ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>
                    {detailMA.isApproved ? "승인됨" : "미승인"}
                  </span>
                  {!detailMA.userIsActive && (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">비활성</span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5 text-[12px] bg-gray-50 rounded-xl p-3 mb-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">가입 정보</p>
              <div className="flex items-center gap-2 text-gray-600"><Icon name="Users" size={13} className="text-gray-400" /> {detailMA.userName}</div>
              <div className="flex items-center gap-2 text-gray-600"><Icon name="Mail" size={13} className="text-gray-400" /> {detailMA.userEmail}</div>
              <div className="flex items-center gap-2 text-gray-600"><Icon name="Phone" size={13} className="text-gray-400" /> {detailMA.contactPhone || detailMA.userPhone || "연락처 미등록"}</div>
              <div className="flex items-center gap-2 text-gray-600"><Icon name="Calendar" size={13} className="text-gray-400" /> 가입일 {detailMA.userCreatedAt ? new Date(detailMA.userCreatedAt).toLocaleDateString("ko-KR") : "-"}</div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mb-3">
              <div className="text-center py-2 bg-purple-50 rounded-lg">
                <p className="text-sm font-bold text-purple-800">{detailMA.brandCount}</p>
                <p className="text-[9px] text-purple-400">담당 브랜드</p>
              </div>
              <div className="text-center py-2 bg-indigo-50 rounded-lg">
                <p className="text-sm font-bold text-indigo-800">{detailMA.sellerCount}</p>
                <p className="text-[9px] text-indigo-400">담당 셀러</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 mb-4">
              <div className="bg-emerald-50 rounded-lg p-2 text-center">
                <p className="text-[9px] text-emerald-600">정산 가능</p>
                <p className="text-xs font-bold text-emerald-700">{won(detailMA.settlementAvailable)}</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-2 text-center">
                <p className="text-[9px] text-orange-500">정산 예정</p>
                <p className="text-xs font-bold text-orange-600">{won(detailMA.settlementScheduled)}</p>
              </div>
              <div className="bg-gray-100 rounded-lg p-2 text-center">
                <p className="text-[9px] text-gray-500">합계</p>
                <p className="text-xs font-bold text-gray-800">{won(detailMA.settlementAvailable + detailMA.settlementScheduled)}</p>
              </div>
            </div>

            <button onClick={() => setDetailMA(null)} className="w-full py-2.5 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl">
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 금액 조정 모달 */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={closeAdjust}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${adjustTarget.mode === "add" ? "bg-emerald-50" : "bg-red-50"}`}>
                {adjustTarget.mode === "add" ? <Plus size={18} className="text-emerald-600" /> : <Minus size={18} className="text-red-600" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">정산 가능 금액 {adjustTarget.mode === "add" ? "추가" : "차감"}</h3>
                <p className="text-[11px] text-gray-400">{adjustTarget.ma.name}</p>
              </div>
            </div>
            <div className={`rounded-lg p-2.5 my-3 text-[11px] leading-relaxed ${adjustTarget.mode === "add" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              현재 정산 가능 금액: {won(adjustTarget.ma.settlementAvailable)}
            </div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">{adjustTarget.mode === "add" ? "추가" : "차감"} 금액 (원)</label>
            <input type="number" min={1} step={1} className="input-field text-sm" placeholder="예: 10000"
              value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} autoFocus />
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 mt-3">메모 (선택)</label>
            <input type="text" className="input-field text-sm" placeholder="조정 사유를 입력하세요"
              value={adjustMemo} onChange={(e) => setAdjustMemo(e.target.value)} />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={closeAdjust} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">취소</button>
              <button onClick={handleAdjustSubmit} disabled={adjustLoading}
                className={`px-4 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-40 ${adjustTarget.mode === "add" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-500 hover:bg-red-600"}`}>
                {adjustLoading ? "처리 중..." : adjustTarget.mode === "add" ? "추가" : "차감"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
