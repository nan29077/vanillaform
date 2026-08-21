"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Package, Check, Store } from "lucide-react";
import SafeImage from "@/components/shared/SafeImage";
import { DEFAULT_PRODUCT_IMAGE } from "@/lib/defaults";
import { useAppDialog } from "@/components/shared/AppDialog";

interface DirectProduct {
  id: string;
  name: string;
  price: number;
  images: string[];
  stock: number;
  isActive: boolean;
}

const formatPrice = (n: number) => n.toLocaleString("ko-KR") + "원";

export default function ShopDirectExposureManager() {
  const { appAlert } = useAppDialog();
  const [loading, setLoading] = useState(true);
  const [isEnabled, setIsEnabled] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [products, setProducts] = useState<DirectProduct[]>([]);
  const [savingToggle, setSavingToggle] = useState(false);
  const [savingSelection, setSavingSelection] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [expRes, prodRes] = await Promise.all([
        fetch("/api/seller/shop-exposure"),
        fetch("/api/seller/direct-products"),
      ]);
      if (expRes.ok) {
        const d = await expRes.json();
        setIsEnabled(!!d.isEnabled);
        setSelectedIds(new Set(Array.isArray(d.productIds) ? d.productIds : []));
      }
      if (prodRes.ok) {
        const d = await prodRes.json();
        setProducts(d.products || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async () => {
    const next = !isEnabled;
    setSavingToggle(true);
    try {
      const res = await fetch("/api/seller/shop-exposure", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: next }),
      });
      if (res.ok) {
        setIsEnabled(next);
      } else {
        const d = await res.json().catch(() => ({}));
        await appAlert(d.error || "변경에 실패했습니다.");
      }
    } catch {
      await appAlert("오류가 발생했습니다.");
    } finally {
      setSavingToggle(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveSelection = async () => {
    setSavingSelection(true);
    try {
      const res = await fetch("/api/seller/shop-exposure", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: Array.from(selectedIds) }),
      });
      if (res.ok) {
        await appAlert("저장되었습니다.");
      } else {
        const d = await res.json().catch(() => ({}));
        await appAlert(d.error || "저장에 실패했습니다.");
      }
    } catch {
      await appAlert("오류가 발생했습니다.");
    } finally {
      setSavingSelection(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 안내 문구 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Store size={16} strokeWidth={1.5} className="text-brand-500" />
          <h3 className="text-sm font-bold text-gray-900">일반상품 노출</h3>
        </div>
        <p className="text-[12px] text-gray-500 leading-relaxed">
          셀러샵에 일반상품 탭을 노출할지 설정합니다. 스위치를 켜면 아래에서 선택한 상품들이 셀러샵 &lsquo;일반상품&rsquo; 탭에 노출됩니다.
          스위치를 끄면 셀러샵에서 일반상품 탭이 완전히 사라집니다.
        </p>

        {/* 노출 스위치 */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
          <span className="text-sm font-medium text-gray-700">셀러샵 일반상품 탭 노출</span>
          <button
            onClick={handleToggle}
            disabled={savingToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 ${isEnabled ? "bg-brand-500" : "bg-gray-300"}`}
          >
            {savingToggle ? (
              <Loader2 size={12} className="animate-spin text-white mx-auto" />
            ) : (
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
            )}
          </button>
        </div>
      </div>

      {/* 스위치 상태별 UI */}
      {isEnabled ? (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-[12px] text-gray-500 mb-3">선택된 상품들이 셀러샵 일반상품 탭에 노출됩니다.</p>

          {products.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Package size={36} strokeWidth={1.5} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs">등록된 일반상품이 없습니다.</p>
              <p className="text-[11px] mt-1">상품관리 &gt; 일반상품 탭에서 먼저 상품을 등록하세요.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {products.map((p) => {
                  const checked = selectedIds.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleSelect(p.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${
                        checked ? "border-brand-300 bg-brand-50/40" : "border-gray-100 bg-white hover:border-gray-200"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? "border-brand-500 bg-brand-500" : "border-gray-300"}`}>
                        {checked && <Check size={12} className="text-white" />}
                      </div>
                      <div className="w-11 h-11 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                        <SafeImage src={p.images[0] || null} placeholder={DEFAULT_PRODUCT_IMAGE} alt={p.name} width={64} height={64} fallbackText="No Img" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-gray-900 truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-bold text-gray-900">{formatPrice(p.price)}</span>
                          <span className="text-[10px] text-gray-400">재고 {p.stock}개</span>
                          {!p.isActive && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">판매중지</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
                <span className="text-[11px] text-gray-400">{selectedIds.size}개 선택됨</span>
                <button
                  onClick={handleSaveSelection}
                  disabled={savingSelection}
                  className="px-4 py-2 bg-brand-500 text-white text-sm font-bold rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 disabled:opacity-60"
                >
                  {savingSelection ? <Loader2 size={16} className="animate-spin" /> : null}
                  저장
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl">
          <Store size={36} strokeWidth={1.5} className="mx-auto mb-2 opacity-30" />
          <p className="text-xs">현재 셀러샵에 일반상품 탭이 노출되지 않습니다.</p>
        </div>
      )}
    </div>
  );
}
