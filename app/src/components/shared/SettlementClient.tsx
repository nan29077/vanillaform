"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useMemo } from "react";
import {DollarSign, Clock, CheckCircle, XCircle, FileText, X, Filter, ArrowUpDown, Building2, Banknote, ShoppingBag, Radio, Package, Send, Download, ChevronDown, ChevronUp, Square, Loader2} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";

type SettlementType = "all" | "groupbuy" | "normal" | "live";

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: "대기", color: "bg-gray-100 text-gray-600", icon: Clock },
  CALCULATED: { label: "산정완료", color: "bg-blue-50 text-blue-600", icon: FileText },
  REQUESTED: { label: "정산요청", color: "bg-indigo-50 text-indigo-600", icon: Send },
  APPROVED: { label: "승인", color: "bg-green-50 text-green-600", icon: CheckCircle },
  PAID: { label: "지급완료", color: "bg-emerald-50 text-emerald-700", icon: DollarSign },
  REJECTED: { label: "거절", color: "bg-red-50 text-red-600", icon: XCircle },
};

interface Settlement {
  id: string;
  sellerName: string;
  sellerId?: string;
  brandName?: string | null;
  campaignTitle?: string | null;
  type: string; // "groupbuy" | "normal" | "live"
  totalSales: number;
  commissionRate: number;
  commissionAmount: number;
  settlementAmount: number;
  withholdingTax: number;
  netAmount: number;
  status: string;
  isBusiness: boolean;
  businessNumber?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  paidAt?: string | null;
  taxInvoiceIssued?: boolean;
}

interface Props {
  settlements: Settlement[];
  role: "SUPER_ADMIN" | "SELLER" | "BRAND_ADMIN";
  commissionRate?: number;
}

const formatPrice = (n: number) => n.toLocaleString("ko-KR") + "원";

const TYPE_LABELS: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  groupbuy: { label: "공동구매", icon: ShoppingBag, color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-100" },
  normal: { label: "일반상품", icon: Package, color: "text-gray-600", bgColor: "bg-gray-50 border-gray-200" },
  live: { label: "라이브커머스", icon: Radio, color: "text-pink-600", bgColor: "bg-pink-50 border-pink-100" },
};

