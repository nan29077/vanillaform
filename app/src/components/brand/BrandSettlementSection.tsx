"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { useRouter } from "next/navigation";
import {Loader2} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";

interface BrandSettlementRecord {
  id: string;
  periodLabel: string;
  totalSupply: number;
  totalSales: number;
  orderCount: number;
  isPaid: boolean;
  paidAt: string | null;
  invoiceStatus: string; // NONE | REQUESTED | ISSUED
  invoiceRequestedAt: string | null;
  invoiceIssuedAt: string | null;
  invoiceNumber: string | null;
  createdAt: string;
}

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

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

export default function BrandSettlementSection({
  settlements: initialSettlements,
}: {
  settlements: BrandSettlementRecord[];
}) {
  const router = useRouter();
  const { appAlert, appConfirm } = useAppDialog();
  const [requesting, setRequesting] = useState<string | null>(null);

  if (initialSettlements.length === 0) return null;

  // 요약
  const totalPaid = initialSettlements
    .filter((s) => s.isPaid)
    .reduce((acc, s) => acc + s.totalSupply, 0);
  const totalPending = initialSettlements
    .filter((s) => !s.isPaid)
    .reduce((acc, s) => acc + s.totalSupply, 0);

  const handleRequestInvoice = async (s: BrandSettlementRecord) => {
    const ok = await appConfirm({
      title: "세금계산서 발급 요청",
      message: `[${s.periodLabel}] 세금계산서 발급을 요청하시겠습니까?\n공급가: ${won(s.totalSupply)}`,
      confirmText: "발급 요청",
    });
    if (!ok) return;

    setRequesting(s.id);
    try {
      const res = await fetch("/api/brand/settlements", {
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

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Icon name="File" size={16} className="text-brand-600" />
          정산 레코드
        </h2>
        <div className="flex gap-4 mt-1 text-xs text-gray-500">
          <span>정산완료 <strong className="text-emerald-600">{won(totalPaid)}</strong></span>
          <span>미지급 <strong className="text-orange-500">{won(totalPending)}</strong></span>
        </div>
      </div>

      <div className="space-y-2">
        {initialSettlements.map((s) => (
          <div
            key={s.id}
            className={`bg-white rounded-xl border p-3 sm:p-4 ${
              s.isPaid ? "border-emerald-100" : "border-gray-100"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.isPaid ? "bg-emerald-50" : "bg-gray-50"}`}>
                  {s.isPaid ? (
                    <Icon name="Check" size={16} className="text-emerald-500" />
                  ) : (
                    <Icon name="Clock" size={16} className="text-amber-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className="text-sm font-bold text-gray-800">{s.periodLabel}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${s.isPaid ? "bg-emerald-100 text-emerald-700" : "bg-orange-50 text-orange-600"}`}>
                      {s.isPaid ? "정산완료" : "미지급"}
                    </span>
                    {/* 세금계산서 상태 */}
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${INVOICE_STYLE[s.invoiceStatus] ?? INVOICE_STYLE["NONE"]}`}>
                      <Icon name="Receipt" size={8} />
                      {INVOICE_LABEL[s.invoiceStatus] ?? "미요청"}
                    </span>
                    {s.invoiceNumber && (
                      <span className="text-[9px] text-gray-400">#{s.invoiceNumber}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 flex gap-3 flex-wrap">
                    <span>공급가 {won(s.totalSupply)}</span>
                    <span>{s.orderCount}건</span>
                    {s.paidAt && (
                      <span>지급일 {new Date(s.paidAt).toLocaleDateString("ko-KR")}</span>
                    )}
                  </div>
                  {s.invoiceRequestedAt && s.invoiceStatus === "REQUESTED" && (
                    <p className="text-[10px] text-amber-500 mt-0.5">
                      요청일: {new Date(s.invoiceRequestedAt).toLocaleDateString("ko-KR")} · 관리자 처리 대기 중
                    </p>
                  )}
                  {s.invoiceIssuedAt && (
                    <p className="text-[10px] text-emerald-600 mt-0.5">
                      발급완료: {new Date(s.invoiceIssuedAt).toLocaleDateString("ko-KR")}
                    </p>
                  )}
                </div>
              </div>

              {/* 세금계산서 발급 요청 버튼 (NONE 상태에서만) */}
              {s.invoiceStatus === "NONE" && (
                <button
                  onClick={() => handleRequestInvoice(s)}
                  disabled={requesting === s.id}
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {requesting === s.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Icon name="Receipt" size={12} />
                  )}
                  세금계산서 요청
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
