"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDialog } from "@/components/shared/AppDialog";
import { Loader2, X} from 'lucide-react';
import Pagination, { usePagination } from "@/components/shared/Pagination";

// ─── 직접 정산 타입 (NodeSettlement 패턴) ───────────────────────────────────
interface ManagerSettlement {
  id: string;
  middleAdminId: string;
  periodLabel: string;
  totalAmount: number;
  status: string;
  memo: string | null;
  paidAt: string | null;
  createdAt: string;
}

// ─── 직접 정산 입력 폼 ────────────────────────────────────────────────────────
function ManagerSettleForm({
  middleAdminId,
  onClose,
  onDone,
}: {
  middleAdminId: string;
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
      const res = await fetch("/api/admin/middle-manager-settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          middleAdminId,
          periodLabel: form.periodLabel,
          totalAmount: Number(form.totalAmount),
          memo: form.memo || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        await appAlert(data.error || "정산 생성에 실패했습니다.");
        return;
      }
      onDone();
    } catch {
      await appAlert("오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-100 bg-blue-50/50 p-3 space-y-2">
      <p className="text-[11px] font-semibold text-blue-700 flex items-center gap-1">
        <Icon name="CreditCard" size={12} />
        직접 정산 등록
      </p>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="정산 기간 (예: 2025년 1월)"
          value={form.periodLabel}
          onChange={(e) => setForm((f) => ({ ...f, periodLabel: e.target.value }))}
          className="col-span-2 text-[11px] px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300"
        />
        <input
          type="number"
          placeholder="정산 금액 (원)"
          value={form.totalAmount}
          onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value }))}
          className="text-[11px] px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300"
        />
        <input
          type="text"
          placeholder="메모 (선택)"
          value={form.memo}
          onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
          className="text-[11px] px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="px-2.5 py-1 text-[11px] text-gray-500 hover:text-gray-700">
          취소
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium rounded-lg transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Icon name="Plus" size={11} />}
          등록
        </button>
      </div>
    </form>
  );
}

// ─── 기존 커미션 기반 정산 타입 ─────────────────────────────────────────────
interface SettlementRecord {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalSales: number;
  marginAmount: number;
  settlementAmount: number;
  status: string;
  paidAt: string | null;
  invoiceStatus: string;
  invoiceRequestedAt: string | null;
  invoiceIssuedAt: string | null;
  invoiceNumber: string | null;
  createdAt: string;
}

interface Row {
  middleAdminId: string;
  name: string;
  pendingCount: number;
  pendingOrderAmount: number;
  pendingMarginAmount: number;
  paidMarginAmount: number;
  settlements: SettlementRecord[];
  managerSettlements: ManagerSettlement[];
}

function won(n: number) {
  return `${n.toLocaleString()}원`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" });
}

const INVOICE_LABEL: Record<string, string> = {
  NONE: "미요청",
  REQUESTED: "발급요청",
  ISSUED: "발급완료",
};
const INVOICE_STYLE: Record<string, string> = {
  NONE: "bg-gray-100 text-gray-400",
  REQUESTED: "bg-amber-50 text-amber-600",
  ISSUED: "bg-emerald-50 text-emerald-600",
};

