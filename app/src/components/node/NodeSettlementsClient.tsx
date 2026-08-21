"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import {CreditCard, Building2, CheckCircle2} from 'lucide-react';
import Pagination, { usePagination } from "@/components/shared/Pagination";

interface NodeSettlement {
  id: string;
  periodLabel: string;
  totalAmount: number;
  status: string;
  memo: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface MiddleAdminItem {
  id: string;
  name: string;
  userEmail: string;
  commissionRate: number;
  recentSettlements: {
    id: string;
    periodLabel: string;
    settlementAmount: number;
    status: string;
    createdAt: string;
  }[];
}

interface DirectBrandItem {
  id: string;
  brandName: string;
  userEmail: string;
  recentSettlements: {
    id: string;
    periodLabel: string;
    isPaid: boolean;
    totalSales: number;
    createdAt: string;
  }[];
}

function StatusBadge({ status }: { status: string }) {
  if (status === "PAID") return <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-600">지급완료</span>;
  if (status === "CONFIRMED") return <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">승인됨</span>;
  return <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-yellow-50 text-yellow-600">대기중</span>;
}

export default function NodeSettlementsClient({
  settlements,
  middleAdmins,
  directBrands,
  totalReceived,
  totalPending,
}: {
  settlements: NodeSettlement[];
  middleAdmins: MiddleAdminItem[];
  directBrands: DirectBrandItem[];
  totalReceived: number;
  totalPending: number;
}) {
  const [tab, setTab] = useState<"received" | "subMembers">("received");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    pageItems: settlementItems,
    page: settlementPage,
    setPage: setSettlementPage,
    totalPages: settlementTotalPages,
  } = usePagination(settlements, 20);
  const {
    pageItems: middleAdminItems,
    page: middleAdminPage,
    setPage: setMiddleAdminPage,
    totalPages: middleAdminTotalPages,
  } = usePagination(middleAdmins, 20);
  const {
    pageItems: directBrandItems,
    page: directBrandPage,
    setPage: setDirectBrandPage,
    totalPages: directBrandTotalPages,
  } = usePagination(directBrands, 20);

  const TABS = [
    { key: "received" as const, label: "수령 정산 내역", icon: CreditCard },
    { key: "subMembers" as const, label: "하위 회원 정산 현황", icon: Building2 },
  ];

