"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import {X, Link2, Loader2, ChevronDown} from 'lucide-react';
import RejectReasonModal from "@/components/shared/RejectReasonModal";

interface Brand {
  id: string;
  brandName: string;
}

interface AdminProductActionsProps {
  type: "register" | "approve_shop" | "link_brand" | "approve_product";
  brands: Brand[];
  shopProductId?: string;
  productId?: string;
}

export default function AdminProductActions({ type, brands, shopProductId, productId }: AdminProductActionsProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [form, setForm] = useState({ name: "", basePrice: "", description: "", brandId: "" });
  const [showMarginInput, setShowMarginInput] = useState(false);
  const [adminMargin, setAdminMargin] = useState(0);

  const handleApproveShopProduct = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/products/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_shop_product", shopProductId }),
      });
      if (res.ok) {
        setDone(true);
        setTimeout(() => window.location.reload(), 500);
      }
    } catch {}
    setLoading(false);
  };

  const handleRejectShopProduct = async (rejectionReason: string) => {
    setLoading(true);
    try {
      await fetch("/api/admin/products/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject_shop_product", shopProductId, rejectionReason }),
      });
      setShowRejectModal(false);
      setDone(true);
      setTimeout(() => window.location.reload(), 500);
    } catch {}
    setLoading(false);
  };

  const handleApproveProduct = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/products/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_product", productId, adminMargin }),
      });
      if (res.ok) {
        setDone(true);
        setTimeout(() => window.location.reload(), 500);
      }
    } catch {}
    setLoading(false);
  };

  const handleLinkBrand = async () => {
    if (!selectedBrand) return;
    setLoading(true);
    try {
      await fetch("/api/admin/products/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "link_brand", productId, brandId: selectedBrand }),
      });
      setDone(true);
      setTimeout(() => window.location.reload(), 500);
    } catch {}
    setLoading(false);
  };

  const handleRegisterProduct = async () => {
    if (!form.name || !form.basePrice) return;
    setLoading(true);
    try {
      const res = await fetch("/api/products/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          basePrice: parseFloat(form.basePrice),
          description: form.description,
          brandId: form.brandId || null,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        window.location.reload();
      }
    } catch {}
    setLoading(false);
  };

  if (type === "approve_product") {
    if (done) return <span className="text-[10px] text-green-600 font-medium">승인됨</span>;
    if (showMarginInput) {
      return (
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg bg-white px-2 py-1">
            <span className="text-[10px] text-gray-500 whitespace-nowrap">마진</span>
            <input
              type="number"
              min={0}
              step={100}
              value={adminMargin}
              onChange={(e) => setAdminMargin(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-16 text-[11px] text-gray-900 text-right border-none outline-none bg-transparent"
              placeholder="0"
              autoFocus
            />
            <span className="text-[10px] text-gray-500">원</span>
          </div>
          <button
            onClick={handleApproveProduct}
            disabled={loading}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors text-[10px] font-medium"
          >
            {loading ? <Loader2 size={10} className="animate-spin" /> : <Icon name="Certified" size={10} />}
            승인
          </button>
          <button
            onClick={() => setShowMarginInput(false)}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <X size={10} />
          </button>
        </div>
      );
    }
    return (
      <button
        onClick={() => setShowMarginInput(true)}
        disabled={loading}
        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors text-[10px] font-medium"
        title="상품 승인 (마진 설정)"
      >
        <Icon name="Certified" size={10} />
        승인
      </button>
    );
  }

  if (type === "register") {
    return (
      <>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary text-sm"
        >
          <Icon name="Plus" size={16} className="mr-1" />
          상품 등록
        </button>

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h3 className="text-lg font-bold mb-4">새 상품 등록</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">상품명 *</label>
                  <input
                    type="text"
                    className="input-field mt-1"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="상품명"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">기본가 *</label>
                  <input
                    type="number"
                    className="input-field mt-1"
                    value={form.basePrice}
                    onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                    placeholder="가격"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">브랜드</label>
                  <select
                    className="input-field mt-1"
                    value={form.brandId}
                    onChange={(e) => setForm({ ...form, brandId: e.target.value })}
                  >
                    <option value="">브랜드 선택 (선택사항)</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.brandName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">설명</label>
                  <textarea
                    className="input-field mt-1 h-20 resize-none"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="상품 설명"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowForm(false)} className="btn-outline flex-1 py-2">
                  취소
                </button>
                <button onClick={handleRegisterProduct} disabled={loading} className="btn-primary flex-1 py-2">
                  {loading ? "등록 중..." : "등록"}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (type === "approve_shop") {
    if (done) return <span className="text-xs text-green-600 font-medium">잘리 완료</span>;
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleApproveShopProduct}
          disabled={loading}
          className="flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <><Icon name="Check" size={12} className="shrink-0" /> 승인</>}
        </button>
        <button
          onClick={() => setShowRejectModal(true)}
          disabled={loading}
          className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          <X size={12} className="shrink-0" /> 반려
        </button>
        {showRejectModal && (
          <RejectReasonModal
            loading={loading}
            onCancel={() => setShowRejectModal(false)}
            onConfirm={handleRejectShopProduct}
          />
        )}
      </div>
    );
  }

  if (type === "link_brand") {
    if (done) return <span className="text-[10px] text-green-600">연결됨</span>;
    return (
      <div className="flex items-center gap-1">
        <select
          className="text-[10px] border rounded px-1 py-0.5"
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
        >
          <option value="">브랜드</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.brandName}</option>
          ))}
        </select>
        {selectedBrand && (
          <button
            onClick={handleLinkBrand}
            className="p-0.5 rounded bg-brand-600 text-white"
            title="연결"
          >
            <Link2 size={10} />
          </button>
        )}
      </div>
    );
  }

  return null;
}
