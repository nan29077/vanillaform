"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Loader2, Package, Pencil, Trash2, Store } from "lucide-react";
import Image from "next/image";
import SafeImage from "@/components/shared/SafeImage";
import ImageUploader from "@/components/shared/ImageUploader";
import { DEFAULT_PRODUCT_IMAGE } from "@/lib/defaults";
import { useAppDialog } from "@/components/shared/AppDialog";
import BulkProductRegister from "@/components/shared/BulkProductRegister";

interface DirectProduct {
  id: string;
  name: string;
  price: number;
  shippingFee: number;
  description: string | null;
  images: string[];
  stock: number;
  isActive: boolean;
  createdAt: string;
}

const formatPrice = (n: number) => n.toLocaleString("ko-KR") + "원";

const emptyForm = { name: "", price: "", shippingFee: "", stock: "", description: "", images: [] as string[] };

export default function SellerDirectProducts() {
  const { appAlert, appConfirm } = useAppDialog();
  const [products, setProducts] = useState<DirectProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DirectProduct | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  // 셀러샵 일반상품 탭 노출 스위치
  const [showOwnTab, setShowOwnTab] = useState(false);
  const [loadingTab, setLoadingTab] = useState(true);
  const [savingTab, setSavingTab] = useState(false);

  const loadTabState = useCallback(async () => {
    setLoadingTab(true);
    try {
      const res = await fetch("/api/seller/shop-exposure");
      if (res.ok) {
        const d = await res.json();
        setShowOwnTab(!!d.isEnabled);
      }
    } catch {} finally {
      setLoadingTab(false);
    }
  }, []);

  const handleToggleOwnTab = async () => {
    const next = !showOwnTab;
    setSavingTab(true);
    try {
      const res = await fetch("/api/seller/shop-exposure", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: next }),
      });
      if (res.ok) {
        setShowOwnTab(next);
      } else {
        const d = await res.json().catch(() => ({}));
        await appAlert(d.error || "변경에 실패했습니다.");
      }
    } catch {
      await appAlert("오류가 발생했습니다.");
    } finally {
      setSavingTab(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/seller/direct-products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); loadTabState(); }, [load, loadTabState]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (p: DirectProduct) => {
    setEditing(p);
    setForm({
      name: p.name,
      price: String(p.price),
      shippingFee: String(p.shippingFee ?? 0),
      stock: String(p.stock),
      description: p.description || "",
      images: p.images || [],
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { await appAlert("상품명을 입력해주세요."); return; }
    if (!form.price || Number(form.price) < 0) { await appAlert("올바른 판매가격을 입력해주세요."); return; }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        price: Number(form.price),
        shippingFee: form.shippingFee ? Number(form.shippingFee) : 0,
        stock: form.stock ? Number(form.stock) : 0,
        description: form.description.trim() || null,
        images: form.images,
      };
      const res = editing
        ? await fetch(`/api/seller/direct-products/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/seller/direct-products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        setShowForm(false);
        await load();
      } else {
        const d = await res.json().catch(() => ({}));
        await appAlert(d.error || "저장에 실패했습니다.");
      }
    } catch {
      await appAlert("오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (p: DirectProduct) => {
    setToggling(p.id);
    try {
      const res = await fetch(`/api/seller/direct-products/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !p.isActive }),
      });
      if (res.ok) {
        setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, isActive: !x.isActive } : x)));
      } else {
        const d = await res.json().catch(() => ({}));
        await appAlert(d.error || "변경에 실패했습니다.");
      }
    } catch {
      await appAlert("오류가 발생했습니다.");
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (p: DirectProduct) => {
    if (!await appConfirm({ message: `'${p.name}' 상품을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`, type: "warning", confirmText: "삭제" })) return;
    try {
      const res = await fetch(`/api/seller/direct-products/${p.id}`, { method: "DELETE" });
      if (res.ok) {
        setProducts((prev) => prev.filter((x) => x.id !== p.id));
      } else {
        const d = await res.json().catch(() => ({}));
        await appAlert(d.error || "삭제에 실패했습니다.");
      }
    } catch {
      await appAlert("오류가 발생했습니다.");
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 일반상품 탭 노출 활성화 배너 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Store size={15} strokeWidth={1.5} className="text-yellow-600" />
            <span className="text-sm font-bold text-gray-800">일반상품 탭 노출 활성화</span>
          </div>
          {loadingTab ? (
            <Loader2 size={16} className="animate-spin text-gray-400" />
          ) : (
            <button
              onClick={handleToggleOwnTab}
              disabled={savingTab}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 ${showOwnTab ? "bg-yellow-400" : "bg-gray-300"}`}
            >
              {savingTab ? (
                <Loader2 size={12} className="animate-spin text-white mx-auto" />
              ) : (
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${showOwnTab ? "translate-x-5" : "translate-x-0.5"}`} />
              )}
            </button>
          )}
        </div>
        <div className="text-[12px] text-gray-600 space-y-0.5 leading-relaxed">
          <p className="flex items-center gap-1"><Image src="/favicon.svg" alt="" width={16} height={16} className="inline-block shrink-0" /> <span><strong>빠른 상품 등록이란?</strong> 방송 중 빠르게 상품을 올려야 할 때 사용하세요.</span></p>
          <p className="flex items-center gap-1"><Image src="/favicon.svg" alt="" width={16} height={16} className="inline-block shrink-0" /> <span>스위치를 켜면 셀러샵에 <strong>일반상품 탭</strong>이 생기고, 구매자가 탭을 통해 상품을 볼 수 있습니다.</span></p>
          <p className="flex items-center gap-1"><Image src="/favicon.svg" alt="" width={16} height={16} className="inline-block shrink-0" /> <span>방송 중이 아닐 때도 상품을 판매하고 싶다면 등록 후 <strong>노출하기</strong>를 눌러주세요.</span></p>
          <p className="flex items-center gap-1"><Image src="/favicon.svg" alt="" width={16} height={16} className="inline-block shrink-0" /> <span>샵관리 &gt; 일반상품 탭의 노출 스위치와 자동으로 동기화됩니다.</span></p>
        </div>
      </div>

      {/* 상단: 등록 버튼 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package size={16} strokeWidth={1.5} className="text-brand-500" />
          <h2 className="text-sm font-bold text-gray-700">일반상품 <span className="text-brand-500 font-semibold">(빠른상품 등록)</span></h2>
          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{products.length}개</span>
        </div>
        <div className="flex items-center gap-2">
          {/* 일반상품 엑셀 대량 등록 (일반상품 전용 양식) */}
          <BulkProductRegister mode="seller" kind="direct" onSuccess={load} />
          <button
            onClick={openCreate}
            className="text-[12px] px-3 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-1 font-bold transition-colors whitespace-nowrap"
          >
            <Plus size={14} /> 일반상품 등록
          </button>
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Package size={40} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">등록된 일반상품이 없습니다.</p>
          <p className="text-xs mt-1">직접 상품을 등록해 셀러샵에 노출해보세요.</p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-brand-500 text-white text-xs font-bold rounded-lg hover:bg-brand-600"
          >
            <Plus size={14} /> 일반상품 등록
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {products.map((p) => (
            <div key={p.id} className={`bg-white rounded-lg border overflow-hidden transition-all ${p.isActive ? "border-gray-100 hover:shadow-md" : "border-gray-100 opacity-70"}`}>
              <div className="h-28 bg-gray-100 relative overflow-hidden">
                <SafeImage src={p.images[0] || null} placeholder={DEFAULT_PRODUCT_IMAGE} alt={p.name} width={200} height={200} fallbackText="No Img" className="w-full h-full object-contain" />
                {!p.isActive && (
                  <span className="absolute top-1 left-1 text-[9px] font-bold bg-gray-500 text-white px-1.5 py-0.5 rounded-full leading-none">판매중지</span>
                )}
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-tight mb-0.5">{p.name}</p>
                <p className="text-sm font-bold text-gray-900">{formatPrice(p.price)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  재고 {p.stock}개 · {p.shippingFee > 0 ? `배송비 ${formatPrice(p.shippingFee)}` : "무료배송"}
                </p>

                {/* 활성화 스위치 */}
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">{p.isActive ? "판매중" : "판매중지"}</span>
                  <button
                    onClick={() => handleToggleActive(p)}
                    disabled={toggling === p.id}
                    className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${p.isActive ? "bg-brand-500" : "bg-gray-300"}`}
                    title={p.isActive ? "판매중지" : "판매시작"}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${p.isActive ? "translate-x-3.5" : "translate-x-0.5"}`} />
                  </button>
                </div>

                {/* 수정 / 삭제 */}
                <div className="mt-1.5 flex items-center gap-1">
                  <button
                    onClick={() => openEdit(p)}
                    className="flex-1 text-[10px] py-1.5 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-0.5"
                  >
                    <Pencil size={10} /> 수정
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    className="text-[10px] py-1.5 px-2 bg-red-50 text-red-500 rounded-lg font-medium hover:bg-red-100 transition-colors flex items-center justify-center"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 등록/수정 폼 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl sm:shadow-2xl sm:my-6 min-h-screen sm:min-h-0 flex flex-col max-h-screen sm:max-h-[90vh]">
            {/* Header */}
            <div className="flex-shrink-0 px-4 sm:px-6 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{editing ? "일반상품 수정" : "일반상품 등록(빠른상품 등록)"}</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5 space-y-5">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">상품명 <span className="text-red-500">*</span></label>
                <input type="text" className="input-field text-sm" placeholder="상품명을 입력하세요" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">판매가격 <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type="number" min="0" className="input-field text-sm pr-8" placeholder="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">재고수량</label>
                  <div className="relative">
                    <input type="number" min="0" className="input-field text-sm pr-8" placeholder="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">개</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">배송비</label>
                <div className="relative">
                  <input type="number" min="0" className="input-field text-sm pr-8" placeholder="0" value={form.shippingFee} onChange={(e) => setForm({ ...form, shippingFee: e.target.value })} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">비워두거나 0원으로 두면 무료배송으로 표시됩니다.</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">상품설명</label>
                <textarea className="input-field h-24 resize-none text-sm" placeholder="상품에 대한 설명을 입력하세요" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">상품 이미지 <span className="text-gray-400 font-normal">(최대 5장)</span></label>
                <ImageUploader images={form.images} onChange={(imgs) => setForm({ ...form, images: imgs })} maxImages={5} />
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-t border-gray-100">
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline flex-1 py-2.5 text-sm">취소</button>
                <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                  {saving ? "저장 중..." : editing ? "수정 완료" : "등록"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
