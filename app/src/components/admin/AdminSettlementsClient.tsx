"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useMemo } from "react";
import {X} from 'lucide-react';
import { formatPrice } from "@/lib/utils";

interface Settlement {
  id: string; sellerName: string; campaignTitle: string; totalSales: number;
  commissionAmount: number; settlementAmount: number; status: string; createdAt: string;
}

export default function AdminSettlementsClient({ settlements }: { settlements: Settlement[] }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return settlements;
    const q = searchQuery.toLowerCase();
    return settlements.filter(
      (s) => s.sellerName.toLowerCase().includes(q) || s.campaignTitle.toLowerCase().includes(q)
    );
  }, [settlements, searchQuery]);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">정산 관리</h1>
        <p className="text-sm text-gray-500">총 {settlements.length}건</p>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="라이브 셀러, 캠페인 검색..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white" />
          {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Icon name="CreditCard" size={48} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{searchQuery ? "검색 결과가 없습니다." : "정산 내역이 없습니다."}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">라이브 셀러</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">캠페인</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">매출</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">수수료</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">정산액</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.sellerName}</td>
                    <td className="px-4 py-3 text-gray-600">{s.campaignTitle}</td>
                    <td className="px-4 py-3">{formatPrice(s.totalSales)}</td>
                    <td className="px-4 py-3 text-red-500">{formatPrice(s.commissionAmount)}</td>
                    <td className="px-4 py-3 font-semibold text-brand-600">{formatPrice(s.settlementAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        s.status === "PAID" ? "bg-green-50 text-green-600" : s.status === "APPROVED" ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-500"
                      }`}>
                        {s.status === "PENDING" ? "대기" : s.status === "CALCULATED" ? "산정" : s.status === "APPROVED" ? "승인" : s.status === "PAID" ? "완료" : "거절"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
