"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useEffect, useCallback } from "react";
import {X, Loader2} from 'lucide-react';

interface Coupon {
  id: string;
  code: string | null;
  discountType: string; // PERCENT | AMOUNT | PURCHASE
  discountValue: number;
  minOrderAmount: number;
  maxIssueCount: number | null;
  validDays: number;
  productId: string | null;
  issuedCount: number;
  createdAt: string;
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

interface FormState {
  code: string;
  discountType: "PERCENT" | "AMOUNT" | "PURCHASE";
  discountValue: string;
  minOrderAmount: string;
  maxIssueCount: string;
  validDays: string;
  productId: string;
}

const emptyForm: FormState = {
  code: "",
  discountType: "PERCENT",
  discountValue: "",
  minOrderAmount: "",
  maxIssueCount: "",
  validDays: "7",
  productId: "",
};

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-100 focus:border-amber-400";

export default function GameCouponManager({
  gameId,
  onToast,
}: {
  gameId: string;
  onToast?: (msg: string, ok?: boolean) => void;
}) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importList, setImportList] = useState<ImportCoupon[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);

  const toast = (msg: string, ok = true) => onToast?.(msg, ok);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/seller/games/${gameId}/coupons`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setCoupons(data.coupons || []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const loadProducts = async () => {
    if (products.length > 0) return;
    try {
      const res = await fetch("/api/seller/available-products", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const list = (data.products || []).map((p: any) => ({ id: p.id, name: p.name || p.title || String(p.id) }));
        setProducts(list);
      }
    } catch { /* ignore */ }
  };

  const openEdit = (c: Coupon) => {
    setEditingId(c.id);
    const dtype = c.discountType === "AMOUNT" ? "AMOUNT" : c.discountType === "PURCHASE" ? "PURCHASE" : "PERCENT";
    setForm({
      code: c.code ?? "",
      discountType: dtype,
      discountValue: String(c.discountValue),
      minOrderAmount: c.minOrderAmount ? String(c.minOrderAmount) : "",
      maxIssueCount: c.maxIssueCount != null ? String(c.maxIssueCount) : "",
      validDays: String(c.validDays),
      productId: c.productId ?? "",
    });
    if (dtype === "PURCHASE") loadProducts();
    setShowForm(true);
  };

  const save = async () => {
    const val = Number(form.discountValue);
    if (!Number.isFinite(val) || val <= 0) return toast("할인 값을 입력해주세요", false);
    if (form.discountType === "PERCENT" && val > 100) return toast("정률 할인은 100%를 넘을 수 없습니다", false);
    if (form.discountType === "PURCHASE" && !form.productId) return toast("구매권 상품을 선택해주세요", false);
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        code: form.code.trim() || null,
        discountType: form.discountType,
        discountValue: val,
        minOrderAmount: form.discountType === "PURCHASE" ? 0 : (Number(form.minOrderAmount) || 0),
        maxIssueCount: form.maxIssueCount.trim() ? Number(form.maxIssueCount) : null,
        validDays: Number(form.validDays) || 7,
      };
      if (form.discountType === "PURCHASE") payload.productId = form.productId;
      const url = editingId
        ? `/api/seller/games/${gameId}/coupons/${editingId}`
        : `/api/seller/games/${gameId}/coupons`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        toast(editingId ? "쿠폰을 수정했습니다" : "쿠폰을 추가했습니다");
        setShowForm(false);
        setForm(emptyForm);
        setEditingId(null);
        load();
      } else {
        toast(data.error || "저장에 실패했습니다", false);
      }
    } catch {
      toast("오류가 발생했습니다", false);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("이 쿠폰을 삭제하시겠습니까? (이미 발급된 쿠폰은 유지됩니다)")) return;
    try {
      const res = await fetch(`/api/seller/games/${gameId}/coupons/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast("쿠폰을 삭제했습니다");
        load();
      } else {
        const data = await res.json();
        toast(data.error || "삭제에 실패했습니다", false);
      }
    } catch {
      toast("오류가 발생했습니다", false);
    }
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
    setEditingId(null);
    setForm({
      code: c.code ?? "",
      discountType: c.discountType === "AMOUNT" ? "AMOUNT" : c.discountType === "PURCHASE" ? "PURCHASE" : "PERCENT",
      discountValue: String(c.discountValue),
      minOrderAmount: c.minOrderAmount ? String(c.minOrderAmount) : "",
      maxIssueCount: c.maxIssueCount != null ? String(c.maxIssueCount) : "",
      validDays: String(c.validDays),
      productId: "",
    });
    setShowForm(true);
    setShowImport(false);
  };

  const discountLabel = (c: Coupon | ImportCoupon) =>
    c.discountType === "PERCENT"
      ? `${c.discountValue}% 할인`
      : c.discountType === "PURCHASE"
        ? `${c.discountValue.toLocaleString()}원 구매권`
        : `${c.discountValue.toLocaleString()}원 할인`;

  return (
    <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon name="Gift" size={16} className="text-amber-500" />
          <h2 className="text-sm font-bold text-gray-900">게임 쿠폰 관리</h2>
          {coupons.length > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {coupons.length}개
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={openImport}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-[11px] font-semibold transition-colors"
          >
            <Icon name="Download" size={12} /> 불러오기
          </button>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold transition-colors"
          >
            <Icon name="Plus" size={12} /> 쿠폰 추가
          </button>
        </div>
      </div>

      <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
        게임 당첨자(로그인 시청자)에게 자동 발급됩니다. 발급된 쿠폰은 이 셀러 샵에서만 사용할 수 있습니다.
        쿠폰은 게임 진행 상태와 관계없이 언제든 추가·수정할 수 있습니다.
      </p>

      {/* 쿠폰 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-6 text-gray-300">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : coupons.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">
          연결된 쿠폰이 없습니다. 당첨자에게 줄 쿠폰을 추가해보세요.
        </p>
      ) : (
        <div className="space-y-2">
          {coupons.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                {c.discountType === "PERCENT" ? (
                  <Icon name="Discount" size={15} className="text-amber-600" />
                ) : c.discountType === "PURCHASE" ? (
                  <Icon name="Cart" size={15} className="text-amber-600" />
                ) : (
                  <Icon name="Wallet" size={15} className="text-amber-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-gray-900">
                  {discountLabel(c)}
                  <span className="ml-1.5 text-[11px] font-mono font-normal text-gray-400">
                    {c.code || "자동생성"}
                  </span>
                </p>
                <p className="text-[11px] text-gray-400">
                  {c.minOrderAmount > 0 ? `${c.minOrderAmount.toLocaleString()}원 이상 · ` : ""}
                  {c.maxIssueCount != null ? `${c.issuedCount}/${c.maxIssueCount}장 발급` : `${c.issuedCount}장 발급`}
                  {" · "}종료 후 {c.validDays}일
                </p>
              </div>
              <button
                onClick={() => openEdit(c)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors shrink-0"
                title="수정"
              >
                <Icon name="Edit" size={14} />
              </button>
              <button
                onClick={() => remove(c.id)}
                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                title="삭제"
              >
                <Icon name="Delete" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 추가/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-[66] flex items-center justify-center p-4 bg-black/40" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Icon name="Coupon" size={15} className="text-amber-500" /> {editingId ? "쿠폰 수정" : "게임 쿠폰 추가"}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            {/* 쿠폰 코드 */}
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">쿠폰 코드</label>
            <input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="비워두면 자동 생성"
              maxLength={30}
              className={inputCls + " mb-3"}
            />

            {/* 할인 유형 */}
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">쿠폰 유형</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(["PERCENT", "AMOUNT", "PURCHASE"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setForm((f) => ({ ...f, discountType: t, productId: "" }));
                    if (t === "PURCHASE") loadProducts();
                  }}
                  className={`flex items-center justify-center gap-1 py-2.5 rounded-lg border-2 text-[12px] font-semibold transition-all ${
                    form.discountType === t
                      ? "border-amber-400 bg-amber-50 text-amber-700"
                      : "border-gray-200 bg-white text-gray-500 hover:border-amber-200"
                  }`}
                >
                  {t === "PERCENT" ? <Icon name="Discount" size={13} /> : t === "PURCHASE" ? <Icon name="Cart" size={13} /> : <Icon name="Wallet" size={13} />}
                  {t === "PERCENT" ? "정률(%)" : t === "AMOUNT" ? "정액(원)" : "구매권"}
                </button>
              ))}
            </div>

            {/* PURCHASE: 상품 선택 */}
            {form.discountType === "PURCHASE" && (
              <>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">구매권 상품</label>
                <select
                  value={form.productId}
                  onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
                  className={inputCls + " mb-3"}
                >
                  <option value="">상품 선택</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </>
            )}

            {/* 할인 값 */}
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              {form.discountType === "PERCENT" ? "할인율 (%)" : form.discountType === "PURCHASE" ? "구매 고정가 (원)" : "할인액 (원)"}
            </label>
            <input
              type="number"
              min={1}
              value={form.discountValue}
              onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
              placeholder={form.discountType === "PERCENT" ? "예: 10" : form.discountType === "PURCHASE" ? "예: 3000" : "예: 5000"}
              className={inputCls + " mb-3"}
            />

            {/* 최소 구매 금액 (구매권에서는 불필요) */}
            {form.discountType !== "PURCHASE" && (
              <>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">최소 구매 금액</label>
                <input
                  type="number"
                  min={0}
                  value={form.minOrderAmount}
                  onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))}
                  placeholder="0 (제한 없음)"
                  className={inputCls + " mb-3"}
                />
              </>
            )}

            {/* 발급 수량 제한 */}
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">발급 수량 제한</label>
            <input
              type="number"
              min={1}
              value={form.maxIssueCount}
              onChange={(e) => setForm((f) => ({ ...f, maxIssueCount: e.target.value }))}
              placeholder="무제한"
              className={inputCls + " mb-3"}
            />

            {/* 유효기간 */}
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">게임 종료 후 유효기간(일)</label>
            <input
              type="number"
              min={1}
              value={form.validDays}
              onChange={(e) => setForm((f) => ({ ...f, validDays: e.target.value }))}
              className={inputCls + " mb-4"}
            />

            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {saving ? "저장 중..." : editingId ? "수정 완료" : "쿠폰 추가"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold transition-colors"
              >
                취소
              </button>
            </div>
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
            <p className="text-[11px] text-gray-400 mb-3">
              이전 게임 쿠폰·라이브 쿠폰을 선택하면 설정값을 그대로 불러옵니다.
            </p>
            {importLoading ? (
              <div className="flex items-center justify-center py-8 text-gray-300">
                <Loader2 size={20} className="animate-spin" />
              </div>
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
                        {discountLabel(c)} 할인
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
