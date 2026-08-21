"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useEffect } from "react";
import {Plus, X, Loader2, Hash} from 'lucide-react';
import SafeImage from "./SafeImage";
import ImageUploader from "./ImageUploader";
import { useAppDialog } from "@/components/shared/AppDialog";

interface Product {
  id: string;
  name: string;
  thumbnail: string | null;
  basePrice: number;
  brandName: string | null;
  categoryName: string | null;
  allowGroupBuy: boolean;
}

export default function SellerGroupBuyForm() {
    const { appConfirm, appAlert } = useAppDialog();
const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [step, setStep] = useState<"select" | "config">("select");

  const [campaign, setCampaign] = useState({
    title: "",
    campaignPrice: "",
    goalQuantity: "",
    minOrderQuantity: "1",
    maxOrderQuantity: "",
    limitPerPerson: "10",
    startDate: "",
    endDate: "",
    description: "",
    bannerImage: "",
    estimatedDelivery: "",
  });

  useEffect(() => {
    if (showForm) {
      fetch("/api/seller/available-products?type=groupbuy")
        .then((r) => r.json())
        .then((d) => setProducts(d.products || []))
        .catch(() => {});
    }
  }, [showForm]);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatPrice = (n: number) => n.toLocaleString("ko-KR") + "원";

  const discountPercent =
    selectedProduct && campaign.campaignPrice
      ? Math.round(
          ((selectedProduct.basePrice - parseFloat(campaign.campaignPrice)) /
            selectedProduct.basePrice) *
            100
        )
      : 0;

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setCampaign((prev) => ({
      ...prev,
      title: `${product.name} 공동구매`,
      campaignPrice: String(product.basePrice),
    }));
    setStep("config");
  };

  const handleSubmit = async () => {
    if (!selectedProduct) return;
    if (!campaign.campaignPrice || !campaign.startDate || !campaign.endDate) {
      appAlert("가격, 시작일, 종료일은 필수입니다.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/seller/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProduct.id,
          title: campaign.title || `${selectedProduct.name} 공동구매`,
          campaignPrice: parseFloat(campaign.campaignPrice),
          originalPrice: selectedProduct.basePrice,
          goalQuantity: campaign.goalQuantity ? parseInt(campaign.goalQuantity) : null,
          minOrderQuantity: parseInt(campaign.minOrderQuantity) || 1,
          maxOrderQuantity: campaign.maxOrderQuantity ? parseInt(campaign.maxOrderQuantity) : null,
          limitPerPerson: parseInt(campaign.limitPerPerson) || 10,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          description: campaign.description || null,
          bannerImage: campaign.bannerImage || null,
          estimatedDelivery: campaign.estimatedDelivery || null,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setSelectedProduct(null);
        setStep("select");
        setCampaign({ title: "", campaignPrice: "", goalQuantity: "", minOrderQuantity: "1", maxOrderQuantity: "", limitPerPerson: "10", startDate: "", endDate: "", description: "", bannerImage: "", estimatedDelivery: "" });
        window.location.reload();
      } else {
        const data = await res.json();
        await appAlert(data.error || "등록 실패");
      }
    } catch {}
    setLoading(false);
  };

  return (
    <>
      <button onClick={() => setShowForm(true)} className="btn-primary text-sm !px-3 !py-2 sm:!px-4 sm:!py-2.5 whitespace-nowrap">
        <Icon name="Cart" size={14} className="mr-1" />
        <span className="hidden sm:inline">공동구매 등록</span><span className="sm:hidden">공구</span>
      </button>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-white sm:bg-black/40 sm:flex sm:items-start sm:justify-center sm:p-4 overflow-hidden">
          <div className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:shadow-2xl sm:max-w-lg flex flex-col overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Icon name="Cart" size={18} className="text-brand-600" />
                <h3 className="text-lg font-bold text-gray-900">
                  {step === "select" ? "상품 선택" : "공동구매 설정"}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {step === "config" && (
                  <button onClick={() => setStep("select")} className="text-xs text-gray-500 hover:text-gray-900">
                    ← 다시 선택
                  </button>
                )}
                <button onClick={() => { setShowForm(false); setStep("select"); setSelectedProduct(null); }} className="p-1 rounded-lg hover:bg-gray-100">
                  <X size={20} className="text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-5 max-h-[65vh] overflow-y-auto">
              {step === "select" && (
                <div className="space-y-4">
                  <div className="bg-brand-50 rounded-xl p-3 mb-2">
                    <p className="text-xs text-brand-600">내 상품 또는 브랜드/관리자가 공동구매로 등록한 상품을 선택하세요.</p>
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      className="input-field pl-9"
                      placeholder="상품명 검색..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Product list */}
                  {filteredProducts.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <Icon name="Cart" size={36} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs">
                        {products.length === 0
                          ? "먼저 상품을 등록해주세요"
                          : "검색 결과가 없습니다"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredProducts.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => handleSelectProduct(product)}
                          className="w-full flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-brand-300 hover:bg-brand-50/30 transition-all text-left"
                        >
                          <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                            <SafeImage src={product.thumbnail} alt={product.name} width={48} height={48} fallbackText="P" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {product.brandName && <span className="text-[10px] text-gray-400">{product.brandName}</span>}
                              {product.categoryName && (
                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{product.categoryName}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-semibold">{formatPrice(product.basePrice)}</p>
                            <span className="text-[10px] text-brand-600">선택 →</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {step === "config" && selectedProduct && (
                <div className="space-y-4">
                  {/* Selected product info */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                      <SafeImage src={selectedProduct.thumbnail} alt={selectedProduct.name} width={48} height={48} fallbackText="P" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{selectedProduct.name}</p>
                      <p className="text-xs text-gray-400">정가: {formatPrice(selectedProduct.basePrice)}</p>
                    </div>
                    <Icon name="Check" size={18} className="text-green-500 flex-shrink-0" />
                  </div>

                  {/* Campaign Title */}
                  <div>
                    <label className="text-sm font-medium text-gray-700">캠페인 제목 *</label>
                    <input
                      type="text" className="input-field mt-1" placeholder="예: 봄맞이 특가 공동구매"
                      value={campaign.title}
                      onChange={(e) => setCampaign({ ...campaign, title: e.target.value })}
                    />
                  </div>

                  {/* Price */}
                  <div>
                    <label className="text-sm font-medium text-gray-700">공동구매 가격 *</label>
                    <input
                      type="number" className="input-field mt-1" placeholder="0"
                      value={campaign.campaignPrice}
                      onChange={(e) => setCampaign({ ...campaign, campaignPrice: e.target.value })}
                    />
                    {discountPercent > 0 && (
                      <p className="text-xs text-brand-600 mt-1 flex items-center gap-1">
                        <Icon name="Discount" size={12} />
                        정가 대비 {discountPercent}% 할인
                      </p>
                    )}
                  </div>

                  {/* Goal & Limits */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <Icon name="Users" size={13} /> 목표 수량
                      </label>
                      <input
                        type="number" className="input-field mt-1" placeholder="예: 100"
                        value={campaign.goalQuantity}
                        onChange={(e) => setCampaign({ ...campaign, goalQuantity: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <Hash size={13} /> 1인당 최대
                      </label>
                      <input
                        type="number" className="input-field mt-1" placeholder="10"
                        value={campaign.limitPerPerson}
                        onChange={(e) => setCampaign({ ...campaign, limitPerPerson: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">최소 주문 수량</label>
                      <input
                        type="number" className="input-field mt-1" placeholder="1"
                        value={campaign.minOrderQuantity}
                        onChange={(e) => setCampaign({ ...campaign, minOrderQuantity: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">최대 주문 수량</label>
                      <input
                        type="number" className="input-field mt-1" placeholder="제한 없음"
                        value={campaign.maxOrderQuantity}
                        onChange={(e) => setCampaign({ ...campaign, maxOrderQuantity: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <Icon name="Calendar" size={13} /> 시작일 *
                      </label>
                      <input
                        type="datetime-local" className="input-field mt-1 text-sm"
                        value={campaign.startDate}
                        onChange={(e) => setCampaign({ ...campaign, startDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <Icon name="Calendar" size={13} /> 종료일 *
                      </label>
                      <input
                        type="datetime-local" className="input-field mt-1 text-sm"
                        value={campaign.endDate}
                        onChange={(e) => setCampaign({ ...campaign, endDate: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Estimated Delivery */}
                  <div>
                    <label className="text-sm font-medium text-gray-700">예상 배송일</label>
                    <input
                      type="date" className="input-field mt-1 text-sm"
                      value={campaign.estimatedDelivery}
                      onChange={(e) => setCampaign({ ...campaign, estimatedDelivery: e.target.value })}
                    />
                  </div>

                  {/* Banner - file upload support */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">캠페인 배너 이미지</label>
                    <ImageUploader
                      images={campaign.bannerImage ? [campaign.bannerImage] : []}
                      onChange={(urls) => setCampaign({ ...campaign, bannerImage: urls[0] || "" })}
                      maxImages={1}
                      label="배너 이미지"
                      compact
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-sm font-medium text-gray-700">공동구매 설명</label>
                    <textarea
                      className="input-field mt-1 h-20 resize-none text-sm" placeholder="공동구매에 대한 추가 설명..."
                      value={campaign.description}
                      onChange={(e) => setCampaign({ ...campaign, description: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {step === "config" && (
              <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
                <button onClick={() => setStep("select")} className="btn-outline flex-1 py-2.5">← 상품 변경</button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !campaign.campaignPrice || !campaign.startDate || !campaign.endDate}
                  className="btn-primary flex-1 py-2.5"
                >
                  {loading ? <Loader2 size={16} className="animate-spin mr-1" /> : <Icon name="Cart" size={16} className="mr-1" />}
                  {loading ? "등록 중..." : "공동구매 등록"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