  return (
    <>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">정산 관리</h1>
        <p className="text-sm text-gray-500 mt-0.5">관리자로부터 받은 정산과 하위 회원 정산 현황을 확인합니다</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50">
              <Icon name="Chart" size={16} strokeWidth={1.75} className="text-emerald-600" />
            </span>
            <p className="text-sm font-semibold text-gray-700">총 수령액</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{totalReceived.toLocaleString()}원</p>
          <p className="text-[10px] text-gray-400 mt-1">지급완료 정산 합계</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50">
              <Icon name="Clock" size={16} strokeWidth={1.75} className="text-amber-600" />
            </span>
            <p className="text-sm font-semibold text-gray-700">정산 대기액</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{totalPending.toLocaleString()}원</p>
          <p className="text-[10px] text-gray-400 mt-1">대기중 정산 합계</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-teal-50">
              <Icon name="Wallet" size={16} strokeWidth={1.75} className="text-teal-600" />
            </span>
            <p className="text-sm font-semibold text-gray-700">정산 건수</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{settlements.length}건</p>
          <p className="text-[10px] text-gray-400 mt-1">전체 정산 내역</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-5">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); setExpandedId(null); }}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
                active ? "border-teal-500 text-teal-700" : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon size={14} strokeWidth={active ? 2 : 1.75} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 수령 정산 내역 */}
      {tab === "received" && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {settlements.length === 0 ? (
            <div className="text-center py-16">
              <Icon name="CreditCard" size={36} strokeWidth={1.5} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm text-gray-400">수령한 정산 내역이 없습니다</p>
              <p className="text-xs text-gray-300 mt-1">관리자가 정산을 발송하면 여기에 표시됩니다</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {settlementItems.map((s) => (
                <div key={s.id}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                    onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-semibold text-gray-800">{s.periodLabel}</p>
                        <StatusBadge status={s.status} />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {new Date(s.createdAt).toLocaleDateString("ko-KR")} 발송
                        {s.paidAt && ` · ${new Date(s.paidAt).toLocaleDateString("ko-KR")} 지급`}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 flex items-center gap-2">
                      <p className="text-[15px] font-bold text-gray-900">{s.totalAmount.toLocaleString()}원</p>
                      {expandedId === s.id ? <Icon name="ChevronDown" size={14} className="text-gray-400 rotate-180" /> : <Icon name="ChevronDown" size={14} className="text-gray-400" />}
                    </div>
                  </button>
                  {expandedId === s.id && s.memo && (
                    <div className="px-5 pb-4 bg-gray-50 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mt-3">
                        <span className="font-medium text-gray-600">메모:</span> {s.memo}
                      </p>
                    </div>
                  )}
                </div>
              ))}
              <Pagination currentPage={settlementPage} totalPages={settlementTotalPages} onPageChange={setSettlementPage} />
            </div>
          )}
        </div>
      )}

      {/* 하위 회원 정산 현황 */}
      {tab === "subMembers" && (
        <div className="space-y-4">
          {/* 중간관리자 */}
          {middleAdmins.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <Icon name="Settings" size={15} className="text-amber-500" />
                담당 중간관리자 ({middleAdmins.length})
              </h2>
              <div className="space-y-2">
                {middleAdminItems.map((m) => (
                  <div key={m.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
                      onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <Icon name="Settings" size={15} className="text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-800">{m.name}</p>
                        <p className="text-[10px] text-gray-400">{m.userEmail} · 커미션 {m.commissionRate}%</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[11px] text-gray-500">{m.recentSettlements.length}건</span>
                        {expandedId === m.id ? <Icon name="ChevronDown" size={14} className="text-gray-400 rotate-180" /> : <Icon name="ChevronDown" size={14} className="text-gray-400" />}
                      </div>
                    </button>
                    {expandedId === m.id && (
                      <div className="border-t border-gray-100 bg-gray-50 p-3">
                        {m.recentSettlements.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-3">정산 내역 없음</p>
                        ) : (
                          <div className="space-y-2">
                            {m.recentSettlements.map((s) => (
                              <div key={s.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                                <div>
                                  <p className="text-xs font-medium text-gray-700">{s.periodLabel}</p>
                                  <p className="text-[10px] text-gray-400">{new Date(s.createdAt).toLocaleDateString("ko-KR")}</p>
                                </div>
                                <div className="text-right flex items-center gap-2">
                                  <p className="text-xs font-semibold text-gray-800">{s.settlementAmount.toLocaleString()}원</p>
                                  <StatusBadge status={s.status} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <Pagination currentPage={middleAdminPage} totalPages={middleAdminTotalPages} onPageChange={setMiddleAdminPage} />
              </div>
            </div>
          )}

          {/* 직접 배정 브랜드 */}
          {directBrands.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <Building2 size={15} className="text-purple-500" />
                직접 배정 브랜드 ({directBrands.length})
              </h2>
              <div className="space-y-2">
                {directBrandItems.map((b) => (
                  <div key={b.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
                      onClick={() => setExpandedId(expandedId === ("b-" + b.id) ? null : ("b-" + b.id))}
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <Building2 size={15} className="text-purple-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-800">{b.brandName}</p>
                        <p className="text-[10px] text-gray-400">{b.userEmail}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[11px] text-gray-500">{b.recentSettlements.length}건</span>
                        {expandedId === ("b-" + b.id) ? <Icon name="ChevronDown" size={14} className="text-gray-400 rotate-180" /> : <Icon name="ChevronDown" size={14} className="text-gray-400" />}
                      </div>
                    </button>
                    {expandedId === ("b-" + b.id) && (
                      <div className="border-t border-gray-100 bg-gray-50 p-3">
                        {b.recentSettlements.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-3">정산 내역 없음</p>
                        ) : (
                          <div className="space-y-2">
                            {b.recentSettlements.map((s) => (
                              <div key={s.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                                <div>
                                  <p className="text-xs font-medium text-gray-700">{s.periodLabel}</p>
                                  <p className="text-[10px] text-gray-400">{new Date(s.createdAt).toLocaleDateString("ko-KR")}</p>
                                </div>
                                <div className="text-right flex items-center gap-2">
                                  <p className="text-xs font-semibold text-gray-800">{s.totalSales.toLocaleString()}원</p>
                                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${s.isPaid ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>
                                    {s.isPaid ? "지급완료" : "대기중"}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <Pagination currentPage={directBrandPage} totalPages={directBrandTotalPages} onPageChange={setDirectBrandPage} />
              </div>
            </div>
          )}

          {middleAdmins.length === 0 && directBrands.length === 0 && (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
              <Icon name="Warning" size={36} strokeWidth={1.5} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm text-gray-400">담당 중간관리자 및 브랜드가 없습니다</p>
              <p className="text-xs text-gray-300 mt-1">회원 관리 메뉴에서 중간관리자를 초대하세요</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
