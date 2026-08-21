"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { useRouter } from "next/navigation";
import {Network, X, Loader2, Building2} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";
import Pagination, { usePagination } from "@/components/shared/Pagination";

interface Settlement {
  id: string;
  periodLabel: string;
  totalAmount: number;
  status: string;
  memo: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface NodeRow {
  nodeUserId: string;
  name: string;
  email: string;
  isActive: boolean;
  middleAdminCount: number;
  brandCount: number;
  settlements: Settlement[];
  totalPaid: number;
  totalPending: number;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "PAID") return <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-600">지급완료</span>;
  if (status === "CONFIRMED") return <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">승인됨</span>;
  return <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-yellow-50 text-yellow-600">대기중</span>;
}

function SettleForm({
  nodeUserId,
  onClose,
  onDone,
}: {
  nodeUserId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { appAlert } = useAppDialog();
  const [form, setForm] = useState({ periodLabel: "", totalAmount: "", memo: "" });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.periodLabel || !form.totalAmount) {
      await appAlert("정산 기간과 금액은 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/node-settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeUserId,
          periodLabel: form.periodLabel,
          totalAmount: Number(form.totalAmount),
          memo: form.memo || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { await appAlert(data.error || "저장에 실패했습니다."); return; }
      onDone();
    } catch {
      await appAlert("오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-100 bg-teal-50 p-4 space-y-3">
      <p className="text-xs font-semibold text-teal-700 flex items-center gap-1.5"><Icon name="CreditCard" size={13} />정산 발송</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">정산 기간 <span className="text-red-500">*</span></label>
          <input type="text" className="input-field text-sm" placeholder="예) 2025년 1월" value={form.periodLabel} onChange={(e) => setForm({ ...form, periodLabel: e.target.value })} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">정산 금액 (원) <span className="text-red-500">*</span></label>
          <input type="number" className="input-field text-sm" placeholder="0" min="0" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} required />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">메모</label>
          <input type="text" className="input-field text-sm" placeholder="메모 (선택)" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 bg-white rounded-lg border border-gray-200 hover:bg-gray-50">취소</button>
        <button type="submit" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-60" disabled={saving}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Icon name="Check" size={14} />}
          발송
        </button>
      </div>
    </form>
  );
}

export default function AdminNodeSettlementsClient({ rows }: { rows: NodeRow[] }) {
  const router = useRouter();
  const { appAlert, appConfirm } = useAppDialog();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFormFor, setShowFormFor] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const totalNodes = rows.length;
  const totalPendingAll = rows.reduce((sum, r) => sum + r.totalPending, 0);
  const totalPaidAll = rows.reduce((sum, r) => sum + r.totalPaid, 0);

  const { pageItems, page, setPage, totalPages } = usePagination(rows, 20);

  const handleStatusChange = async (settlementId: string, status: string) => {
    const label = status === "PAID" ? "지급완료" : status === "CONFIRMED" ? "승인" : status;
    const ok = await appConfirm(`정산 상태를 '${label}'으로 변경하시겠습니까?`);
    if (!ok) return;
    setUpdatingId(settlementId);
    try {
      const res = await fetch("/api/admin/node-settlements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: settlementId, status }),
      });
      const data = await res.json();
      if (!res.ok) { await appAlert(data.error || "변경에 실패했습니다."); return; }
      router.refresh();
    } catch {
      await appAlert("오류가 발생했습니다.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <>
      <div className="mb-5">
        <h1 className="text-lg font-bold text-gray-900">노드 정산 관리</h1>
        <p className="text-xs text-gray-400 mt-0.5">노드 계정에게 정산을 발송하고 현황을 관리합니다</p>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Network size={15} className="text-teal-500" />
            <p className="text-xs font-semibold text-gray-600">총 노드 수</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{totalNodes}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-100 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Icon name="Clock" size={15} className="text-amber-500" />
            <p className="text-xs font-semibold text-gray-600">대기 중</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{totalPendingAll.toLocaleString()}원</p>
        </div>
        <div className="bg-white rounded-xl border border-emerald-100 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Icon name="Chart" size={15} className="text-emerald-500" />
            <p className="text-xs font-semibold text-gray-600">총 지급액</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{totalPaidAll.toLocaleString()}원</p>
        </div>
      </div>

      {/* 노드 목록 */}
      {rows.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Network size={40} strokeWidth={1.5} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm text-gray-400">등록된 노드 계정이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pageItems.map((row) => (
            <div key={row.nodeUserId} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {/* 노드 헤더 */}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
                    <Network size={18} className="text-teal-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900">{row.name}</p>
                      {!row.isActive && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">비활성</span>}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{row.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowFormFor(showFormFor === row.nodeUserId ? null : row.nodeUserId)}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                    >
                      {showFormFor === row.nodeUserId ? <X size={12} /> : <Icon name="Plus" size={12} />}
                      정산 발송
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === row.nodeUserId ? null : row.nodeUserId)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {expandedId === row.nodeUserId ? <Icon name="ChevronDown" size={16} className="rotate-180" /> : <Icon name="ChevronDown" size={16} />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 flex-wrap text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Icon name="Settings" size={11} />{row.middleAdminCount}명 중간관리자</span>
                  <span className="flex items-center gap-1"><Building2 size={11} />{row.brandCount}개 직접배정 브랜드</span>
                  <span className="flex items-center gap-1 text-amber-600">대기 {row.totalPending.toLocaleString()}원</span>
                  <span className="flex items-center gap-1 text-emerald-600">지급 {row.totalPaid.toLocaleString()}원</span>
                  <span>정산 {row.settlements.length}건</span>
                </div>
              </div>

              {/* 정산 발송 폼 */}
              {showFormFor === row.nodeUserId && (
                <SettleForm
                  nodeUserId={row.nodeUserId}
                  onClose={() => setShowFormFor(null)}
                  onDone={() => { setShowFormFor(null); router.refresh(); }}
                />
              )}

              {/* 정산 내역 펼침 */}
              {expandedId === row.nodeUserId && (
                <div className="border-t border-gray-100 bg-gray-50">
                  {row.settlements.length === 0 ? (
                    <div className="text-center py-8">
                      <Icon name="Warning" size={24} strokeWidth={1.5} className="mx-auto mb-2 text-gray-200" />
                      <p className="text-xs text-gray-400">발송된 정산이 없습니다</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {row.settlements.map((s) => (
                        <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[13px] font-medium text-gray-800">{s.periodLabel}</p>
                              <StatusBadge status={s.status} />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {new Date(s.createdAt).toLocaleDateString("ko-KR")}
                              {s.memo && ` · ${s.memo}`}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-gray-800 flex-shrink-0">
                            {s.totalAmount.toLocaleString()}원
                          </p>
                          {/* 상태 변경 버튼 */}
                          {s.status === "PENDING" && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(s.id, "CONFIRMED")}
                              disabled={updatingId === s.id}
                              className="text-[11px] px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50 flex-shrink-0"
                            >
                              {updatingId === s.id ? <Loader2 size={11} className="animate-spin" /> : "승인"}
                            </button>
                          )}
                          {s.status === "CONFIRMED" && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(s.id, "PAID")}
                              disabled={updatingId === s.id}
                              className="text-[11px] px-2 py-1 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50 flex-shrink-0"
                            >
                              {updatingId === s.id ? <Loader2 size={11} className="animate-spin" /> : "지급완료"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </>
  );
}
