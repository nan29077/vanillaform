"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import {X, Loader2} from 'lucide-react';

export interface DraftCoupon {
  code: string | null;
  discountType: "PERCENT" | "AMOUNT" | "PURCHASE";
  discountValue: number;
  minOrderAmount: number;
  maxIssueCount: number | null;
  validDays: number;
  productId?: string | null; // PURCHASE 타입 전용
  productName?: string; // UI 표시용
}

interface ImportCoupon {
  source: "game" | "live";
  sourceLabel: string;
  code: string | null;
  discountType: string;
  discountValue: number;
  minOrderAmount: number;
  maxIssueCount: number | null;
  validDays: number;
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-400";

// 게임 생성 폼용 쿠폰 초안 편집기 — 게임 생성 후 쿠폰 API 로 일괄 등록된다.
export default function GameCouponDraft({
  value,
  onChange,
  onToast,
}: {
  value: DraftCoupon[];
  onChange: (list: DraftCoupon[]) => void;
  onToast?: (msg: string, ok?: boolean) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENT" | "AMOUNT" | "PURCHASE">("PERCENT");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [maxIssueCount, setMaxIssueCount] = useState("");
  const [validDays, setValidDays] = useState("7");
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [importList, setImportList] = useState<ImportCoupon[]>([]);
  const [importLoading, setImportLoading] = useState(false);

  const toast = (m: string, ok = true) => onToast?.(m, ok);

  const reset = () => {
    setCode(""); setDiscountType("PERCENT"); setDiscountValue("");
    setMinOrderAmount(""); setMaxIssueCount(""); setValidDays("7");
    setProductId(""); setProductName("");
  };

  // PURCHASE 타입 선택 시 셀러 상품 목록 로드
  const handleTypeChange = async (t: "PERCENT" | "AMOUNT" | "PURCHASE") => {
    setDiscountType(t);
    if (t === "PURCHASE" && products.length === 0) {
      try {
        const res = await fetch("/api/seller/available-products", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const list = (data.products || []).map((p: any) => ({ id: p.id, name: p.name || p.title || String(p.id) }));
          setProducts(list);
        }
      } catch { /* ignore */ }
    }
  };

  const add = () => {
    const v = Number(discountValue);
    if (!Number.isFinite(v) || v <= 0) return toast("할인 값을 입력해주세요", false);
    if (discountType === "PERCENT" && v > 100) return toast("정률 할인은 100%를 넘을 수 없습니다", false);
    if (discountType === "PURCHASE" && !productId) return toast("구매권 상품을 선택해주세요", false);
    onChange([
      ...value,
      {
        code: code.trim() ? code.trim().toUpperCase() : null,
        discountType,
        discountValue: Math.floor(v),
        minOrderAmount: discountType === "PURCHASE" ? 0 : (Number(minOrderAmount) || 0),
        maxIssueCount: maxIssueCount.trim() ? Number(maxIssueCount) : null,
        validDays: Number(validDays) || 7,
        ...(discountType === "PURCHASE" ? { productId, productName } : {}),
      },
    ]);
    reset();
    setShowForm(false);
  };

  const openImport = async () => {
    setShowImport(true);
    setImportLoading(true);
    try {
      const res = await fetch(`/api/seller/games/coupons`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setImportList(data.coupons || []);
      }
    } catch {
      /* ignore */
    } finally {
      setImportLoading(false);
    }
  };

  const applyImport = (c: ImportCoupon) => {
    onChange([
      ...value,
      {
        code: c.code ?? null,
        discountType: c.discountType === "AMOUNT" ? "AMOUNT" : "PERCENT",
        discountValue: c.discountValue,
        minOrderAmount: c.minOrderAmount || 0,
        maxIssueCount: c.maxIssueCount ?? null,
        validDays: c.validDays,
      },
    ]);
    setShowImport(false);
  };

  const label = (c: DraftCoupon | ImportCoupon) =>
    c.discountType === "PERCENT"
      ? `${c.discountValue}% 할인`
      : c.discountType === "PURCHASE"
        ? `${c.discountValue.toLocaleString()}원 구매권`
        : `${c.discountValue.toLocaleString()}원 할인`;

  return (
    <div className="mb-4 p-3.5 rounded-xl bg-amber-50/40 border border-amber-100">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
          <Icon name="Gift" size={13} className="text-amber-500" /> 게임 쿠폰 <span className="text-gray-300 font-normal">(선택)</span>
        </label>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={openImport}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-gray-200 hover:border-amber-300 text-gray-500 text-[11px] font-semibold transition-colors"
          >
            <Icon name="Download" size={11} /> 불러오기
          </button>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold transition-colors"
          >
            {showForm ? <X size={11} /> : <Icon name="Plus" size={11} />} 쿠폰 추가
          </button>
        </div>
      </div>
      <p className="text-[11px] text-gray-400 mb-2 leading-relaxed">
        당첨자에게 자동 발급되는 쿠폰입니다. 생성 후 상세 페이지에서도 추가·수정할 수 있습니다.
      </p>

      {/* 추가된 쿠폰 목록 */}
      {value.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {value.map((c, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-amber-100 bg-white px-3 py-2">
              <div className="w-6 h-6 rounded bg-amber-100 flex items-center justify-center shrink-0">
                {c.discountType === "PERCENT" ? <Icon name="Discount" size={12} className="text-amber-600" />
                  : c.discountType === "PURCHASE" ? <Icon name="Cart" size={12} className="text-amber-600" />
                  : <Icon name="Wallet" size={12} className="text-amber-600" />}
              </div>
              <span className="text-[12px] font-bold text-gray-800">{label(c)}</span>
              {c.discountType === "PURCHASE" && (c as DraftCoupon).productName && (
                <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold truncate max-w-[80px]">{(c as DraftCoupon).productName}</span>
              )}
              <span className="text-[11px] font-mono text-gray-400">{c.code || "자동생성"}</span>
              <span className="text-[11px] text-gray-400 ml-auto">
                {c.maxIssueCount != null ? `${c.maxIssueCount}장` : "무제한"} · {c.validDays}일
              </span>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
              >
                <Icon name="Delete" size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 추가 폼 */}
      {showForm && (
        <div className="rounded-lg border border-amber-100 bg-white p-3 space-y-2.5">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="쿠폰 코드 (비워두면 자동 생성)"
            maxLength={30}
            className={inputCls}
          />
          <div className="grid grid-cols-3 gap-2">
            {(["PERCENT", "AMOUNT", "PURCHASE"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTypeChange(t)}
                className={`flex items-center justify-center gap-1 py-2 rounded-lg border-2 text-[12px] font-semibold transition-all ${
                  discountType === t ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 bg-white text-gray-500"
                }`}
              >
                {t === "PERCENT" ? <Icon name="Discount" size={12} /> : t === "PURCHASE" ? <Icon name="Cart" size={12} /> : <Icon name="Wallet" size={12} />}
                {t === "PERCENT" ? "정률(%)" : t === "AMOUNT" ? "정액(원)" : "구매권"}
              </button>
            ))}
          </div>
          {discountType === "PURCHASE" && (
            <div className="space-y-1">
              <select
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  const found = products.find((p) => p.id === e.target.value);
                  setProductName(found?.name ?? "");
                }}
                className={inputCls}
              >
                <option value="">상품 선택</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {!productId && (
                <p className="text-xs text-amber-600">구매권을 적용할 상품을 선택해주세요</p>
              )}
            </div>
          )}
          <input
            type="number" min={1}
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            placeholder={discountType === "PERCENT" ? "할인율 예: 10" : discountType === "PURCHASE" ? "구매 가격 예: 3000" : "할인액 예: 5000"}
            className={inputCls}
          />
          {discountType !== "PURCHASE" && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number" min={0}
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(e.target.value)}
                placeholder="최소구매 0"
                className={inputCls}
              />
              <input
                type="number" min={1}
                value={maxIssueCount}
                onChange={(e) => setMaxIssueCount(e.target.value)}
                placeholder="발급수량 무제한"
                className={inputCls}
              />
            </div>
          )}
          {discountType === "PURCHASE" && (
            <input
              type="number" min={1}
              value={maxIssueCount}
              onChange={(e) => setMaxIssueCount(e.target.value)}
              placeholder="발급수량 무제한"
              className={inputCls}
            />
          )}
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-gray-500 shrink-0">게임 종료 후</span>
            <input
              type="number" min={1}
              value={validDays}
              onChange={(e) => setValidDays(e.target.value)}
              className={inputCls + " w-20"}
            />
            <span className="text-[12px] text-gray-500 shrink-0">일간 유효</span>
            <button
              type="button"
              onClick={add}
              className="ml-auto px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-semibold transition-colors shrink-0"
            >
              추가
            </button>
          </div>
        </div>
      )}

      {/* 불러오기 모달 */}
      {showImport && (
        <div className="fixed inset-0 z-[66] flex items-center justify-center p-4 bg-black/40" onClick={() => setShowImport(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Icon name="Download" size={15} className="text-amber-500" /> 기존 쿠폰 불러오기
              </h2>
              <button onClick={() => setShowImport(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            {importLoading ? (
              <div className="flex items-center justify-center py-8 text-gray-300"><Loader2 size={20} className="animate-spin" /></div>
            ) : importList.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">불러올 쿠폰이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {importList.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => applyImport(c)}
                    className="w-full flex items-center gap-3 rounded-xl border border-gray-100 hover:border-amber-300 bg-gray-50 hover:bg-amber-50 px-3.5 py-2.5 text-left transition-colors"
                  >
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${c.source === "game" ? "bg-amber-100 text-amber-700" : "bg-purple-100 text-purple-700"}`}>
                      {c.source === "game" ? "게임" : "라이브"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-gray-900">
                        {label(c)} 할인
                        <span className="ml-1.5 text-[11px] font-mono font-normal text-gray-400">{c.code || "자동생성"}</span>
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">{c.sourceLabel}</p>
                    </div>
                    <Icon name="Check" size={15} className="text-amber-500 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
