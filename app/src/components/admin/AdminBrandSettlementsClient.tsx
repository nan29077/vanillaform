"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {Building2, X, Loader2} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";
import Pagination, { usePagination } from "@/components/shared/Pagination";

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

interface SettlementRecord {
  id: string;
  periodLabel: string;
  totalSupply: number;
  totalSales: number;
  orderCount: number;
  isPaid: boolean;
  memo: string | null;
  paidAt: string | null;
  invoiceStatus: string;
  invoiceRequestedAt: string | null;
  invoiceIssuedAt: string | null;
  invoiceNumber: string | null;
  createdAt: string;
}

interface BrandRow {
  id: string;
  brandName: string;
  userName: string;
  userEmail: string;
  isApproved: boolean;
  middleAdminId: string | null;
  middleAdminName: string | null;
  commissionRate: number;
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  availableAmount: number;
  scheduledAmount: number;
  todayAvailableAmount: number;
  totalSales: number;
  orderCount: number;
  settlements: SettlementRecord[];
  cumulativePaidAmount: number;
  todayPaidAmount: number;
}

interface Summary {
  totalPending: number;
  totalPaid: number;
  todayPaid: number;
  settleDays: number;
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

export default function AdminBrandSettlementsClient({
  brands: initialBrands,
  summary,
}: {
  brands: BrandRow[];
  summary: Summary;
}) {
  const router = useRouter();
  const { appAlert, appConfirm } = useAppDialog();
  const [brands] = useState(initialBrands);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newPeriod, setNewPeriod] = useState<Record<string, string>>({});
  const [newMemo, setNewMemo] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return brands;
    const q = searchQuery.toLowerCase();
    return brands.filter(
      (b) =>
        b.brandName.toLowerCase().includes(q) ||
        b.userName.toLowerCase().includes(q) ||
        (b.middleAdminName ?? "").toLowerCase().includes(q)
    );
  }, [brands, searchQuery]);

  const { pageItems, page, setPage, totalPages } = usePagination(filtered, 20);

  const handleCreateSettlement = async (brand: BrandRow) => {
    const period = newPeriod[brand.id] || new Date().toISOString().slice(0, 7);
    const memo = newMemo[brand.id] || "";
    const amount = brand.availableAmount;

    const ok = await appConfirm({
      title: "정산 레코드 생성",
      message: `[${brand.brandName}] ${period} 정산을\n공급가 합계 ${won(amount)}으로 생성하시겠습니까?`,
      confirmText: "생성",
    });
    if (!ok) return;

    setSaving(brand.id);
    try {
      const res = await fetch("/api/admin/brand-settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: brand.id,
          periodLabel: period,
          totalSupply: amount,
          totalSales: brand.totalSales,
          orderCount: brand.orderCount,
          memo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        await appAlert({ message: data.error || "생성 실패", type: "warning" });
        return;
      }
      await appAlert({ message: "정산 레코드가 생성되었습니다.", type: "success" });
      router.refresh();
    } catch {
      await appAlert({ message: "오류가 발생했습니다.", type: "warning" });
    } finally {
      setSaving(null);
    }
  };

  const handleTogglePaid = async (brand: BrandRow, s: SettlementRecord) => {
    const action = s.isPaid ? "지급 취소" : "정산완료";
    const ok = await appConfirm({
      title: `${action} 처리`,
      message: `[${brand.brandName}] ${s.periodLabel} 정산을 ${action} 처리하시겠습니까?\n금액: ${won(s.totalSupply)}`,
      confirmText: action,
    });
    if (!ok) return;

    setSaving(s.id);
    try {
      const res = await fetch("/api/admin/brand-settlements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settlementId: s.id, isPaid: !s.isPaid }),
      });
      const data = await res.json();
      if (!res.ok) {
        await appAlert({ message: data.error || "수정 실패", type: "warning" });
        return;
      }
      router.refresh();
    } catch {
      await appAlert({ message: "오류가 발생했습니다.", type: "warning" });
    } finally {
      setSaving(null);
    }
  };

  const handleSaveMemo = async (s: SettlementRecord, memo: string) => {
    setSaving(s.id);
    try {
      const res = await fetch("/api/admin/brand-settlements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settlementId: s.id, memo }),
      });
      if (!res.ok) {
        await appAlert({ message: "메모 저장 실패", type: "warning" });
      } else {
        await appAlert({ message: "메모가 저장되었습니다.", type: "success" });
        router.refresh();
      }
    } catch {
      await appAlert({ message: "오류가 발생했습니다.", type: "warning" });
    } finally {
      setSaving(null);
    }
  };

  const handleIssueInvoice = async (s: SettlementRecord, invoiceNumber: string) => {
    const ok = await appConfirm({
      title: "세금계산서 발급 처리",
      message: `[${s.periodLabel}] 세금계산서를 발급 처리하시겠습니까?${invoiceNumber ? `\n발급번호: ${invoiceNumber}` : ""}`,
      confirmText: "발급완료",
    });
    if (!ok) return;

    setSaving(s.id);
    try {
      const res = await fetch("/api/admin/brand-settlements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settlementId: s.id,
          action: "invoice_issue",
          invoiceNumber: invoiceNumber || undefined,
        }),
      });
      if (!res.ok) {
        await appAlert({ message: "처리 실패", type: "warning" });
      } else {
        await appAlert({ message: "세금계산서가 발급 처리되었습니다.", type: "success" });
        router.refresh();
      }
    } catch {
      await appAlert({ message: "오류가 발생했습니다.", type: "warning" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      <div className="mb-5">
        <h1 className="text-lg sm:text-xl font-bold text-gray-900">브랜드 정산 관리</h1>
        <p className="text-xs sm:text-sm text-gray-500">
          총 {brands.length}개 브랜드 · 영업일 기준 {summary.settleDays}일 후 정산
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
        <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-xl p-3 sm:p-4 text-white">
          <p className="text-orange-100 text-[9px] sm:text-[10px] font-medium mb-1">전체 지급예정</p>
          <p className="text-base sm:text-xl font-bold">{won(summary.totalPending)}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-3 sm:p-4 text-white">
          <p className="text-emerald-100 text-[9px] sm:text-[10px] font-medium mb-1">누적 지급완료</p>
          <p className="text-base sm:text-xl font-bold">{won(summary.totalPaid)}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-3 sm:p-4 text-white">
          <p className="text-blue-100 text-[9px] sm:text-[10px] font-medium mb-1">금일 정산완료</p>
          <p className="text-base sm:text-xl font-bold">{won(summary.todayPaid)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="브랜드명, 담당자, 중간관리자 검색..."
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

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
            <p className="text-sm">브랜드가 없습니다.</p>
          </div>
        ) : (
          pageItems.map((brand) => {
            const isExpanded = expandedId === brand.id;
            return (
              <div key={brand.id} className="bg-white rounded-xl border border-gray-100">
                <div className="p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0">
                      <Building2 size={18} className="text-brand-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-bold text-gray-900">{brand.brandName}</p>
                        {brand.middleAdminName && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 flex items-center gap-0.5">
                            <Icon name="Settings" size={10} /> {brand.middleAdminName}
                          </span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${brand.isApproved ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-500"}`}>
                          {brand.isApproved ? "승인" : "미승인"}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">{brand.userName} · {brand.userEmail}</p>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2">
                        <div className="bg-amber-50 rounded-lg p-2 text-center">
                          <p className="text-[11px] font-bold text-amber-700">{won(brand.availableAmount)}</p>
                          <p className="text-[9px] text-gray-400">정산확정 (미지급)</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-2 text-center">
                          <p className="text-[11px] font-bold text-blue-700">{won(brand.scheduledAmount)}</p>
                          <p className="text-[9px] text-gray-400">정산예정 (D+{summary.settleDays})</p>
                        </div>
                        <div className="bg-emerald-50 rounded-lg p-2 text-center">
                          <p className="text-[11px] font-bold text-emerald-700">{won(brand.todayPaidAmount)}</p>
                          <p className="text-[9px] text-gray-400">금일 정산완료</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2 text-center">
                          <p className="text-[11px] font-bold text-gray-700">{won(brand.cumulativePaidAmount)}</p>
                          <p className="text-[9px] text-gray-400">누적 정산완료</p>
                        </div>
                      </div>

                      {brand.bankName && (
                        <p className="text-[10px] text-gray-500 mt-1.5 flex items-center gap-1">
                          <Icon name="CreditCard" size={11} className="text-gray-400" />
                          {brand.bankName} {brand.accountNumber} ({brand.accountHolder})
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : brand.id)}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-1"
                    >
                      {isExpanded ? <Icon name="ChevronDown" size={16} className="rotate-180" /> : <Icon name="ChevronDown" size={16} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-3 sm:p-4">
                    <div className="bg-brand-50 rounded-xl p-3 mb-3">
                      <p className="text-xs font-bold text-brand-700 mb-2 flex items-center gap-1">
                        <Icon name="Plus" size={12} /> 새 정산 레코드 생성
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="month"
                          value={newPeriod[brand.id] || new Date().toISOString().slice(0, 7)}
                          onChange={(e) => setNewPeriod((prev) => ({ ...prev, [brand.id]: e.target.value }))}
                          className="input-field text-xs flex-1"
                        />
                        <button
                          onClick={() => handleCreateSettlement(brand)}
                          disabled={saving === brand.id}
                          className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
                        >
                          {saving === brand.id ? <Loader2 size={12} className="animate-spin" /> : <Icon name="Plus" size={12} />}
                          생성
                        </button>
                      </div>
                      <input
                        type="text"
                        value={newMemo[brand.id] || ""}
                        onChange={(e) => setNewMemo((prev) => ({ ...prev, [brand.id]: e.target.value }))}
                        placeholder="메모 (선택사항)"
                        className="input-field text-xs mt-1.5 w-full"
                      />
                    </div>

                    {brand.settlements.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">정산 레코드가 없습니다.</p>
                    ) : (
                      <div className="space-y-2">
                        {brand.settlements.map((s) => (
                          <SettlementRow
                            key={s.id}
                            settlement={s}
                            saving={saving === s.id}
                            onTogglePaid={() => handleTogglePaid(brand, s)}
                            onSaveMemo={(memo) => handleSaveMemo(s, memo)}
                            onIssueInvoice={(invoiceNumber) => handleIssueInvoice(s, invoiceNumber)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </>
  );
}

function SettlementRow({
  settlement: s,
  saving,
  onTogglePaid,
  onSaveMemo,
  onIssueInvoice,
}: {
  settlement: SettlementRecord;
  saving: boolean;
  onTogglePaid: () => void;
  onSaveMemo: (memo: string) => void;
  onIssueInvoice: (invoiceNumber: string) => void;
}) {
  const [editMemo, setEditMemo] = useState(s.memo || "");
  const [memoChanged, setMemoChanged] = useState(false);
  const [editInvoiceNumber, setEditInvoiceNumber] = useState(s.invoiceNumber || "");

  return (
    <div className={`rounded-lg border p-3 ${s.isPaid ? "border-emerald-100 bg-emerald-50/40" : "border-gray-100 bg-white"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-xs font-bold text-gray-800">{s.periodLabel}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${s.isPaid ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
              {s.isPaid ? "지급완료" : "미지급"}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${INVOICE_STYLE[s.invoiceStatus] ?? INVOICE_STYLE.NONE}`}>
              {INVOICE_LABEL[s.invoiceStatus] ?? "미요청"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mt-1">
            <div>
              <p className="text-[9px] text-gray-400">공급가 합계</p>
              <p className="text-xs font-bold text-gray-800">{won(s.totalSupply)}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400">판매금액</p>
              <p className="text-xs font-semibold text-gray-600">{won(s.totalSales)}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400">주문건수</p>
              <p className="text-xs font-semibold text-gray-600">{s.orderCount}건</p>
            </div>
          </div>
          {s.paidAt && (
            <p className="text-[10px] text-emerald-600 mt-1">
              지급일: {new Date(s.paidAt).toLocaleDateString("ko-KR")}
            </p>
          )}
          {s.invoiceStatus === "ISSUED" && s.invoiceNumber && (
            <p className="text-[10px] text-emerald-600 mt-0.5">계산서번호: {s.invoiceNumber}</p>
          )}
        </div>
        <button
          onClick={onTogglePaid}
          disabled={saving}
          className={`px-2 py-1 text-[11px] font-medium rounded-lg transition-colors flex-shrink-0 flex items-center gap-1 ${
            s.isPaid
              ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
              : "bg-emerald-500 text-white hover:bg-emerald-600"
          } disabled:opacity-60`}
        >
          {saving ? <Loader2 size={11} className="animate-spin" /> : null}
          {s.isPaid ? "지급취소" : "정산완료"}
        </button>
      </div>

      {/* 메모 */}
      <div className="mt-2 flex gap-1.5">
        <input
          type="text"
          value={editMemo}
          onChange={(e) => { setEditMemo(e.target.value); setMemoChanged(e.target.value !== (s.memo || "")); }}
          placeholder="메모 입력..."
          className="flex-1 text-[11px] px-2 py-1 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-300"
        />
        {memoChanged && (
          <button
            onClick={() => { onSaveMemo(editMemo); setMemoChanged(false); }}
            disabled={saving}
            className="px-2 py-1 bg-brand-500 text-white text-[11px] rounded-lg hover:bg-brand-600 disabled:opacity-60"
          >
            저장
          </button>
        )}
      </div>

      {/* 세금계산서 발급 (REQUESTED 상태일 때만) */}
      {s.invoiceStatus === "REQUESTED" && (
        <div className="mt-2 flex gap-1.5">
          <input
            type="text"
            value={editInvoiceNumber}
            onChange={(e) => setEditInvoiceNumber(e.target.value)}
            placeholder="세금계산서 번호 (선택)"
            className="flex-1 text-[11px] px-2 py-1 border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-300 bg-amber-50"
          />
          <button
            onClick={() => onIssueInvoice(editInvoiceNumber)}
            disabled={saving}
            className="px-2.5 py-1 bg-amber-500 text-white text-[11px] font-medium rounded-lg hover:bg-amber-600 disabled:opacity-60 flex items-center gap-1"
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : null}
            발급처리
          </button>
        </div>
      )}
    </div>
  );
}
