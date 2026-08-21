"use client";

import { Icon } from '@/components/shared/Icon';
import { useMemo, useState } from "react";
import {} from 'lucide-react';
import type { SettlementOrder } from "@/lib/settlement";

const formatPrice = (n: number) => Math.round(n).toLocaleString("ko-KR") + "원";
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" });

interface Props {
  orders: SettlementOrder[];
  feeRate: number; // 부가세 포함 실효 수수료율(%)
  supplyLabel?: string; // 공급가 컬럼 라벨
}

const PAGE_SIZE = 20;

export default function SupplierSettlementTable({ orders, feeRate, supplyLabel = "공급가" }: Props) {
  const [expanded, setExpanded] = useState(false);

  const totals = useMemo(() => {
    return orders.reduce(
      (acc, o) => {
        acc.supply += o.supplyAmount;
        acc.settle += o.settlementAmount;
        acc.fee += o.commissionAmount;
        return acc;
      },
      { supply: 0, settle: 0, fee: 0 },
    );
  }, [orders]);

  const visible = expanded ? orders : orders.slice(0, PAGE_SIZE);

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <Icon name="Package" size={16} className="text-brand-600" /> 공급자 정산 내역
        </h2>
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1">
          <Icon name="Discount" size={12} className="text-gray-400" /> 플랫폼 수수료 {feeRate}% (부가세 포함)
        </span>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Icon name="Package" size={34} strokeWidth={1.5} className="mx-auto mb-2 opacity-30" />
          <p className="text-xs">정산 대상 판매 내역이 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] min-w-[560px]">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left font-medium py-2 px-2">상품명</th>
                  <th className="text-center font-medium py-2 px-2 whitespace-nowrap">판매일</th>
                  <th className="text-right font-medium py-2 px-2 whitespace-nowrap">{supplyLabel}</th>
                  <th className="text-right font-medium py-2 px-2 whitespace-nowrap">플랫폼 수수료</th>
                  <th className="text-right font-medium py-2 px-2 whitespace-nowrap">공급자 정산액</th>
                  <th className="text-center font-medium py-2 px-2 whitespace-nowrap">상태</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((o) => (
                  <tr key={o.orderId} className="border-b border-gray-50">
                    <td className="py-2 px-2">
                      <span className="text-gray-800 font-medium line-clamp-1">
                        {(o.productNames && o.productNames.length > 0 ? o.productNames.join(", ") : null) || o.campaignTitle || "일반 판매"}
                      </span>
                    </td>
                    <td className="text-center py-2 px-2 text-gray-500 whitespace-nowrap">{fmtDate(o.saleDate)}</td>
                    <td className="text-right py-2 px-2 text-gray-700 whitespace-nowrap">{formatPrice(o.supplyAmount)}</td>
                    <td className="text-right py-2 px-2 text-rose-500 whitespace-nowrap">- {formatPrice(o.commissionAmount)}</td>
                    <td className="text-right py-2 px-2 font-bold text-brand-600 whitespace-nowrap">{formatPrice(o.settlementAmount)}</td>
                    <td className="text-center py-2 px-2 whitespace-nowrap">
                      {o.available ? (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">정산가능</span>
                      ) : (
                        <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">예정</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-100 font-bold text-gray-800">
                  <td className="py-2.5 px-2" colSpan={2}>합계 ({orders.length}건)</td>
                  <td className="text-right py-2.5 px-2 whitespace-nowrap">{formatPrice(totals.supply)}</td>
                  <td className="text-right py-2.5 px-2 text-rose-500 whitespace-nowrap">- {formatPrice(totals.fee)}</td>
                  <td className="text-right py-2.5 px-2 text-brand-600 whitespace-nowrap">{formatPrice(totals.settle)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {orders.length > PAGE_SIZE && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-700 py-2 border border-gray-100 rounded-lg"
            >
              {expanded ? (
                <>접기 <Icon name="ChevronDown" size={14} className="rotate-180" /></>
              ) : (
                <>{orders.length - PAGE_SIZE}건 더보기 <Icon name="ChevronDown" size={14} /></>
              )}
            </button>
          )}
        </>
      )}
    </section>
  );
}
