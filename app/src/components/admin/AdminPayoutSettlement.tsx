"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { useRouter } from "next/navigation";
import {Building2, Loader2, PiggyBank} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";
import Pagination, { usePagination } from "@/components/shared/Pagination";

const won = (n: number) => n.toLocaleString("ko-KR") + "원";

const STATUS: Record<string, { label: string; color: string }> = {
  REQUESTED: { label: "정산요청", color: "bg-indigo-50 text-indigo-600" },
  APPROVED: { label: "승인됨", color: "bg-blue-50 text-blue-600" },
  PAID: { label: "지급완료", color: "bg-emerald-50 text-emerald-700" },
  REJECTED: { label: "반려됨", color: "bg-red-50 text-red-600" },
};

interface Payout {
  id: string;
  sellerName: string;
  amount: number;
  netAmount: number;
  orderCount: number;
  status: string;
  isBusiness: boolean;
  bizNumber: string | null;
  companyName: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  requestedAt: string;
  note: string | null;
}

interface Props {
  totals: { totalSales: number; pendingTotal: number; availableTotal: number; requestedTotal: number; vanillaformRevenue: number; businessDays: number };
  payouts: Payout[];
}

export default function AdminPayoutSettlement({ totals, payouts }: Props) {
  const router = useRouter();
  const { appConfirm, appAlert, appPrompt } = useAppDialog();
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "REQUESTED" | "APPROVED" | "PAID" | "REJECTED">("all");

  const act = async (payoutId: string, action: "approve" | "pay" | "reject") => {
    const labels = { approve: "승인", pay: "지급완료 처리", reject: "반려" };
    let note: string | undefined;

    if (action === "reject") {
      // 반려는 사유를 필수로 받는다 — 입력한 사유가 셀러 정산 화면과 알림에 그대로 노출된다.
      const reason = await appPrompt({
        title: "출금요청 반려",
        message: "반려 사유를 입력해 주세요.\n입력한 사유는 셀러 정산 화면에 그대로 표시됩니다.",
        placeholder: "예) 등록된 계좌의 예금주가 일치하지 않습니다. 계좌 정보 수정 후 다시 신청해 주세요.",
        required: true,
        maxLength: 500,
        type: "warning",
        confirmText: "반려하기",
      });
      if (reason === null) return;
      note = reason;
    } else {
      const ok = await appConfirm(`이 출금요청을 ${labels[action]} 하시겠습니까?`);
      if (!ok) return;
    }

    setBusy(payoutId);
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoutId, action, note }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        await appAlert(d.error || "처리에 실패했습니다.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const list = filter === "all" ? payouts : payouts.filter((p) => p.status === filter);

  const { pageItems, page, setPage, totalPages } = usePagination(list, 20);

  return (
    <div className="animate-fade-in">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-gray-900">정산 관리</h1>
        <p className="text-xs text-gray-400 mt-0.5">라이브 셀러 출금요청 처리 (정산 주기: 결제완료 후 영업일 {totals.businessDays}일)</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <SummaryCard icon={<Icon name="Chart" size={16} className="text-gray-700" />} label="총 매출" value={won(totals.totalSales)} tone="bg-white" />
        <SummaryCard icon={<Icon name="Clock" size={16} className="text-orange-500" />} label={`정산 대기 (영업일 ${totals.businessDays}일 이전)`} value={won(totals.pendingTotal)} tone="bg-white" />
        <SummaryCard icon={<Icon name="Wallet" size={16} className="text-emerald-600" />} label="정산 가능액" value={won(totals.availableTotal)} tone="bg-white" />
        <SummaryCard icon={<Icon name="Share" size={16} className="text-indigo-600" />} label="정산 요청금액" value={won(totals.requestedTotal)} tone="bg-indigo-50" />
        <SummaryCard icon={<PiggyBank size={16} className="text-brand-600" />} label="바닐라폼 수익 (판매가 기준, PG 2.86% 제외)" value={won(totals.vanillaformRevenue)} tone="bg-brand-50" />
      </div>

      {/* 출금요청 리스트 */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
          <h2 className="text-sm font-bold text-gray-900">출금 신청 목록</h2>
          <div className="flex gap-1">
            {(["all", "REQUESTED", "APPROVED", "PAID", "REJECTED"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[11px] px-2 py-1 rounded-lg font-medium ${filter === f ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
              >
                {f === "all" ? "전체" : STATUS[f].label}
              </button>
            ))}
          </div>
        </div>

        {list.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <Icon name="Wallet" size={36} strokeWidth={1.5} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs">출금 신청 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {pageItems.map((p) => {
              const st = STATUS[p.status] || STATUS.REQUESTED;
              return (
                <div key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-900">{p.sellerName}</span>
                        <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                        <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${p.isBusiness ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"}`}>
                          {p.isBusiness ? <Building2 size={9} /> : <Icon name="MyPage" size={9} />}
                          {p.isBusiness ? "사업자" : "개인"}
                        </span>
                        <span className="text-[10px] text-gray-400">{new Date(p.requestedAt).toLocaleDateString("ko-KR")}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1.5">
                        {p.bankName || "-"} {p.accountNumber || ""} ({p.accountHolder || "-"}) · {p.orderCount}건
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {p.isBusiness
                          ? `상호 ${p.companyName || "-"} · 사업자번호 ${p.bizNumber || "-"} · 매입 세금계산서 발행 대상`
                          : `주민번호 ${p.bizNumber || "-"} · 원천징수 3.3% 적용`}
                      </p>
                      {p.note && <p className="text-[10px] text-red-500 mt-1">반려사유: {p.note}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-base font-extrabold text-gray-900">{won(p.netAmount)}</p>
                      <p className="text-[9px] text-gray-400">요청액 {won(p.amount)}</p>
                    </div>
                  </div>

                  {/* 처리 버튼 */}
                  {(p.status === "REQUESTED" || p.status === "APPROVED") && (
                    <div className="flex items-center gap-2 mt-3">
                      {p.status === "REQUESTED" && (
                        <button onClick={() => act(p.id, "approve")} disabled={busy === p.id}
                          className="flex-1 inline-flex items-center justify-center gap-1 text-[12px] font-bold py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50">
                          {busy === p.id ? <Loader2 size={13} className="animate-spin" /> : <Icon name="Check" size={13} />} 승인
                        </button>
                      )}
                      <button onClick={() => act(p.id, "pay")} disabled={busy === p.id}
                        className="flex-1 inline-flex items-center justify-center gap-1 text-[12px] font-bold py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50">
                        {busy === p.id ? <Loader2 size={13} className="animate-spin" /> : <Icon name="Wallet" size={13} />} 지급완료
                      </button>
                      <button onClick={() => act(p.id, "reject")} disabled={busy === p.id}
                        className="inline-flex items-center justify-center gap-1 text-[12px] font-bold py-2 px-3 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50">
                        <Icon name="Close" size={13} /> 반려
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className={`${tone} rounded-2xl border border-gray-100 p-4`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-[10px] text-gray-400 leading-tight">{label}</span>
      </div>
      <p className="text-lg font-extrabold text-gray-900">{value}</p>
    </div>
  );
}
