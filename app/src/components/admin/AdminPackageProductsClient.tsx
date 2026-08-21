"use client";

import { useState } from "react";
import { Package, Check, X, Eye, Clock, ChevronDown, ChevronUp, ShoppingBag } from "lucide-react";
import SafeImage from "@/components/shared/SafeImage";
import { formatPrice } from "@/lib/utils";

interface PackageItem {
  id: string;
  productId: string;
  unitPrice: number;
  quantity: number;
  product: {
    id: string;
    name: string;
    thumbnail: string | null;
    supplyPrice?: number | null;
    basePrice?: number | null;
    brand: { brandName: string } | null;
  };
}

interface PackageProduct {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  packagePrice: number;
  stock: number;
  status: string;
  rejectReason: string | null;
  creatorId: string;
  creatorRole: string;
  createdAt: string;
  creator: { id: string; name: string; email: string };
  items: PackageItem[];
  _count: { packageOrderItems: number };
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: "승인 대기", color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  APPROVED: { label: "승인됨", color: "text-green-600 bg-green-50 border-green-200" },
  REJECTED: { label: "거부됨", color: "text-red-600 bg-red-50 border-red-200" },
};

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "최고관리자",
  BRAND_ADMIN: "브랜드",
  SELLER: "셀러",
  MIDDLE_ADMIN: "중간관리자",
};

export default function AdminPackageProductsClient({ packages }: { packages: PackageProduct[] }) {
  const [filter, setFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);

  const filtered = filter === "ALL" ? packages : packages.filter((p) => p.status === filter);

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/package-products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (res.ok) window.location.reload();
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/package-products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", rejectReason }),
      });
      if (res.ok) {
        setRejectTargetId(null);
        setRejectReason("");
        window.location.reload();
      }
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = packages.filter((p) => p.status === "PENDING").length;

  return (
    <div>
      {/* 통계 */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { key: "ALL", label: "전체", count: packages.length, color: "text-gray-700" },
          { key: "PENDING", label: "승인 대기", count: pendingCount, color: "text-yellow-600" },
          { key: "APPROVED", label: "승인됨", count: packages.filter((p) => p.status === "APPROVED").length, color: "text-green-600" },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className={`bg-white rounded-xl border p-3 text-left transition-all shadow-sm ${
              filter === item.key ? "border-brand-400 ring-1 ring-brand-300" : "border-gray-100"
            }`}
          >
            <p className="text-xs text-gray-500 mb-1">{item.label}</p>
            <p className={`text-2xl font-bold ${item.color}`}>{item.count}</p>
          </button>
        ))}
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-xl border border-gray-100">
          <Package size={40} className="mx-auto mb-3 opacity-30 text-gray-400" />
          <p className="text-sm text-gray-400">패키지 상품이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((pkg) => {
            const statusInfo = STATUS_MAP[pkg.status] || STATUS_MAP.PENDING;
            const isExpanded = expandedId === pkg.id;
            const totalUnitPrice = pkg.items.reduce(
              (sum, item) => sum + item.unitPrice * item.quantity,
              0
            );

            return (
              <div key={pkg.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* 헤더 */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* 이미지 */}
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      {pkg.imageUrl ? (
                        <SafeImage src={pkg.imageUrl} alt={pkg.name} width={56} height={56} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={24} className="m-auto mt-4 text-gray-300" />
                      )}
                    </div>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-sm font-bold text-gray-900">{pkg.name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                        <span>등록자: {pkg.creator.name} ({ROLE_LABEL[pkg.creatorRole] || pkg.creatorRole})</span>
                        <span>판매가: <strong className="text-gray-700">{formatPrice(pkg.packagePrice)}원</strong></span>
                        <span>재고: {pkg.stock}개</span>
                        <span>구성: {pkg.items.length}개</span>
                        <span>주문수: {pkg._count.packageOrderItems}</span>
                      </div>
                      {pkg.rejectReason && (
                        <p className="text-xs text-red-500 mt-1">거부 사유: {pkg.rejectReason}</p>
                      )}
                    </div>

                    {/* 액션 */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : pkg.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors border border-gray-200"
                      >
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {isExpanded ? "닫기" : "상세보기"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 확장 영역: 구성 상품 상세 */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-gray-700">구성 상품 상세</p>
                      <span className="text-[10px] text-gray-400">총 {pkg.items.length}개 구성</span>
                    </div>
                    <div className="space-y-2">
                      {pkg.items.map((item) => (
                        <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-200 flex-shrink-0">
                              {item.product.thumbnail ? (
                                <SafeImage src={item.product.thumbnail} alt={item.product.name} width={40} height={40} className="w-full h-full object-cover" />
                              ) : (
                                <Package size={16} className="m-auto mt-3 text-gray-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-800 truncate">{item.product.name}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{item.product.brand?.brandName || "브랜드 미지정"}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs font-bold text-gray-800">{formatPrice(item.unitPrice)}원 × {item.quantity}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">소계: {formatPrice(item.unitPrice * item.quantity)}원</p>
                            </div>
                          </div>
                          {(item.product.supplyPrice != null || item.product.basePrice != null) && (
                            <div className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-3 text-[10px] text-gray-500">
                              {item.product.supplyPrice != null && (
                                <span>공급가: <strong className="text-gray-700">{formatPrice(item.product.supplyPrice)}원</strong></span>
                              )}
                              {item.product.basePrice != null && (
                                <span>판매가: <strong className="text-gray-700">{formatPrice(item.product.basePrice)}원</strong></span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-2 border-t border-gray-200 flex items-center justify-between text-xs">
                      <span className="text-gray-500">구성 단가 합계 (참고)</span>
                      <span className="font-bold text-gray-700">{formatPrice(totalUnitPrice)}원</span>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-gray-500">패키지 판매가</span>
                      <span className="font-bold text-brand-600">{formatPrice(pkg.packagePrice)}원</span>
                    </div>
                  </div>
                )}

                {/* 승인/거부 버튼 (PENDING 상태만) */}
                {pkg.status === "PENDING" && (
                  <div className="px-4 py-3 border-t border-gray-50 flex items-center gap-2">
                    {rejectTargetId === pkg.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="거부 사유 (선택)"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs border border-red-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400"
                        />
                        <button
                          onClick={() => handleReject(pkg.id)}
                          disabled={processingId === pkg.id}
                          className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                        >
                          거부 확인
                        </button>
                        <button
                          onClick={() => setRejectTargetId(null)}
                          className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleApprove(pkg.id)}
                          disabled={processingId === pkg.id}
                          className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors font-medium"
                        >
                          <Check size={13} />
                          승인
                        </button>
                        <button
                          onClick={() => setRejectTargetId(pkg.id)}
                          className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors font-medium"
                        >
                          <X size={13} />
                          거부
                        </button>
                      </>
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
