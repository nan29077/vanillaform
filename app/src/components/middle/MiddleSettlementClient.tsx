"use client";

import { Icon } from '@/components/shared/Icon';
import { useMemo, useState } from "react";
import {Crown} from 'lucide-react';

type Commission = {
  id: string;
  source: "brand" | "seller";
  sourceName: string;
  orderNumber: string;
  orderAmount: number;
  marginAmount: number;
  status: string; // PENDING | CONFIRMED | PAID | CANCELLED
  createdAt: string;
};

type Settlement = {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalSales: number;
  marginAmount: number;
  settlementAmount: number;
  status: string; // PENDING | CALCULATED | APPROVED | PAID | REJECTED
  paidAt: string | null;
  createdAt: string;
};

const COMMISSION_STATUS_LABEL: Record<string, string> = {
  PENDING: "정산 대기",
  CONFIRMED: "정산 확정",
  PAID: "지급 완료",
  CANCELLED: "취소",
};

const COMMISSION_STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-600",
  CONFIRMED: "bg-blue-50 text-blue-600",
  PAID: "bg-emerald-50 text-emerald-600",
  CANCELLED: "bg-gray-100 text-gray-400",
};

const SETTLEMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "대기",
  CALCULATED: "산정 완료",
  APPROVED: "승인",
  PAID: "지급 완료",
  REJECTED: "반려",
};

const SETTLEMENT_STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-600",
  CALCULATED: "bg-blue-50 text-blue-600",
  APPROVED: "bg-indigo-50 text-indigo-600",
  PAID: "bg-emerald-50 text-emerald-600",
  REJECTED: "bg-rose-50 text-rose-600",
};

function won(n: number) {
  return `${n.toLocaleString()}원`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function MiddleSettlementClient({
  commissions,
  settlements,
}: {
  commissions: Commission[];
  settlements: Settlement[];
}) {
  const [tab, setTab] = useState<"commissions" | "settlements">("commissions");

  // 상태별 합계
  const summary = useMemo(() => {
    let pending = 0; // 미지급(PENDING + CONFIRMED)
    let paid = 0;
    let total = 0;
    for (const c of commissions) {
      if (c.status === "CANCELLED") continue;
      total += c.marginAmount;
      if (c.status === "PAID") paid += c.marginAmount;
      else pending += c.marginAmount;
    }
    return { pending, paid, total };
  }, [commissions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-gray-900">정산 관리</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          브랜드·라이브 셀러 마진 적립 및 지급 내역을 확인합니다.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-3 sm:p-4 text-white">
          <p className="text-amber-100 text-[9px] sm:text-[10px] font-medium mb-1">미지급 마진</p>
          <p className="text-lg sm:text-2xl font-bold">{won(summary.pending)}</p>
          <p className="text-amber-200 text-[9px] sm:text-[10px] mt-1">지급 대기 중</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-3 sm:p-4 text-white">
          <p className="text-emerald-100 text-[9px] sm:text-[10px] font-medium mb-1">지급 완료</p>
          <p className="text-lg sm:text-2xl font-bold">{won(summary.paid)}</p>
          <p className="text-emerald-200 text-[9px] sm:text-[10px] mt-1">누적 지급액</p>
        </div>
        <div className="bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl p-3 sm:p-4 text-white">
          <p className="text-gray-300 text-[9px] sm:text-[10px] font-medium mb-1">누적 마진</p>
          <p className="text-lg sm:text-2xl font-bold">{won(summary.total)}</p>
          <p className="text-gray-400 text-[9px] sm:text-[10px] mt-1">취소 제외 전체</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-100">
        <button
          onClick={() => setTab("commissions")}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            tab === "commissions"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          마진 적립 내역 ({commissions.length})
        </button>
        <button
          onClick={() => setTab("settlements")}
          className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
            tab === "settlements"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          정산 내역 ({settlements.length})
        </button>
      </div>

      {/* 마진 적립 내역 */}
      {tab === "commissions" && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {commissions.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {commissions.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 px-4 sm:px-5 py-3"
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      c.source === "brand" ? "bg-purple-50" : "bg-blue-50"
                    }`}
                  >
                    {c.source === "brand" ? (
                      <Crown size={16} className="text-purple-400" />
                    ) : (
                      <Icon name="Store" size={16} className="text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13px] font-medium text-gray-800 truncate">
                        {c.sourceName}
                      </p>
                      <span className="text-[9px] text-gray-400 flex-shrink-0">
                        {c.source === "brand" ? "브랜드 마진" : "라이브 셀러 마진"}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate">
                      {c.orderNumber} · {formatDate(c.createdAt)} · 매출 {won(c.orderAmount)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[13px] font-bold text-gray-900">
                      {won(c.marginAmount)}
                    </p>
                    <span
                      className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium ${
                        COMMISSION_STATUS_STYLE[c.status] || "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {COMMISSION_STATUS_LABEL[c.status] || c.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Icon name="Wallet" size={28} className="mx-auto text-gray-200 mb-2" />
              <p className="text-xs text-gray-400">아직 적립된 마진이 없습니다.</p>
            </div>
          )}
        </div>
      )}

      {/* 정산 내역 */}
      {tab === "settlements" && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {settlements.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {settlements.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    {s.status === "PAID" ? (
                      <Icon name="Check" size={16} className="text-emerald-400" />
                    ) : s.status === "REJECTED" ? (
                      <Icon name="Close" size={16} className="text-rose-400" />
                    ) : (
                      <Icon name="Clock" size={16} className="text-amber-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 truncate">
                      {formatDate(s.periodStart)} ~ {formatDate(s.periodEnd)}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">
                      매출 {won(s.totalSales)}
                      {s.paidAt ? ` · 지급 ${formatDate(s.paidAt)}` : ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[13px] font-bold text-gray-900">
                      {won(s.settlementAmount)}
                    </p>
                    <span
                      className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium ${
                        SETTLEMENT_STATUS_STYLE[s.status] || "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {SETTLEMENT_STATUS_LABEL[s.status] || s.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Icon name="Receipt" size={28} className="mx-auto text-gray-200 mb-2" />
              <p className="text-xs text-gray-400">아직 정산 내역이 없습니다.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
