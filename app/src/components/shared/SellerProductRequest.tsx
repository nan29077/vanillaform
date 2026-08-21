"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { NO_IMAGE } from "@/lib/defaults";
import {Loader2, X} from 'lucide-react';
import SafeImage from "./SafeImage";
import ProductDetailModal from "./ProductDetailModal";

interface SellerProductRequestProps {
  product: {
    id: string;
    name: string;
    thumbnail: string | null;
    basePrice: number;
    // 셀러 노출 공급가 (공급가 + 중간관리자 마진). 판매가는 셀러가 직접 설정.
    supplyPrice?: number;
    // 제공 방식: SUPPLY(공급가 제공) / COMMISSION(수수료 제공)
    priceModel?: "SUPPLY" | "COMMISSION";
    commissionRate?: number | null;
    brandName: string | null;
    categoryName: string | null;
    // 외부 최저가 참고용
    coupangLowestPrice?: number | null;
    naverLowestPrice?: number | null;
  };
}

const formatPrice = (n: number) => n.toLocaleString("ko-KR") + "원";

export default function SellerProductRequest({ product }: SellerProductRequestProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [showModal, setShowModal] = useState(false);
  // 셀러 노출 공급가 (판매가 하한 기준)
  const supply = product.supplyPrice ?? product.basePrice;
  const [priceInput, setPriceInput] = useState("");
  const isCommission = product.priceModel === "COMMISSION";

  // 실제 신청 처리
  const submit = async (sellerPrice: number | null) => {
    setStatus("loading");
    try {
      const res = await fetch("/api/products/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, sellerPrice }),
      });
      if (res.ok) {
        setStatus("done");
        setShowModal(false);
      } else {
        setStatus("idle");
      }
    } catch {
      setStatus("idle");
    }
  };

  // 버튼 클릭: 수수료 제공은 판매가 고정 → 바로 신청, 공급가 제공은 판매가 입력 모달
  const handleClick = () => {
    if (isCommission) {
      submit(null);
    } else {
      setPriceInput("");
      setShowModal(true);
    }
  };

  const priceNum = parseFloat(priceInput);
  const belowSupply = !isNaN(priceNum) && priceNum > 0 && priceNum < supply;
  const canSubmit = !isNaN(priceNum) && priceNum > 0;

  return (
    <>
      <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
        <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
          <SafeImage src={product.thumbnail} placeholder={NO_IMAGE} alt={product.name} width={48} height={48} fallbackText="P" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {product.brandName && <span className="text-[10px] text-gray-400">{product.brandName}</span>}
            {product.categoryName && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{product.categoryName}</span>
            )}
          </div>
          {product.priceModel === "COMMISSION" ? (
            <p className="text-xs font-semibold text-gray-900 mt-0.5">
              <span className="text-[10px] font-normal text-gray-400 mr-1">판매가</span>
              {formatPrice(product.basePrice)}
              {product.commissionRate != null && (
                <span className="text-[10px] font-normal text-brand-500 ml-1.5">· 수수료 {product.commissionRate}%</span>
              )}
            </p>
          ) : (
            <p className="text-xs font-semibold text-gray-900 mt-0.5">
              <span className="text-[10px] font-normal text-gray-400 mr-1">공급가</span>
              {formatPrice(supply)}
              <span className="text-[10px] font-normal text-gray-400 ml-1.5">· 판매가 직접 설정</span>
            </p>
          )}
          {(product.coupangLowestPrice || product.naverLowestPrice) && (
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {product.coupangLowestPrice && (
                <span className="text-[9px] text-gray-400 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded">
                  쿠팡 최저가 {formatPrice(product.coupangLowestPrice)}
                </span>
              )}
              {product.naverLowestPrice && (
                <span className="text-[9px] text-gray-400 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded">
                  네이버 최저가 {formatPrice(product.naverLowestPrice)}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <ProductDetailModal
            productId={product.id}
            productName={product.name}
            triggerClassName="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            triggerLabel="자세히"
          />
          <button
            onClick={handleClick}
            disabled={status !== "idle"}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              status === "done"
                ? "bg-green-100 text-green-700"
                : status === "loading"
                ? "bg-gray-100 text-gray-400"
                : "bg-brand-600 text-white hover:bg-brand-700"
            }`}
          >
            {status === "loading" && <Loader2 size={12} className="animate-spin" />}
            {status === "done" && <Icon name="Check" size={12} />}
            {status === "idle" && <Icon name="Plus" size={12} />}
            {status === "done" ? "신청됨" : status === "loading" ? "신청 중" : "상품 신청"}
          </button>
        </div>
      </div>

      {/* 판매가 입력 모달 (공급가 제공 상품) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => status !== "loading" && setShowModal(false)} />
          <div className="relative bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col animate-slide-up sm:animate-scale-in overflow-hidden">
            {/* Handle bar (mobile) */}
            <div className="flex justify-center pt-2 sm:hidden">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                  <Icon name="Tag" size={18} className="text-brand-600" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-gray-900">판매가 입력</h3>
                  <p className="text-[10px] text-gray-400">판매가를 직접 설정하여 신청하세요</p>
                </div>
              </div>
              <button onClick={() => status !== "loading" && setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 pb-5 space-y-3.5">
              {/* 상품 요약 */}
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                  <SafeImage src={product.thumbnail} placeholder={NO_IMAGE} alt={product.name} width={48} height={48} fallbackText="P" />
                </div>
                <div className="min-w-0">
                  {product.brandName && <span className="text-[10px] text-gray-400 block truncate">{product.brandName}</span>}
                  <p className="text-[13px] font-medium text-gray-900 truncate">{product.name}</p>
                </div>
              </div>

              {/* 공급가 (읽기 전용) */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-gray-50 rounded-xl">
                <span className="text-xs text-gray-500">공급가 (참고용)</span>
                <span className="text-sm font-bold text-gray-900">{formatPrice(supply)}</span>
              </div>

              {/* 판매가 입력 */}
              <div>
                <label className="text-[11px] font-medium text-gray-500 mb-1 block">
                  판매가 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    autoFocus
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    placeholder="판매가를 입력하세요"
                    className={`w-full text-sm pr-8 pl-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 ${
                      belowSupply ? "border-amber-300 focus:ring-amber-200" : "border-gray-200 focus:ring-brand-200"
                    }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                </div>
                {belowSupply && (
                  <p className="mt-1.5 text-[11px] text-amber-600 flex items-center gap-1">
                    <Icon name="Warning" size={11} /> 판매가가 공급가({formatPrice(supply)})보다 낮습니다.
                  </p>
                )}
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 bg-gray-50/50 sm:rounded-b-2xl">
              <div className="flex gap-2">
                <button
                  onClick={() => status !== "loading" && setShowModal(false)}
                  className="flex-1 py-3 bg-white text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-100 transition-colors border border-gray-200"
                >
                  취소
                </button>
                <button
                  onClick={() => submit(priceNum)}
                  disabled={!canSubmit || status === "loading"}
                  className="flex-1 py-3 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {status === "loading" ? <Loader2 size={16} className="animate-spin" /> : <><Icon name="Plus" size={16} /> 신청하기</>}
                </button>
              </div>
            </div>
          </div>

          <style jsx>{`
            @keyframes slide-up { 0% { transform: translateY(100%); } 100% { transform: translateY(0); } }
            .animate-slide-up { animation: slide-up 0.3s ease-out; }
            @keyframes scale-in { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
            .animate-scale-in { animation: scale-in 0.2s ease-out; }
          `}</style>
        </div>
      )}
    </>
  );
}