export default function SettlementClient({ settlements, role, commissionRate = 10 }: Props) {
  const { appConfirm, appAlert } = useAppDialog();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [showRequestModal, setShowRequestModal] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);

  // Request form states
  const [reqIsBusiness, setReqIsBusiness] = useState(true);
  const [reqBizNumber, setReqBizNumber] = useState("");
  const [reqBankName, setReqBankName] = useState("");
  const [reqAccountNumber, setReqAccountNumber] = useState("");
  const [reqAccountHolder, setReqAccountHolder] = useState("");
  const [reqAgreedDisclaimer, setReqAgreedDisclaimer] = useState(false);

  const filtered = useMemo(() => {
    let result = settlements;
    if (showPendingOnly) {
      result = result.filter(s => ["PENDING", "CALCULATED", "REQUESTED"].includes(s.status));
    }
    if (statusFilter !== "all") result = result.filter(s => s.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.sellerName.toLowerCase().includes(q) ||
        (s.campaignTitle && s.campaignTitle.toLowerCase().includes(q)) ||
        (s.brandName && s.brandName.toLowerCase().includes(q))
      );
    }
    return result;
  }, [settlements, statusFilter, searchQuery, showPendingOnly]);

  // Pending aggregation counts
  const pendingStats = useMemo(() => {
    const pending = settlements.filter(s => ["PENDING", "CALCULATED", "REQUESTED"].includes(s.status));
    const requested = settlements.filter(s => s.status === "REQUESTED");
    return {
      pendingCount: pending.length,
      pendingAmount: pending.reduce((sum, s) => sum + s.settlementAmount, 0),
      requestedCount: requested.length,
      requestedAmount: requested.reduce((sum, s) => sum + s.settlementAmount, 0),
    };
  }, [settlements]);

  // Approvable items (REQUESTED status only for admin)
  const approvableItems = useMemo(() => {
    if (role !== "SUPER_ADMIN") return [];
    return filtered.filter(s => s.status === "REQUESTED");
  }, [filtered, role]);

  const toggleSelectSettlement = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const toggleSelectAllApprovable = () => {
    const ids = approvableItems.map(s => s.id);
    const allSelected = ids.every(id => selectedIds.has(id));
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(ids));
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) { appAlert("승인할 정산을 선택하세요."); return; }
    if (!await appConfirm(`${selectedIds.size}건의 정산을 일괄 승인하시겠습니까?`)) return;
    setBulkApproving(true);
    await new Promise(r => setTimeout(r, 1000));
    await appAlert({ message: `${selectedIds.size}건의 정산이 승인되었습니다.`, type: "success" });
    setSelectedIds(new Set());
    setBulkApproving(false);
  };

  // 카테고리별 정산 가능 금액 계산
  const categoryTotals = useMemo(() => {
    const settleable = ["PENDING", "CALCULATED", "REQUESTED", "APPROVED"];
    const types = ["groupbuy", "normal", "live"];
    const result: Record<string, { total: number; count: number; items: Settlement[] }> = {};
    let grandTotal = 0;

    for (const type of types) {
      const items = settlements.filter(s => s.type === type && settleable.includes(s.status));
      const total = items.reduce((sum, s) => sum + s.settlementAmount, 0);
      result[type] = { total, count: items.length, items };
      grandTotal += total;
    }

    return { byType: result, grandTotal };
  }, [settlements]);

  const totals = useMemo(() => {
    const paid = filtered.filter(s => s.status === "PAID").reduce((sum, s) => sum + s.netAmount, 0);
    const pending = filtered.filter(s => ["PENDING", "CALCULATED", "REQUESTED", "APPROVED"].includes(s.status)).reduce((sum, s) => sum + s.settlementAmount, 0);
    const totalSales = filtered.reduce((sum, s) => sum + s.totalSales, 0);
    return { paid, pending, totalSales };
  }, [filtered]);

  const detailItem = showDetail ? filtered.find(s => s.id === showDetail) : null;
  const requestItem = showRequestModal ? settlements.find(s => s.id === showRequestModal) : null;

  const getTypeBadge = (type: string) => {
    const t = TYPE_LABELS[type] || TYPE_LABELS.normal;
    return <span className={`text-[9px] font-bold ${t.bgColor} ${t.color} px-1.5 py-0.5 rounded-full border`}>{t.label}</span>;
  };

  const handleRequestSettlement = () => {
    appAlert({ message: "정산 요청이 접수되었습니다.\n관리자 승인 후 정산이 진행됩니다.", type: "success" });
    setShowRequestModal(null);
    setReqAgreedDisclaimer(false);
  };

  const handleApprove = (id: string) => {
    appAlert({ message: "정산이 승인되었습니다.", type: "success" });
    setShowApproveModal(null);
  };

  const toggleExpanded = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 카테고리별로 정산 그룹핑
  const groupedByType = useMemo(() => {
    const types = ["groupbuy", "normal", "live"] as const;
    return types.map(type => ({
      type,
      ...TYPE_LABELS[type],
      settlements: filtered.filter(s => s.type === type),
    })).filter(g => g.settlements.length > 0);
  }, [filtered]);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
            <Icon name="Wallet" size={20} className="text-brand-600" /> 정산 관리
          </h1>
          {role === "SELLER" && <p className="text-xs text-gray-500 mt-0.5">수수료율 {commissionRate}%</p>}
        </div>
      </div>

      {/* ★ 전체 정산 가능 금액 총괄 카드 */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 rounded-2xl p-5 text-white mb-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="Wallet" size={16} className="opacity-80" />
            <span className="text-sm font-medium opacity-80">정산 가능 총액</span>
          </div>
          <p className="text-3xl font-extrabold mt-1">
            {formatPrice(categoryTotals.grandTotal)}
          </p>
          {/* 카테고리별 내역 */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {(["groupbuy", "normal", "live"] as const).map(type => {
              const t = TYPE_LABELS[type];
              const data = categoryTotals.byType[type];
              return (
                <div key={type} className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <t.icon size={12} className="opacity-70" />
                    <span className="text-[10px] font-medium opacity-70">{t.label}</span>
                  </div>
                  <p className="text-sm font-bold">{formatPrice(data.total)}</p>
                  <p className="text-[10px] opacity-50 mt-0.5">{data.count}건</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 p-3.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Icon name="Chart" size={13} className="text-gray-400" />
            <span className="text-[10px] text-gray-400">총 매출</span>
          </div>
          <p className="text-base font-bold text-gray-900">{formatPrice(totals.totalSales)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Icon name="Check" size={13} className="text-green-500" />
            <span className="text-[10px] text-gray-400">정산 완료</span>
          </div>
          <p className="text-base font-bold text-green-600">{formatPrice(totals.paid)}</p>
        </div>
        <div className="bg-white rounded-xl border border-orange-100 p-3.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Icon name="Clock" size={13} className="text-orange-500" />
            <span className="text-[10px] text-gray-400">정산 대기</span>
          </div>
          <p className="text-base font-bold text-orange-600">{formatPrice(totals.pending)}</p>
        </div>
      </div>

      {/* ★ 승인 대기 집계 카드 (Admin/Brand) */}
      {pendingStats.pendingCount > 0 && (
        <div className="mb-4 bg-amber-50 rounded-xl border border-amber-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Icon name="Warning" size={16} className="text-amber-500" />
              <span className="text-sm font-bold text-amber-800">승인 대기 현황</span>
            </div>
            <button
              onClick={() => setShowPendingOnly(!showPendingOnly)}
              className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-colors ${
                showPendingOnly ? "bg-amber-600 text-white" : "bg-white text-amber-700 border border-amber-200 hover:bg-amber-100"
              }`}
            >
              {showPendingOnly ? "전체 보기" : "대기중만 보기"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-lg p-3">
              <p className="text-[10px] text-gray-500 mb-0.5">총 대기 ({pendingStats.pendingCount}건)</p>
              <p className="text-sm font-bold text-amber-700">{formatPrice(pendingStats.pendingAmount)}</p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <p className="text-[10px] text-gray-500 mb-0.5">정산요청 ({pendingStats.requestedCount}건)</p>
              <p className="text-sm font-bold text-indigo-600">{formatPrice(pendingStats.requestedAmount)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ★ 일괄 승인 패널 (Admin only) */}
      {role === "SUPER_ADMIN" && approvableItems.length > 0 && (
        <div className="mb-4 bg-green-50 rounded-xl border border-green-100 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={toggleSelectAllApprovable} className="flex-shrink-0">
                {approvableItems.every(s => selectedIds.has(s.id)) ? <Icon name="Check" size={18} className="text-green-600" /> : <Square size={18} className="text-gray-400" />}
              </button>
              <span className="text-sm font-bold text-green-800">
                정산 요청 {approvableItems.length}건
                {selectedIds.size > 0 && <span className="text-green-600 ml-1">({selectedIds.size}건 선택)</span>}
              </span>
            </div>
            <button
              onClick={handleBulkApprove}
              disabled={selectedIds.size === 0 || bulkApproving}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 disabled:opacity-40 transition-colors"
            >
              {bulkApproving ? <Loader2 size={14} className="animate-spin" /> : <Icon name="Check" size={14} />}
              {bulkApproving ? "승인 중..." : `${selectedIds.size > 0 ? selectedIds.size + "건 " : ""}일괄 승인`}
            </button>
          </div>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="라이브 셀러명, 캠페인명, 브랜드명 검색..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-200 bg-white"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
        <select
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          <option value="all">전체 상태</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* ★ 카테고리별 정산 카드 목록 */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Icon name="CreditCard" size={48} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">정산 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByType.map(group => {
            const groupSettleable = group.settlements.filter(s => ["PENDING", "CALCULATED", "REQUESTED", "APPROVED"].includes(s.status));
            const groupTotal = groupSettleable.reduce((sum, s) => sum + s.settlementAmount, 0);
            return (
              <div key={group.type}>
                {/* 카테고리 헤더 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <group.icon size={16} className={group.color} />
                    <h2 className="text-sm font-bold text-gray-900">{group.label}</h2>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{group.settlements.length}건</span>
                  </div>
                  {groupTotal > 0 && (
                    <span className="text-xs font-bold text-brand-600">
                      정산 가능 {formatPrice(groupTotal)}
                    </span>
                  )}
                </div>

                {/* 정산 카드 목록 */}
                <div className="space-y-2.5">
                  {group.settlements.map(s => {
                    const st = STATUS_MAP[s.status] || { label: s.status, color: "bg-gray-100 text-gray-600", icon: Clock };
                    const isExpanded = expandedCards.has(s.id);
                    const canRequest = (role === "SELLER" || role === "BRAND_ADMIN") && (s.status === "CALCULATED" || s.status === "PENDING");
                    const canApprove = role === "SUPER_ADMIN" && s.status === "REQUESTED";
                    const isSelectedForBulk = selectedIds.has(s.id);

                    return (
                      <div key={s.id} className={`bg-white rounded-xl border overflow-hidden hover:shadow-sm transition-shadow ${isSelectedForBulk ? "border-green-300 ring-1 ring-green-200" : "border-gray-100"}`}>
                        {/* 카드 메인 영역 */}
                        <div className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            {/* Bulk select checkbox for approvable items */}
                            {canApprove && (
                              <button onClick={() => toggleSelectSettlement(s.id)} className="flex-shrink-0 mr-2 mt-1">
                                {isSelectedForBulk ? <Icon name="Check" size={16} className="text-green-600" /> : <Square size={16} className="text-gray-300" />}
                              </button>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <p className="text-sm font-bold text-gray-900 truncate">{s.campaignTitle || "일반 판매 정산"}</p>
                                <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                              </div>
                              <div className="text-[10px] text-gray-400 flex items-center gap-2">
                                {role !== "SELLER" && <span className="text-brand-500 font-medium">{s.sellerName}</span>}
                                {s.brandName && <span className="text-purple-500">{s.brandName}</span>}
                                <span>{new Date(s.periodStart).toLocaleDateString("ko-KR")} ~ {new Date(s.periodEnd).toLocaleDateString("ko-KR")}</span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-3">
                              <p className="text-base font-bold text-brand-600">{formatPrice(s.netAmount)}</p>
                              <p className="text-[9px] text-gray-400">실수령액</p>
                            </div>
                          </div>

                          {/* 간단 요약 바 */}
                          <div className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg text-[11px] text-gray-500 mb-3">
                            <span>매출 <b className="text-gray-700">{formatPrice(s.totalSales)}</b></span>
                            <span className="text-gray-200">|</span>
                            <span>수수료 <b className="text-red-500">-{formatPrice(s.commissionAmount)}</b></span>
                            <span className="text-gray-200">|</span>
                            <span>정산액 <b className="text-gray-700">{formatPrice(s.settlementAmount)}</b></span>
                          </div>

                          {/* ★ 카드 내부 액션 버튼 */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setShowDetail(s.id)}
                              className="text-[11px] px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 flex items-center gap-1 font-medium"
                            >
                              <Icon name="Eye" size={12} /> 상세
                            </button>
                            {/* ★ 정산 요청 버튼 - 카드 내부에 표시 */}
                            {canRequest && (
                              <button
                                onClick={() => setShowRequestModal(s.id)}
                                className="text-[11px] px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-1 font-medium"
                              >
                                <Icon name="Share" size={12} /> 정산 요청
                              </button>
                            )}
                            {/* Admin 승인 버튼 */}
                            {canApprove && (
                              <button
                                onClick={() => setShowApproveModal(s.id)}
                                className="text-[11px] px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1 font-medium"
                              >
                                <Icon name="Check" size={12} /> 승인
                              </button>
                            )}
                            {s.status === "PAID" && s.isBusiness && s.taxInvoiceIssued && (
                              <span className="text-[10px] text-blue-500 flex items-center gap-1 ml-auto"><Icon name="File" size={10} /> 세금계산서 발행완료</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {detailItem && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl my-8">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">정산 상세</h3>
              <button onClick={() => setShowDetail(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-xs"><span className="text-gray-500">제목</span><span className="font-bold">{detailItem.campaignTitle || "일반 판매"}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-500">유형</span>{getTypeBadge(detailItem.type)}</div>
                <div className="flex justify-between text-xs"><span className="text-gray-500">라이브 셀러</span><span>{detailItem.sellerName}</span></div>
                {detailItem.brandName && <div className="flex justify-between text-xs"><span className="text-gray-500">브랜드</span><span>{detailItem.brandName}</span></div>}
                <div className="flex justify-between text-xs"><span className="text-gray-500">기간</span><span>{new Date(detailItem.periodStart).toLocaleDateString("ko-KR")} ~ {new Date(detailItem.periodEnd).toLocaleDateString("ko-KR")}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-500">사업자 유형</span><span>{detailItem.isBusiness ? "사업자" : "개인"}</span></div>
              </div>

              <div className="bg-brand-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-gray-700 mb-1">정산 내역</p>
                <div className="flex justify-between text-xs"><span className="text-gray-600">총 매출</span><span className="font-bold">{formatPrice(detailItem.totalSales)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-600">수수료 ({detailItem.commissionRate}%)</span><span className="text-red-500">-{formatPrice(detailItem.commissionAmount)}</span></div>
                <div className="flex justify-between text-xs border-t border-brand-100 pt-1"><span className="text-gray-600">정산액</span><span className="font-bold">{formatPrice(detailItem.settlementAmount)}</span></div>
                {detailItem.isBusiness ? (
                  <div className="flex justify-between text-xs"><span className="text-gray-600">세금계산서</span><span className="text-blue-600 font-medium">발행 대상</span></div>
                ) : (
                  <div className="flex justify-between text-xs"><span className="text-gray-600">원천징수 (3.3%)</span><span className="text-orange-600">-{formatPrice(detailItem.withholdingTax)}</span></div>
                )}
                <div className="flex justify-between text-sm border-t border-brand-100 pt-2">
                  <span className="font-bold text-gray-900">실수령액</span>
                  <span className="font-extrabold text-brand-600">{formatPrice(detailItem.netAmount)}</span>
                </div>
              </div>

              {detailItem.bankName && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-gray-700 mb-1">입금 계좌</p>
                  <div className="flex justify-between text-xs"><span className="text-gray-500">은행</span><span>{detailItem.bankName}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-500">계좌번호</span><span>{detailItem.accountNumber}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-500">예금주</span><span>{detailItem.accountHolder}</span></div>
                </div>
              )}

              {!detailItem.isBusiness && (
                <div className="bg-amber-50 rounded-xl p-3 flex items-start gap-2">
                  <Icon name="Warning" size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-[11px] text-amber-700">
                    <p className="font-medium">개인 라이브 셀러 원천징수 안내</p>
                    <p className="mt-0.5">사업자등록이 없는 개인 라이브 셀러의 경우 소득세법에 따라 정산액의 3.3% (소득세 3% + 지방소득세 0.3%)가 원천징수됩니다.</p>
                    <p className="mt-0.5">매년 5월 종합소득세 신고 시 기 납부 세액으로 공제됩니다.</p>
                  </div>
                </div>
              )}

              {detailItem.isBusiness && (
                <div className="bg-blue-50 rounded-xl p-3 flex items-start gap-2">
                  <Icon name="File" size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-[11px] text-blue-700">
                    <p className="font-medium">사업자 세금계산서 안내</p>
                    <p className="mt-0.5">사업자로 등록된 라이브 셀러/브랜드의 경우 정산 시 세금계산서가 발행됩니다.</p>
                    <p className="mt-0.5">부가가치세 신고 시 매출 세금계산서로 활용하세요.</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setShowDetail(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl font-medium">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* Request Settlement Modal */}
      {requestItem && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl my-8">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">정산 요청</h3>
              <button onClick={() => setShowRequestModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Amount Summary */}
              <div className="bg-brand-50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">요청 정산액</p>
                <p className="text-2xl font-extrabold text-brand-600">{formatPrice(requestItem.settlementAmount)}</p>
                {!reqIsBusiness && (
                  <p className="text-xs text-orange-600 mt-1">
                    원천징수 3.3% 적용 시 실수령액: {formatPrice(requestItem.settlementAmount * 0.967)}
                  </p>
                )}
              </div>

              {/* Business Type */}
              <div>
                <label className="text-xs font-bold text-gray-700">사업자 유형</label>
                <div className="flex gap-2 mt-1.5">
                  <button
                    onClick={() => setReqIsBusiness(true)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-1.5 ${
                      reqIsBusiness ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-gray-200 text-gray-500"
                    }`}
                  >
                    <Building2 size={14} /> 사업자
                  </button>
                  <button
                    onClick={() => setReqIsBusiness(false)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-1.5 ${
                      !reqIsBusiness ? "bg-orange-50 border-orange-300 text-orange-700" : "bg-white border-gray-200 text-gray-500"
                    }`}
                  >
                    <Icon name="MyPage" size={14} /> 개인
                  </button>
                </div>
              </div>

              {/* Business Number */}
              <div>
                <label className="text-xs font-bold text-gray-700">
                  {reqIsBusiness ? "사업자등록번호" : "주민등록번호"}
                </label>
                <input
                  type="text"
                  placeholder={reqIsBusiness ? "000-00-00000" : "000000-0000000"}
                  value={reqBizNumber}
                  onChange={e => setReqBizNumber(e.target.value)}
                  className="input-field mt-1.5 text-sm"
                />
              </div>

              {/* Bank Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700">은행</label>
                  <select value={reqBankName} onChange={e => setReqBankName(e.target.value)} className="input-field mt-1.5 text-sm">
                    <option value="">선택</option>
                    {["국민은행", "신한은행", "우리은행", "하나은행", "농협", "카카오뱅크", "토스뱅크", "기업은행", "SC제일은행"].map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">예금주</label>
                  <input type="text" placeholder="예금주명" value={reqAccountHolder} onChange={e => setReqAccountHolder(e.target.value)} className="input-field mt-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700">계좌번호</label>
                <input type="text" placeholder="계좌번호 입력" value={reqAccountNumber} onChange={e => setReqAccountNumber(e.target.value)} className="input-field mt-1.5 text-sm" />
              </div>

              {/* Disclaimer */}
              {!reqIsBusiness && (
                <div className="bg-amber-50 rounded-xl p-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={reqAgreedDisclaimer} onChange={e => setReqAgreedDisclaimer(e.target.checked)} className="mt-0.5 accent-amber-600" />
                    <span className="text-[11px] text-amber-700">
                      <span className="font-medium">개인 라이브 셀러 원천징수 안내 동의</span><br />
                      소득세법에 따라 정산액의 3.3% (소득세 3% + 지방소득세 0.3%)가 원천징수되며, 이에 동의합니다.
                      매년 5월 종합소득세 신고 시 기납부 세액으로 공제됩니다.
                    </span>
                  </label>
                </div>
              )}

              {reqIsBusiness && (
                <div className="bg-blue-50 rounded-xl p-3 text-[11px] text-blue-700">
                  <p className="font-medium">사업자 안내</p>
                  <p className="mt-0.5">정산 승인 후 세금계산서가 발행됩니다. 부가가치세 신고 시 활용하세요.</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setShowRequestModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl font-medium">취소</button>
              <button
                onClick={handleRequestSettlement}
                disabled={!reqBankName || !reqAccountNumber || !reqAccountHolder || !reqBizNumber || (!reqIsBusiness && !reqAgreedDisclaimer)}
                className="px-5 py-2.5 bg-brand-600 text-white text-sm rounded-xl hover:bg-brand-700 font-medium disabled:opacity-40 flex items-center gap-1"
              >
                <Icon name="Share" size={14} /> 정산 요청
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
