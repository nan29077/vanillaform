"use client";

import { Icon } from '@/components/shared/Icon';
import { useRouter, useSearchParams } from "next/navigation";
;
import { formatPrice } from "@/lib/utils";
import Pagination, { usePagination } from "@/components/shared/Pagination";

import type { PlatformRevenue } from "@/lib/revenue";

interface Props {
  revenue: PlatformRevenue;
  period: string;
}

const PERIOD_LABELS: Record<string, string> = {
  this_month: "이번 달",
  last_month: "저번 달",
  all: "전체",
};

export default function AdminRevenueClient({ revenue, period }: Props) {
  const router = useRouter();

  const handlePeriodChange = (p: string) => {
    router.push(`/admin/revenue?period=${p}`);
  };

  const {
    rows,
    rowsTruncated,
    orderCount,
    totalSales,
    totalSellerFee,
    totalSupplierFee,
    totalPlatformFee,
    totalMarginRevenue,
    totalPgFee,
    netRevenue,
  } = revenue;

  const { pageItems, page, setPage, totalPages } = usePagination(rows, 20);

  return (
    <>
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">관리자 수익</h1>
          <p className="text-xs sm:text-sm text-gray-500">
            주문 시점 요율 기준 · 셀러 수수료 + 공급자 수수료 + 마진 − PG 수수료
          </p>
        </div>
        {/* 기간 필터 */}
        <div className="flex items-center gap-1.5">
          {(["this_month", "last_month", "all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                period === p
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-brand-300"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Icon name="Chart" size={18} className="text-blue-600" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-gray-600">순수익</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatPrice(netRevenue)}</p>
          <p className="text-[11px] text-gray-400 mt-1">PG 수수료 차감 후 · 주문 {orderCount}건</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Icon name="Discount" size={18} className="text-emerald-600" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-gray-600">플랫폼 수수료 수익</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatPrice(totalPlatformFee)}</p>
          <p className="text-[11px] text-gray-400 mt-1">
            셀러 {formatPrice(totalSellerFee)} + 공급자 {formatPrice(totalSupplierFee)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <Icon name="Wallet" size={18} className="text-amber-600" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-gray-600">상품 마진 수익</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatPrice(totalMarginRevenue)}</p>
          <p className="text-[11px] text-gray-400 mt-1">adminMargin × 판매수량 합계</p>
        </div>
      </div>

      {/* 수익 구성 — 결제액에서 순수익까지 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
        <h2 className="text-sm font-bold text-gray-900 mb-3">수익 구성</h2>
        <dl className="space-y-1.5 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-gray-500">총 결제액 (GMV)</dt>
            <dd className="font-medium text-gray-900">{formatPrice(totalSales)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">셀러 수수료 수익</dt>
            <dd className="text-emerald-700">+ {formatPrice(totalSellerFee)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">공급자(브랜드·중간관리자) 수수료 수익</dt>
            <dd className="text-emerald-700">+ {formatPrice(totalSupplierFee)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">상품 마진 수익</dt>
            <dd className="text-amber-700">+ {formatPrice(totalMarginRevenue)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">PG 수수료 (2.86%, 실비용)</dt>
            <dd className="text-rose-600">− {formatPrice(totalPgFee)}</dd>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-2 mt-2">
            <dt className="font-bold text-gray-900">순수익</dt>
            <dd className="font-bold text-blue-700">{formatPrice(netRevenue)}</dd>
          </div>
        </dl>
        <p className="text-[11px] text-gray-400 mt-3">
          수수료는 주문 시점에 고정된 요율로 계산됩니다. 이후 요율을 바꿔도 과거 수치는 변하지 않습니다.
        </p>
      </div>

      {/* 주문별 내역 테이블 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Icon name="Receipt" size={15} className="text-gray-400" strokeWidth={1.5} />
          <h2 className="text-sm font-bold text-gray-900">
            주문별 수익 내역 ({orderCount}건)
          </h2>
          {rowsTruncated && (
            <span className="text-[11px] text-amber-600">
              목록은 최근 {rows.length}건만 표시 (합계는 전체 {orderCount}건 기준)
            </span>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Icon name="Cart" size={36} className="mx-auto mb-2 opacity-30" strokeWidth={1.5} />
            <p className="text-sm">해당 기간에 완료된 주문이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 whitespace-nowrap">주문번호</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 whitespace-nowrap">셀러</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 whitespace-nowrap">주문일</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-gray-500 whitespace-nowrap">판매금액</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-gray-500 whitespace-nowrap">플랫폼 수수료</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-gray-500 whitespace-nowrap">마진 수익</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-gray-500 whitespace-nowrap">합계</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pageItems.map((row) => (
                  <tr key={row.orderId} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-[12px] text-gray-500 font-mono whitespace-nowrap">
                      {row.orderNumber}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-gray-700 whitespace-nowrap">
                      {row.sellerName}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-gray-400 whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleDateString("ko-KR", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-gray-900 text-right whitespace-nowrap font-medium">
                      {formatPrice(row.finalAmount)}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-emerald-700 text-right whitespace-nowrap">
                      {formatPrice(row.platformFee)}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-amber-700 text-right whitespace-nowrap">
                      {row.marginRevenue > 0 ? formatPrice(row.marginRevenue) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-blue-700 text-right whitespace-nowrap font-bold">
                      {formatPrice(row.platformFee + row.marginRevenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={3} className="px-4 py-3 text-[12px] font-bold text-gray-700">
                    합계 (전체 {orderCount}건)
                  </td>
                  <td className="px-4 py-3 text-[12px] font-bold text-gray-900 text-right">
                    {formatPrice(totalSales)}
                  </td>
                  <td className="px-4 py-3 text-[12px] font-bold text-emerald-700 text-right">
                    {formatPrice(totalPlatformFee)}
                  </td>
                  <td className="px-4 py-3 text-[12px] font-bold text-amber-700 text-right">
                    {formatPrice(totalMarginRevenue)}
                  </td>
                  <td className="px-4 py-3 text-[12px] font-bold text-blue-700 text-right">
                    {formatPrice(totalPlatformFee + totalMarginRevenue)}
                  </td>
                </tr>
              </tfoot>
            </table>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    </>
  );
}
