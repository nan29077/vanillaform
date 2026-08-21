"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { useRouter } from "next/navigation";
import {Loader2, Building2} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";

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

interface BrandPayout {
  brandId: string;
  brandName: string;
  payableAmount: number;
}

interface ManagerSettlement {
  id: string;
  periodLabel: string;
  totalAmount: number;
  status: string;
  memo: string | null;
  paidAt: string | null;
  createdAt: string;
}

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" });

const INVOICE_LABEL: Record<string, string> = {
  NONE: "미요청",
  REQUESTED: "발급 요청됨",
  ISSUED: "발급완료",
};
const INVOICE_STYLE: Record<string, string> = {
  NONE: "bg-gray-100 text-gray-400",
  REQUESTED: "bg-amber-50 text-amber-600",
  ISSUED: "bg-emerald-50 text-emerald-600",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "대기",
  CALCULATED: "산정완료",
  APPROVED: "승인",
  PAID: "지급완료",
  REJECTED: "반려",
};

export default function MiddleSettlementSection({
  settlements,
  brandPayouts,
  managerSettlements = [],
}: {
  settlements: SettlementRecord[];
  brandPayouts: BrandPayout[];
  managerSettlements?: ManagerSettlement[];
}) {
  const router = useRouter();
  const { appAlert, appConfirm } = useAppDialog();
  const [requesting, setRequesting] = useState<string | null>(null);

  const handleRequestInvoice = async (s: SettlementRecord) => {
    const ok = await appConfirm({
      title: "세금계산서 발급 요청",
      message: `${fmtDate(s.periodStart)} ~ ${fmtDate(s.periodEnd)} 세금계산서 발급을 요청하시겠습니까?\n정산액: ${won(s.settlementAmount)}`,
      confirmText: "발급 요청",
    });
    if (!ok) return;
    setRequesting(s.id);
    try {
      const res = await fetch("/api/middle/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settlementId: s.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        await appAlert({ message: data.error || "요청 실패", type: "warning" });
        return;
      }
      await appAlert({ message: data.message || "세금계산서 발급이 요청되었습니다.", type: "success" });
      router.refresh();
    } catch {
      await appAlert({ message: "오류가 발생했습니다.", type: "warning" });
    } finally {
      setRequesting(null);
    }
  };

  if (settlements.length === 0 && brandPayouts.length === 0 && managerSettlements.length === 0) return null;

  const totalPaid = settlements
    .filter((s) => s.status === "PAID")
    .reduce((acc, s) => acc + s.settlementAmount, 0);
  const totalBrandPayable = brandPayouts.reduce((acc, b) => acc + b.payableAmount, 0);

  return (
    <div className="space-y-6">
      {/* 직접 정산 수령 내역 */}
      {managerSettlements.length > 0 && (
        <div>
          <div className="mb-3">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Icon name="CreditCard" size={16} className="text-blue-600" />
              직접 정산 수령 내역
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              관리자로부터 직접 지급된 정산 내역입니다.
            </p>
          </div>
          <div className="space-y-2">
            {managerSettlements.map((ms) => (
              <div
                key={ms.id}
                className={`bg-white rounded-xl border p-3 sm:p-4 flex items-center justify-between gap-3 ${
                  ms.status === "PAID" ? "border-blue-100" : "border-gray-100"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${ms.status === "PAID" ? "bg-blue-50" : "bg-gray-50"}`}>
                    {ms.status === "PAID" ? (
                      <Icon name="Check" size={16} className="text-blue-500" />
                    ) : (
                      <Icon name="Clock" size={16} className="text-amber-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-gray-800">{ms.periodLabel}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ms.status === "PAID" ? "bg-blue-100 text-blue-700" : "bg-amber-50 text-amber-600"}`}>
                        {ms.status === "PAID" ? "지급완료" : "대기중"}
                      </span>
                    </div>
                    {ms.memo && <p className="text-[10px] text-gray-400 mt-0.5">{ms.memo}</p>}
                    {ms.paidAt && <p className="text-[10px] text-gray-400 mt-0.5">수령일 {fmtDate(ms.paidAt)}</p>}
                  </div>
                </div>
                <p className="text-[15px] font-bold text-blue-700 flex-shrink-0">{won(ms.totalAmount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 정산 레코드 (SUPER_ADMIN → 중간관리자) */}
      {settlements.length > 0 && (
        <div>
          <div className="mb-3">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Icon name="File" size={16} className="text-brand-600" />
              정산 수령 내역
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              최고관리자로부터 수령한 정산 내역입니다. 누적 수령: <strong className="text-emerald-600">{won(totalPaid)}</strong>
            </p>
          </div>
          <div className="space-y-2">
            {settlements.map((s) => (
              <div
                key={s.id}
                className={`bg-white rounded-xl border p-3 sm:p-4 ${
                  s.status === "PAID" ? "border-emerald-100" : "border-gray-100"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.status === "PAID" ? "bg-emerald-50" : "bg-gray-50"}`}>
                      {s.status === "PAID" ? (
                        <Icon name="Check" size={16} className="text-emerald-500" />
                      ) : (
                        <Icon name="Clock" size={16} className="text-amber-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className="text-sm font-bold text-gray-800">
                          {fmtDate(s.periodStart)} ~ {fmtDate(s.periodEnd)}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${s.status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-amber-50 text-amber-600"}`}>
                          {STATUS_LABEL[s.status] ?? s.status}
                        </span>
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${INVOICE_STYLE[s.invoiceStatus] ?? INVOICE_STYLE["NONE"]}`}>
                          <Icon name="Receipt" size={8} />
                          {INVOICE_LABEL[s.invoiceStatus] ?? "미요청"}
                        </span>
                        {s.invoiceNumber && (
                          <span className="text-[9px] text-gray-400">#{s.invoiceNumber}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 flex gap-3 flex-wrap">
                        <span>매출 {won(s.totalSales)}</span>
                        <span>마진 {won(s.marginAmount)}</span>
                        <span>정산 {won(s.settlementAmount)}</span>
                        {s.paidAt && <span>수령일 {fmtDate(s.paidAt)}</span>}
                      </div>
                      {s.invoiceRequestedAt && s.invoiceStatus === "REQUESTED" && (
                        <p className="text-[10px] text-amber-500 mt-0.5">
                          요청일: {fmtDate(s.invoiceRequestedAt)} · 관리자 처리 대기 중
                        </p>
                      )}
                      {s.invoiceIssuedAt && (
                        <p className="text-[10px] text-emerald-600 mt-0.5">
                          발급완료: {fmtDate(s.invoiceIssuedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                  {s.invoiceStatus === "NONE" && (
                    <button
                      onClick={() => handleRequestInvoice(s)}
                      disabled={requesting === s.id}
                      className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      {requesting === s.id ? <Loader2 size={12} className="animate-spin" /> : <Icon name="Receipt" size={12} />}
                      세금계산서 요청
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 하위 브랜드사 지급 현황 */}
      {brandPayouts.length > 0 && (
        <div>
          <div className="mb-3">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Building2 size={16} className="text-purple-600" />
              하위 브랜드사 지급 현황
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              소속 브랜드사에 지급해야 할 공급가 기준 금액입니다. 총 {won(totalBrandPayable)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-50">
              {brandPayouts.map((b) => (
                <div key={b.brandId} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <Building2 size={14} className="text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 truncate">{b.brandName}</p>
                    <p className="text-[10px] text-gray-400">공급가 기준 지급 예정액</p>
                  </div>
                  <p className="text-[13px] font-bold text-gray-900 flex-shrink-0">{won(b.payableAmount)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
