"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useMemo } from "react";
import {X} from 'lucide-react';
import { formatPrice } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: "결제대기", color: "bg-gray-100 text-gray-600" },
  PAID: { label: "결제완료", color: "bg-blue-50 text-blue-600" },
  CONFIRMED: { label: "확인됨", color: "bg-indigo-50 text-indigo-600" },
  SHIPPING: { label: "배송중", color: "bg-cyan-50 text-cyan-600" },
  DELIVERED: { label: "배송완료", color: "bg-green-50 text-green-600" },
  CANCELLED: { label: "취소됨", color: "bg-red-50 text-red-600" },
  REFUND_REQUESTED: { label: "환불요청", color: "bg-orange-50 text-orange-600" },
  REFUNDED: { label: "환불완료", color: "bg-gray-100 text-gray-500" },
};

interface Order {
  id: string; orderNumber: string; userName: string; sellerName: string;
  finalAmount: number; status: string; createdAt: string;
}

export default function AdminOrdersClient({ orders }: { orders: Order[] }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.userName.toLowerCase().includes(q) ||
        o.sellerName.toLowerCase().includes(q)
    );
  }, [orders, searchQuery]);

  const totalAmount = filtered.reduce((sum, o) => sum + o.finalAmount, 0);

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">주문 관리</h1>
          <p className="text-sm text-gray-500">총 {filtered.length}건 · {formatPrice(totalAmount)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="주문번호, 구매자, 라이브 셀러 검색..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white" />
          {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Icon name="File" size={48} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{searchQuery ? "검색 결과가 없습니다." : "아직 주문이 없습니다."}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 lg:hidden">
            {filtered.map((order) => {
              const status = STATUS_MAP[order.status] || { label: order.status, color: "bg-gray-100 text-gray-600" };
              return (
                <div key={order.id} className="bg-white rounded-xl border border-gray-100 p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-900">{order.orderNumber}</p>
                    <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-gray-500">{order.userName} → {order.sellerName}</p>
                      <p className="text-[10px] text-gray-400">{new Date(order.createdAt).toLocaleDateString("ko-KR")}</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{formatPrice(order.finalAmount)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="hidden lg:block bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">주문번호</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">구매자</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">라이브 셀러</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">금액</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">일시</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((order) => {
                  const status = STATUS_MAP[order.status] || { label: order.status, color: "bg-gray-100 text-gray-600" };
                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{order.orderNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{order.userName}</td>
                      <td className="px-4 py-3 text-gray-600">{order.sellerName}</td>
                      <td className="px-4 py-3 font-semibold">{formatPrice(order.finalAmount)}</td>
                      <td className="px-4 py-3"><span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span></td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(order.createdAt).toLocaleDateString("ko-KR")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
