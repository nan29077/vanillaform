"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, ImagePlus, Package, Upload, X } from "lucide-react";
import PackageItemSelector, { type SelectedItem } from "@/components/shared/PackageItemSelector";
import { formatPrice } from "@/lib/utils";
import { useAppDialog } from "@/components/shared/AppDialog";

// 단일 이미지 업로더 (패키지 대표 이미지용)
function PackageImageUploader({ onUpload }: { onUpload: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) onUpload(data.url);
    } finally {
      setUploading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      className="w-full h-24 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-1.5 hover:border-brand-400 hover:bg-brand-50 transition-colors"
    >
      {uploading ? (
        <Loader2 size={20} className="animate-spin text-brand-500" />
      ) : (
        <>
          <Upload size={20} className="text-gray-400" />
          <span className="text-xs text-gray-400">이미지 업로드</span>
        </>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </button>
  );
}

interface Props {
  mode: "admin" | "brand" | "seller" | "middle";
  redirectPath?: string;
}

export default function PackageRegisterForm({ mode, redirectPath }: Props) {
  const router = useRouter();
  const { appAlert } = useAppDialog();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"info" | "items">("info");

  const [form, setForm] = useState({
    name: "",
    description: "",
    imageUrl: "",
    packagePrice: "",
    stock: "",
  });

  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      await appAlert("패키지 상품명을 입력하세요.");
      return;
    }
    if (!form.packagePrice || parseFloat(form.packagePrice) <= 0) {
      await appAlert("패키지 판매가를 입력하세요.");
      return;
    }
    if (selectedItems.length < 2) {
      await appAlert("구성 상품을 최소 2개 이상 선택하세요.");
      setStep("items");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/package-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          imageUrl: form.imageUrl,
          packagePrice: parseFloat(form.packagePrice),
          stock: parseInt(form.stock) || 0,
          items: selectedItems.map((item) => ({
            productId: item.productId,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        await appAlert(err.error || "패키지 상품 등록에 실패했습니다.");
        return;
      }

      await appAlert("패키지 상품이 등록됐습니다.\n(최고관리자 승인 후 판매 가능)");
      setShowForm(false);
      setForm({ name: "", description: "", imageUrl: "", packagePrice: "", stock: "" });
      setSelectedItems([]);
      setStep("info");
      if (redirectPath) router.push(redirectPath);
      else router.refresh();
    } catch {
      await appAlert("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
      >
        <Package size={15} />
        패키지 상품 등록
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Package size={18} className="text-brand-600" />
            <h2 className="text-base font-bold text-gray-900">패키지 상품 등록</h2>
          </div>
          <button
            type="button"
            onClick={() => { setShowForm(false); setStep("info"); }}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-gray-100 px-6">
          <button
            type="button"
            onClick={() => setStep("info")}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              step === "info" ? "border-brand-500 text-brand-700" : "border-transparent text-gray-400"
            }`}
          >
            1. 기본 정보
          </button>
          <button
            type="button"
            onClick={() => setStep("items")}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              step === "items" ? "border-brand-500 text-brand-700" : "border-transparent text-gray-400"
            }`}
          >
            2. 구성 상품 선택
            {selectedItems.length > 0 && (
              <span className="ml-1.5 text-xs bg-brand-500 text-black rounded-full px-1.5 py-0.5">
                {selectedItems.length}
              </span>
            )}
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === "info" && (
            <div className="space-y-4">
              {/* 패키지명 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  패키지 상품명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="예: 여름 뷰티 패키지 3종 세트"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>

              {/* 대표 이미지 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  패키지 대표 이미지
                </label>
                <div className="space-y-2">
                  {form.imageUrl ? (
                    <div className="relative w-full h-36 rounded-lg overflow-hidden border border-gray-200">
                      <img src={form.imageUrl} alt="패키지 이미지" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                        className="absolute top-2 right-2 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <PackageImageUploader onUpload={(url) => setForm((f) => ({ ...f, imageUrl: url }))} />
                  )}
                </div>
              </div>

              {/* 패키지 판매가 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  패키지 판매가 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={form.packagePrice}
                    onChange={(e) => setForm((f) => ({ ...f, packagePrice: e.target.value }))}
                    placeholder="구성 상품 합계와 무관하게 설정 가능"
                    min={0}
                    className="w-full px-3 py-2 pr-8 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                </div>
                {form.packagePrice && (
                  <p className="text-xs text-brand-600 mt-1 font-medium">
                    {formatPrice(parseFloat(form.packagePrice))}원
                  </p>
                )}
              </div>

              {/* 재고 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  재고 수량
                </label>
                <input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                  placeholder="0"
                  min={0}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>

              {/* 설명 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  패키지 설명
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="패키지 상품에 대한 설명을 입력하세요."
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                />
              </div>

              <button
                type="button"
                onClick={() => setStep("items")}
                className="w-full py-2.5 bg-brand-500 text-black text-sm font-bold rounded-lg hover:bg-brand-600 transition-colors"
              >
                다음: 구성 상품 선택 →
              </button>
            </div>
          )}

          {step === "items" && (
            <PackageItemSelector
              selected={selectedItems}
              onChange={setSelectedItems}
            />
          )}
        </div>

        {/* 하단 버튼 */}
        {step === "items" && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep("info")}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← 이전
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || selectedItems.length < 2}
              className="flex-1 py-2.5 bg-brand-500 text-black text-sm font-bold rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? "등록 중..." : `패키지 상품 등록 (구성 ${selectedItems.length}개)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
