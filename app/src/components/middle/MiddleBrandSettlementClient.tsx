"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { useRouter } from "next/navigation";
import {Building2, Loader2, X} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";

interface BrandPayout {
  id: string;
  brandName: string;
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  totalSales: number;
  totalSupply: number;
  orderCount: number;
  unpaidAmount: number;
  paidAmount: number;
}

interface Settlement {
  id: string;
  brandId: string;
  brandName: string;
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

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" });

const INVOICE_LABEL: Record<string, string> = {
  NONE: "미요청", REQUESTED: "요청중", ISSUED: "발급완료",
};
const INVOICE_STYLE: Record<string, string> = {
  NONE: "bg-gray-100 text-gray-400",
  REQUESTED: "bg-amber-50 text-amber-600",
  ISSUED: "bg-emerald-50 text-emerald-600",
};

// ─── 정산 생성 모달 ──────────────────────────────────
function CreateSettlementModal({
  brand,
  onClose,
  onCreated,
}: {
  brand: BrandPayout;
  onClose: () => void;
  onCreated: () => void;
}) {
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
  const [form, setForm] = useState({
    periodLabel: defaultPeriod,
    totalSupply: brand.unpaidAmount.toFixed(0),
    totalSales: brand.totalSales.toFixed(0),
    orderCount: brand.orderCount.toString(),
    memo: "",
  });
  const [saving, setSaving] = useState(false);
  const { appAlert } = useAppDialog();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.periodLabel.trim()) {
      await appAlert({ message: "정산 기간을 입력하세요.", type: "warning" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/middle/brand-settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: brand.id,
          periodLabel: form.periodLabel,
          totalSupply: Number(form.totalSupply),
          totalSales: Number(form.totalSales),
          orderCount: Number(form.orderCount),
          memo: form.memo || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        await appAlert({ message: data.error || "저장 실패", type: "warning" });
        return;
      }
      await appAlert({ message: "정산 내역이 생성되었습니다.", type: "success" });
      onCreated();
    } catch {
      await appAlert({ message: "오류가 발생했습니다.", type: "warning" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">{brand.brandName} 정산 생성</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* 계좌 정보 */}
        {brand.bankName && (
          <div className="mb-4 bg-purple-50 rounded-xl p-3 text-[12px] text-purple-700">
            <p className="font-semibold mb-0.5">정산 계좌</p>
            <p>{brand.bankName} {brand.accountNumber} ({brand.accountHolder})</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-gray-500 mb-1 block">정산 기간 *</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
              value={form.periodLabel}
              onChange={(e) => setForm((f) => ({ ...f, periodLabel: e.target.value }))}
              placeholder="예: 2026년 7월"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-1 block">공급가 합계 (원)</label>
              <input
                type="number"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                value={form.totalSupply}
                onChange={(e) => setForm((f) => ({ ...f, totalSupply: e.target.value }))}
                min={0}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 mb-1 block">총 매출액 (원)</label>
              <input
                type="number"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                value={form.totalSales}
                onChange={(e) => setForm((f) => ({ ...f, totalSales: e.target.value }))}
                min={0}
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 mb-1 block">주문 수량</label>
            <input
              type="number"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
              value={form.orderCount}
              onChange={(e) => setForm((f) => ({ ...f, orderCount: e.target.value }))}
              min={0}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 mb-1 block">메모 (선택)</label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 resize-none"
              rows={2}
              value={form.memo}
              onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
              placeholder="특이사항 등"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Icon name="Plus" size={14} />}
            정산 생성
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ───────────────────────────────────
export default function MiddleBrandSettlementClient({
  initialBrandPayouts,
  initialSettlements,
}: {
  initialBrandPayouts: BrandPayout[];
  initialSettlements: Settlement[];
}) {
  const router = useRouter();
  const { appAlert, appConfirm } = useAppDialog();
  const [brandPayouts, setBrandPayouts] = useState(initialBrandPayouts);
  const [settlements, setSettlements] = useState(initialSettlements);
  const [selectedBrand, setSelectedBrand] = useState<BrandPayout | null>(null);
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const reload = async () => {
    try {
      const res = await fetch("/api/middle/brand-settlements");
      if (res.ok) {
        const data = await res.json();
        setBrandPayouts(data.brandPayouts ?? []);
        setSettlements(data.settlements ?? []);
      }
    } catch {}
    router.refresh();
  };

  const handleMarkPaid = async (s: Settlement) => {
    const ok = await appConfirm({
      title: "지급완료 처리",
      message: `${s.brandName} - ${s.periodLabel}\n${won(s.totalSupply)}을 지급완료로 처리하시겠습니까?`,
      confirmText: "지급완료 처리",
    });
    if (!ok) return;
    setProcessing(s.id);
    try {
      const res = await fetch("/api/middle/brand-settlements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id, action: "markPaid" }),
      });
      const data = await res.json();
      if (!res.ok) {
        await appAlert({ message: data.error || "처리 실패", type: "warning" });
        return;
      }
      await appAlert({ message: "지급완료로 변경되었습니다.", type: "success" });
      await reload();
    } catch {
      await appAlert({ message: "오류가 발생했습니다.", type: "warning" });
    } finally {
      setProcessing(null);
    }
  };

  const handleRequestInvoice = async (s: Settlement) => {
    const ok = await appConfirm({
      title: "세금계산서 발급 요청",
      message: `${s.brandName} - ${s.periodLabel}\n${won(s.totalSupply)} 세금계산서 발급을 요청하시겠습니까?`,
      confirmText: "발급 요청",
    });
    if (!ok) return;
    setProcessing(s.id);
    try {
      const res = await fetch("/api/middle/brand-settlements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id, action: "requestInvoice" }),
      });
      const data = await res.json();
      if (!res.ok) {
        await appAlert({ message: data.error || "요청 실패", type: "warning" });
        return;
      }
      await appAlert({ message: "세금계산서 발급이 요청되었습니다.", type: "success" });
      await reload();
    } catch {
      await appAlert({ message: "오류가 발생했습니다.", type: "warning" });
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (s: Settlement) => {
    const ok = await appConfirm({
      title: "정산 삭제",
      message: `${s.brandName} - ${s.periodLabel} 정산을 삭제하시겠습니까?`,
      confirmText: "삭제",
      type: "error",
    });
    if (!ok) return;
    setProcessing(s.id);
    try {
      const res = await fetch("/api/middle/brand-settlements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        await appAlert({ message: data.error || "삭제 실패", type: "warning" });
        return;
      }
      await reload();
    } catch {
      await appAlert({ message: "오류가 발생했습니다.", type: "warning" });
    } finally {
      setProcessing(null);
    }
  };

  const totalUnpaid = brandPayouts.reduce((a, b) => a + b.unpaidAmount, 0);
  const totalPaid = brandPayouts.reduce((a, b) => a + b.paidAmount, 0);

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-[11px] text-gray-400 mb-1">미정산 총액</p>
          <p className="text-xl font-extrabold text-rose-600">{won(totalUnpaid)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">브랜드 {brandPayouts.length}개사</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-[11px] text-gray-400 mb-1">누적 정산 완료</p>
          <p className="text-xl font-extrabold text-emerald-600">{won(totalPaid)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">정산 건수 {settlements.filter((s) => s.isPaid).length}건</p>
        </div>
      </div>

      {/* 브랜드별 미정산 현황 */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Building2 size={16} className="text-purple-600" />
              브랜드사별 정산 현황
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">각 브랜드사에 지급해야 할 공급가 기준 금액입니다.</p>
          </div>
        </div>

        {brandPayouts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <Building2 size={32} className="mx-auto text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">소속 브랜드사가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {brandPayouts.map((brand) => {
              const brandSettlements = settlements.filter((s) => s.brandId === brand.id);
              const isExpanded = expandedBrand === brand.id;
              return (
                <div key={brand.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  {/* 브랜드 헤더 */}
                  <div className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                      <Building2 size={18} className="text-purple-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold text-gray-900">{brand.brandName}</p>
                      {brand.bankName ? (
                        <p className="text-[10px] text-gray-400">{brand.bankName} {brand.accountNumber}</p>
                      ) : (
                        <p className="text-[10px] text-rose-400 flex items-center gap-0.5">
                          <Icon name="Warning" size={9} /> 계좌 정보 미입력
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 mr-2">
                      <p className="text-[11px] text-gray-400">미정산</p>
                      <p className={`text-[15px] font-bold ${brand.unpaidAmount > 0 ? "text-rose-600" : "text-gray-400"}`}>
                        {won(brand.unpaidAmount)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => setSelectedBrand(brand)}
                        className="flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                      >
                        <Icon name="Plus" size={11} /> 정산 생성
                      </button>
                      <button
                        onClick={() => setExpandedBrand(isExpanded ? null : brand.id)}
                        className="flex items-center justify-center gap-1 text-[11px] text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        {isExpanded ? <Icon name="ChevronDown" size={12} className="rotate-180" /> : <Icon name="ChevronDown" size={12} />}
                        내역 {brandSettlements.length}건
                      </button>
                    </div>
                  </div>

                  {/* 통계 바 */}
                  <div className="px-4 pb-3 grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-50 rounded-xl py-2">
                      <p className="text-[9px] text-gray-400">총 주문</p>
                      <p className="text-[12px] font-bold text-gray-700">{brand.orderCount}건</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl py-2">
                      <p className="text-[9px] text-gray-400">총 매출</p>
                      <p className="text-[12px] font-bold text-gray-700">{won(brand.totalSales)}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl py-2">
                      <p className="text-[9px] text-emerald-600">정산 완료</p>
                      <p className="text-[12px] font-bold text-emerald-700">{won(brand.paidAmount)}</p>
                    </div>
                  </div>

                  {/* 정산 내역 펼치기 */}
                  {isExpanded && (
                    <div className="border-t border-gray-50 divide-y divide-gray-50">
                      {brandSettlements.length === 0 ? (
                        <p className="text-center text-[12px] text-gray-400 py-4">정산 내역이 없습니다.</p>
                      ) : (
                        brandSettlements.map((s) => (
                          <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.isPaid ? "bg-emerald-50" : "bg-amber-50"}`}>
                              {s.isPaid ? (
                                <Icon name="Check" size={15} className="text-emerald-500" />
                              ) : (
                                <Icon name="Clock" size={15} className="text-amber-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[13px] font-bold text-gray-800">{s.periodLabel}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${s.isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-50 text-amber-600"}`}>
                                  {s.isPaid ? "지급완료" : "미지급"}
                                </span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${INVOICE_STYLE[s.invoiceStatus] ?? INVOICE_STYLE.NONE}`}>
                                  <Icon name="Receipt" size={8} />
                                  {INVOICE_LABEL[s.invoiceStatus] ?? "미요청"}
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                공급가 {won(s.totalSupply)} · 주문 {s.orderCount}건
                                {s.paidAt ? ` · 지급일 ${fmtDate(s.paidAt)}` : ""}
                                {s.memo ? ` · ${s.memo}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {!s.isPaid && (
                                <button
                                  onClick={() => handleMarkPaid(s)}
                                  disabled={processing === s.id}
                                  className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
                                >
                                  {processing === s.id ? <Loader2 size={10} className="animate-spin" /> : <Icon name="Check" size={10} />}
                                  지급완료
                                </button>
                              )}
                              {s.isPaid && s.invoiceStatus === "NONE" && (
                                <button
                                  onClick={() => handleRequestInvoice(s)}
                                  disabled={processing === s.id}
                                  className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
                                >
                                  {processing === s.id ? <Loader2 size={10} className="animate-spin" /> : <Icon name="Receipt" size={10} />}
                                  계산서
                                </button>
                              )}
                              {!s.isPaid && (
                                <button
                                  onClick={() => handleDelete(s)}
                                  disabled={processing === s.id}
                                  className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-colors disabled:opacity-60"
                                >
                                  <Icon name="Delete" size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 전체 정산 내역 */}
      {settlements.length > 0 && (
        <div>
          <div className="mb-3">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Icon name="CreditCard" size={16} className="text-gray-600" />
              전체 정산 내역
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">총 {settlements.length}건 · 지급완료 {settlements.filter((s) => s.isPaid).length}건</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
            {settlements.map((s) => (
              <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.isPaid ? "bg-emerald-50" : "bg-amber-50"}`}>
                  {s.isPaid ? (
                    <Icon name="Check" size={14} className="text-emerald-500" />
                  ) : (
                    <Icon name="Clock" size={14} className="text-amber-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[12px] font-bold text-gray-800">{s.brandName}</span>
                    <span className="text-[10px] text-gray-400">·</span>
                    <span className="text-[12px] text-gray-600">{s.periodLabel}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${s.isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-50 text-amber-600"}`}>
                      {s.isPaid ? "지급완료" : "미지급"}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400">공급가 {won(s.totalSupply)} · 등록일 {fmtDate(s.createdAt)}</p>
                </div>
                <p className={`text-[13px] font-bold flex-shrink-0 ${s.isPaid ? "text-emerald-700" : "text-gray-700"}`}>
                  {won(s.totalSupply)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 정산 생성 모달 */}
      {selectedBrand && (
        <CreateSettlementModal
          brand={selectedBrand}
          onClose={() => setSelectedBrand(null)}
          onCreated={() => {
            setSelectedBrand(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
