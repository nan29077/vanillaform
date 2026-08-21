"use client";

import { useState } from "react";
import { Package, ChevronDown, CheckCircle2, Clock, Truck, AlertCircle } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface PurchaseOrder {
  id: string;
  recipientType: string;
  productName: string | null;
  amount: number;
  status: string;
  createdAt: string;
  packageOrderItem: {
    id: string;
    quantity: number;
    packagePrice: number;
    paidAt: string | null;
    buyerName: string | null;
    buyerPhone: string | null;
    buyerAddress: string | null;
    buyerMemo: string | null;
    package: {
      id: string;
      name: string;
      packagePrice: number;
    };
  };
  recipient: {
    id: string;
    name: string;
    email: string;
  };
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: "발주 대기", color: "text-yellow-600 bg-yellow-50", icon: Clock },
  CONFIRMED: { label: "발주 확인", color: "text-blue-600 bg-blue-50", icon: CheckCircle2 },
  SHIPPED: { label: "배송 중", color: "text-indigo-600 bg-indigo-50", icon: Truck },
  COMPLETED: { label: "완료", color: "text-green-600 bg-green-50", icon: CheckCircle2 },
};

interface Props {
  purchaseOrders: PurchaseOrder[];
  role: string;
}

export default function PackagePurchaseOrdersClient({ purchaseOrders, role }: Props) {
  const [filter, setFilter] = useState("ALL");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filtered =
    filter === "ALL" ? purchaseOrders : purchaseOrders.filter((po) => po.status === filter);

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/package-purchase-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const totalAmount = filtered.reduce((sum, po) => sum + po.amount, 0);

  return (
    <div>
      {/* 상단 통계 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {Object.entries(STATUS_MAP).map(([key, val]) => {
          const count = purchaseOrders.filter((po) => po.status === key).length;
          const Icon = val.icon;
          return (
            <div key={key} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} className={val.color.split(" ")[0]} />
                <span className="text-xs text-gray-500">{val.label}</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{count}</p>
            </div>
          );
        })}
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-2 mb-4">
        {[["ALL", "전체"], ...Object.entries(STATUS_MAP).map(([k, v]) => [k, v.label])].map(
          ([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === key
                  ? "bg-brand-500 text-black"
                  : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          )
        )}
        <span className="ml-auto text-xs text-gray-400">
          합계: <span className="font-bold text-gray-700">{formatPrice(totalAmount)}원</span>
        </span>
      </div>

      {/* 발주서 목록 */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-xl border border-gray-100">
          <Package size={40} className="mx-auto mb-3 opacity-30 text-gray-400" />
          <p className="text-sm text-gray-400">패키지 발주서가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((po) => {
            const statusInfo = STATUS_MAP[po.status] || STATUS_MAP.PENDING;
            const StatusIcon = statusInfo.icon;
            return (
              <div key={po.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Package size={14} className="text-brand-600 flex-shrink-0" />
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {po.packageOrderItem.package.name}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span>수량: {po.packageOrderItem.quantity}개</span>
                        {po.productName && (
                          <span className="text-gray-400">· 구성품: {po.productName}</span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                        {po.recipientType === "CREATOR" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-purple-600 bg-purple-50">
                            패키지 등록자 발주
                          </span>
                        )}
                        {po.recipientType === "BRAND" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-blue-600 bg-blue-50">
                            브랜드 발주
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-base font-bold text-gray-900">{formatPrice(po.amount)}원</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(po.createdAt).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 배송 정보 */}
                {po.packageOrderItem.buyerName && (
                  <div className="px-4 py-2 bg-gray-50 text-xs text-gray-600">
                    <span className="font-medium">배송:</span>{" "}
                    {po.packageOrderItem.buyerName} · {po.packageOrderItem.buyerPhone} ·{" "}
                    {po.packageOrderItem.buyerAddress}
                    {po.packageOrderItem.buyerMemo && ` (${po.packageOrderItem.buyerMemo})`}
                  </div>
                )}

                {/* 수신자 (관리자 뷰) */}
                {role === "SUPER_ADMIN" && (
                  <div className="px-4 py-2 bg-blue-50 text-xs text-blue-700">
                    수신: {po.recipient.name} ({po.recipient.email})
                  </div>
                )}

                {/* 상태 변경 */}
                {po.status !== "COMPLETED" && (
                  <div className="px-4 py-3 border-t border-gray-50 flex items-center gap-2">
                    {po.status === "PENDING" && (
                      <button
                        onClick={() => updateStatus(po.id, "CONFIRMED")}
                        disabled={updatingId === po.id}
                        className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                      >
                        발주 확인
                      </button>
                    )}
                    {po.status === "CONFIRMED" && (
                      <button
                        onClick={() => updateStatus(po.id, "SHIPPED")}
                        disabled={updatingId === po.id}
                        className="text-xs px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                      >
                        배송 시작
                      </button>
                    )}
                    {po.status === "SHIPPED" && (
                      <button
                        onClick={() => updateStatus(po.id, "COMPLETED")}
                        disabled={updatingId === po.id}
                        className="text-xs px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                      >
                        배송 완료
                      </button>
                    )}
                    {role === "SUPER_ADMIN" && po.status !== "COMPLETED" && (
                      <button
                        onClick={() => updateStatus(po.id, "COMPLETED")}
                        disabled={updatingId === po.id}
                        className="text-xs px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors ml-auto"
                      >
                        강제 완료
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