export default function AdminMiddleSettlementClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const { appConfirm, appAlert } = useAppDialog();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingInvoiceId, setSavingInvoiceId] = useState<string | null>(null);
  const [invoiceNumbers, setInvoiceNumbers] = useState<Record<string, string>>({});
  const [showManagerFormId, setShowManagerFormId] = useState<string | null>(null);
  const [payingManagerId, setPayingManagerId] = useState<string | null>(null);

  const totalPending = rows.reduce((acc, r) => acc + r.pendingMarginAmount, 0);
  const totalPaid = rows.reduce((acc, r) => acc + r.paidMarginAmount, 0);

  const { pageItems, page, setPage, totalPages } = usePagination(rows, 20);

  async function handlePay(row: Row) {
    if (row.pendingMarginAmount <= 0) return;
    const ok = await appConfirm({
      title: "마진 지급 처리",
      message: `${row.name}님의 미지급 마진 ${won(row.pendingMarginAmount)} (${row.pendingCount}건)을 지급 처리하시겠습니까?`,
      confirmText: "지급 처리",
    });
    if (!ok) return;

    setPayingId(row.middleAdminId);
    try {
      const res = await fetch("/api/admin/middle-settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ middleAdminId: row.middleAdminId }),
      });
      const data = await res.json();
      if (!res.ok) {
        await appAlert(data.error || "지급 처리에 실패했습니다.");
        return;
      }
      await appAlert(data.message || "지급 처리가 완료되었습니다.");
      router.refresh();
    } catch {
      await appAlert("네트워크 오류가 발생했습니다.");
    } finally {
      setPayingId(null);
    }
  }

  async function handleManagerPay(settlementId: string) {
    const ok = await appConfirm({
      title: "직접 정산 지급 처리",
      message: "선택한 정산을 지급완료 처리하시겠습니까?",
      confirmText: "지급 처리",
    });
    if (!ok) return;
    setPayingManagerId(settlementId);
    try {
      const res = await fetch("/api/admin/middle-manager-settlements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: settlementId, status: "PAID" }),
      });
      const data = await res.json();
      if (!res.ok) { await appAlert(data.error || "처리 실패"); return; }
      router.refresh();
    } catch {
      await appAlert("오류가 발생했습니다.");
    } finally {
      setPayingManagerId(null);
    }
  }

  async function handleIssueInvoice(row: Row, s: SettlementRecord) {
    const invoiceNumber = invoiceNumbers[s.id] || "";
    const ok = await appConfirm({
      title: "세금계산서 발급 처리",
      message: `[${row.name}] ${fmtDate(s.periodStart)} ~ ${fmtDate(s.periodEnd)} 세금계산서를 발급 처리하시겠습니까?${invoiceNumber ? `\n발급번호: ${invoiceNumber}` : ""}`,
      confirmText: "발급완료",
    });
    if (!ok) return;

    setSavingInvoiceId(s.id);
    try {
      const res = await fetch("/api/admin/middle-settlements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settlementId: s.id,
          invoiceNumber: invoiceNumber || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        await appAlert(data.error || "처리 실패");
        return;
      }
      await appAlert(data.message || "세금계산서가 발급 처리되었습니다.");
      router.refresh();
    } catch {
      await appAlert("오류가 발생했습니다.");
    } finally {
      setSavingInvoiceId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-gray-900">중간관리자 정산</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          중간관리자별 적립 마진을 확인하고 지급 처리합니다.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-3 sm:p-4 text-white">
          <p className="text-amber-100 text-[9px] sm:text-[10px] font-medium mb-1">전체 미지급</p>
          <p className="text-lg sm:text-2xl font-bold">{won(totalPending)}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-3 sm:p-4 text-white">
          <p className="text-emerald-100 text-[9px] sm:text-[10px] font-medium mb-1">누적 지급</p>
          <p className="text-lg sm:text-2xl font-bold">{won(totalPaid)}</p>
        </div>
      </div>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <Icon name="Wallet" size={28} className="mx-auto text-gray-200 mb-2" />
            <p className="text-xs text-gray-400">등록된 중간관리자가 없습니다.</p>
          </div>
        ) : (
          pageItems.map((r) => {
            const isExpanded = expandedId === r.middleAdminId;
            const isPaying = payingId === r.middleAdminId;
            return (
              <div key={r.middleAdminId} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {/* 헤더 행 */}
                <div className="flex items-center justify-between p-3 sm:p-4 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-amber-600 font-bold text-xs">{r.name.charAt(0)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{r.name}</p>
                      <p className="text-[10px] text-gray-400">
                        정산 {r.settlements.length}건 · 직접 {r.managerSettlements.length}건
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] text-gray-400">미지급</p>
                      <p className="text-sm font-bold text-amber-600">{won(r.pendingMarginAmount)}</p>
                    </div>
                    {r.pendingMarginAmount > 0 && (
                      <button
                        onClick={() => handlePay(r)}
                        disabled={isPaying}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-medium rounded-lg transition-colors flex items-center gap-1 disabled:opacity-60"
                      >
                        {isPaying ? <Loader2 size={11} className="animate-spin" /> : null}
                        지급처리
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : r.middleAdminId)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      {isExpanded ? <Icon name="ChevronDown" size={16} className="text-gray-400 rotate-180" /> : <Icon name="ChevronDown" size={16} className="text-gray-400" />}
                    </button>
                  </div>
                </div>

                {/* 모바일 미지급 표시 */}
                <div className="sm:hidden px-3 pb-2 flex gap-4">
                  <div>
                    <p className="text-[9px] text-gray-400">미지급</p>
                    <p className="text-xs font-bold text-amber-600">{won(r.pendingMarginAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400">누적지급</p>
                    <p className="text-xs font-bold text-emerald-600">{won(r.paidMarginAmount)}</p>
                  </div>
                </div>

                {/* 확장 영역 */}
                {isExpanded && (
                  <div className="border-t border-gray-50 bg-gray-50/50 p-3 sm:p-4 space-y-4">
                    {/* 직접 정산 섹션 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[11px] font-semibold text-blue-700">직접 정산 내역</p>
                        <button
                          onClick={() => setShowManagerFormId(showManagerFormId === r.middleAdminId ? null : r.middleAdminId)}
                          className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          {showManagerFormId === r.middleAdminId ? <X size={10} /> : <Icon name="Plus" size={10} />}
                          {showManagerFormId === r.middleAdminId ? "닫기" : "정산 등록"}
                        </button>
                      </div>
                      {showManagerFormId === r.middleAdminId && (
                        <ManagerSettleForm
                          middleAdminId={r.middleAdminId}
                          onClose={() => setShowManagerFormId(null)}
                          onDone={() => { setShowManagerFormId(null); router.refresh(); }}
                        />
                      )}
                      {r.managerSettlements.length === 0 ? (
                        <p className="text-[10px] text-gray-400 mt-1">직접 정산 내역이 없습니다.</p>
                      ) : (
                        <div className="space-y-1.5 mt-1">
                          {r.managerSettlements.map((ms) => {
                            const isPay = payingManagerId === ms.id;
                            return (
                              <div key={ms.id} className="bg-white rounded-lg border border-blue-100 p-2.5 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-medium text-gray-800">{ms.periodLabel}</p>
                                  {ms.memo && <p className="text-[10px] text-gray-400">{ms.memo}</p>}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <p className="text-[12px] font-bold text-blue-700">{won(ms.totalAmount)}</p>
                                  {ms.status === "PAID" ? (
                                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">지급완료</span>
                                  ) : (
                                    <button
                                      onClick={() => handleManagerPay(ms.id)}
                                      disabled={isPay}
                                      className="flex items-center gap-1 px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-medium rounded-lg transition-colors disabled:opacity-60"
                                    >
                                      {isPay ? <Loader2 size={9} className="animate-spin" /> : null}
                                      지급
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* 커미션 기반 정산 섹션 */}
                    <div>
                      <p className="text-[11px] font-semibold text-gray-500 mb-2">커미션 정산 내역</p>
                      {r.settlements.length === 0 ? (
                        <p className="text-xs text-gray-400 py-2">정산 내역이 없습니다.</p>
                      ) : (
                        r.settlements.map((s) => {
                          const isSaving = savingInvoiceId === s.id;
                          return (
                            <div key={s.id} className="bg-white rounded-lg border border-gray-100 p-3 space-y-2 mb-2">
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] font-medium text-gray-700">
                                  {fmtDate(s.periodStart)} ~ {fmtDate(s.periodEnd)}
                                </p>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${INVOICE_STYLE[s.invoiceStatus] ?? INVOICE_STYLE.NONE}`}>
                                  {INVOICE_LABEL[s.invoiceStatus] ?? "미요청"}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-center">
                                <div>
                                  <p className="text-[9px] text-gray-400">주문금액</p>
                                  <p className="text-xs font-semibold text-gray-800">{won(s.totalSales)}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-gray-400">마진액</p>
                                  <p className="text-xs font-semibold text-emerald-600">{won(s.marginAmount)}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-gray-400">지급일</p>
                                  <p className="text-xs font-semibold text-gray-800">{s.paidAt ? fmtDate(s.paidAt) : "-"}</p>
                                </div>
                              </div>
                              {s.invoiceStatus === "REQUESTED" && (
                                <div className="flex gap-2 pt-1">
                                  <input
                                    type="text"
                                    placeholder="세금계산서 번호 (선택)"
                                    value={invoiceNumbers[s.id] || ""}
                                    onChange={(e) => setInvoiceNumbers((prev) => ({ ...prev, [s.id]: e.target.value }))}
                                    className="flex-1 text-[11px] px-2 py-1 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-300"
                                  />
                                  <button
                                    onClick={() => handleIssueInvoice(r, s)}
                                    disabled={isSaving}
                                    className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-medium rounded-lg transition-colors flex items-center gap-1 disabled:opacity-60"
                                  >
                                    {isSaving ? <Loader2 size={11} className="animate-spin" /> : null}
                                    발급
                                  </button>
                                </div>
                              )}
                              {s.invoiceStatus === "ISSUED" && s.invoiceNumber && (
                                <p className="text-[10px] text-emerald-600">계산서 번호: {s.invoiceNumber}</p>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}
