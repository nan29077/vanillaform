"use client";

import { Icon } from '@/components/shared/Icon';
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {Loader2, Save} from 'lucide-react';
import ProductImage from "@/components/shared/ProductImage";
import ProductSalesDetail from "@/components/shared/ProductSalesDetail";
import { useAppDialog } from "@/components/shared/AppDialog";
import ProductDetailModal from "@/components/shared/ProductDetailModal";
import ProductRegisterForm from "@/components/shared/ProductRegisterForm";
import PackageRegisterForm from "@/components/shared/PackageRegisterForm";
import Pagination, { usePagination } from "@/components/shared/Pagination";

interface ProductRow {
  id: string;
  name: string;
  thumbnail: string | null;
  brandId: string | null;
  brandName: string | null;
  categoryName: string | null;
  supplyPrice: number | null;
  basePrice: number;
  middleAdminMargin: number | null;
  isApproved: boolean;
  isOwn?: boolean;
  activeSellers?: { id: string; shopName: string }[];
}

interface Props {
  initialProducts: ProductRow[];
  brands?: { id: string; brandName: string }[];
}

const won = (n: number) => n.toLocaleString("ko-KR") + "원";

type FilterMode = "all" | "pending" | "published" | "selling";

// 행별 입력칸 기본값 — 서버에 저장된 값을 그대로 보여준다.
// 판매가 노출 조건: 승인됨 / 마진 설정됨 / 판매가≠공급가(=중간관리자가 설정한 값).
// (미승인+마진 미설정이면 브랜드 등록 시 공급가가 복사된 기본값이라 빈 칸으로 두지만,
//  판매가가 공급가와 다르면 중간관리자가 저장한 값이므로 반드시 노출한다 —
//  이전에는 이 경우도 빈 칸이어서 "저장이 안 된다"로 보이는 버그가 있었다.)
const defaultEdit = (p: ProductRow): { basePrice: string; margin: string } => ({
  basePrice:
    p.isApproved || p.middleAdminMargin != null || (p.supplyPrice != null && p.basePrice !== p.supplyPrice)
      ? String(p.basePrice)
      : "",
  margin: p.middleAdminMargin != null ? String(p.middleAdminMargin) : "",
});

export default function MiddleProductManagementClient({ initialProducts, brands = [] }: Props) {
  const { appAlert } = useAppDialog();
  const router = useRouter();
  const [products, setProducts] = useState<ProductRow[]>(initialProducts);
  // 사용자가 수정 중인 행만 보관. 나머지 행은 렌더 시 defaultEdit(서버 저장값)로 표시한다.
  const [edits, setEdits] = useState<Record<string, { basePrice: string; margin: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Next.js 클라이언트 라우터 캐시(기본 30초)가 저장 이전의 낡은 목록을 되돌려주는 것을 방지:
  // 진입 시 서버 데이터를 강제 갱신하고, 새 payload 가 오면 목록 상태를 동기화한다.
  // (edits 는 사용자가 입력 중인 값이므로 덮어쓰지 않는다)
  useEffect(() => {
    router.refresh();
  }, [router]);
  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [brandFilter, setBrandFilter] = useState("");

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (brandFilter && p.brandId !== brandFilter) return false;
      if (filter === "pending" && p.isApproved) return false;
      if (filter === "published" && !p.isApproved) return false;
      if (filter === "selling" && !(p.activeSellers && p.activeSellers.length > 0)) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !(p.brandName || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [products, filter, query, brandFilter]);

  const { pageItems, page, setPage, totalPages } = usePagination(filtered, 20);

  const pendingCount = products.filter((p) => !p.isApproved).length;
  const sellingCount = products.filter((p) => (p.activeSellers || []).length > 0).length;

  // 판매가·마진 양방향 자동 연동 — 항상 「판매가 = 공급가 + 마진」 등식을 유지한다.
  // 판매가를 고치면 마진이, 마진을 고치면 판매가가 즉시 재계산되므로
  // 이전에 저장된 값이 남아 어긋나는 문제(예: 판매가 17,000 · 마진 35,000)가 생기지 않는다.
  const updateEdit = (id: string, key: "basePrice" | "margin", value: string) => {
    setEdits((prev) => {
      const product = products.find((p) => p.id === id);
      const base = prev[id] ?? (product ? defaultEdit(product) : { basePrice: "", margin: "" });
      const next = { ...prev, [id]: { ...base, [key]: value } };
      const supply = product?.supplyPrice;
      if (supply != null) {
        const n = parseFloat(value);
        if (key === "basePrice" && !isNaN(n)) {
          next[id].margin = String(Math.max(0, Math.round(n - supply)));
        } else if (key === "margin" && !isNaN(n)) {
          next[id].basePrice = String(Math.round(supply + Math.max(0, n)));
        }
      }
      return next;
    });
  };

  const save = async (id: string, opts: { publish?: boolean } = {}) => {
    const product = products.find((p) => p.id === id);
    const edit = edits[id] ?? (product ? defaultEdit(product) : undefined);
    const body: any = { productId: id };
    if (edit) {
      if (edit.basePrice !== "") body.basePrice = parseFloat(edit.basePrice);
      body.middleAdminMargin = edit.margin === "" ? null : parseFloat(edit.margin);
    }
    if (opts.publish !== undefined) body.publish = opts.publish;

    setSavingId(id);
    try {
      const res = await fetch("/api/middle/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  basePrice: data.product.basePrice,
                  middleAdminMargin: data.product.middleAdminMargin,
                  isApproved: data.product.isApproved,
                }
              : p
          )
        );
        // 입력칸을 서버 저장값으로 동기화 — 저장 결과가 화면에 즉시 확정되어 보이게 한다.
        setEdits((prev) => ({
          ...prev,
          [id]: {
            basePrice: data.product.basePrice != null ? String(data.product.basePrice) : "",
            margin: data.product.middleAdminMargin != null ? String(data.product.middleAdminMargin) : "",
          },
        }));
        const savedBase = data.product.basePrice != null ? won(Number(data.product.basePrice)) : "-";
        const savedMargin = data.product.middleAdminMargin != null ? won(Number(data.product.middleAdminMargin)) : "미설정";
        await appAlert(`저장되었습니다.\n판매가 ${savedBase} · 마진 ${savedMargin}`);
      } else {
        await appAlert({ message: data.error || "저장 실패", type: "warning" });
      }
    } catch {
      await appAlert({ message: "오류가 발생했습니다.", type: "warning" });
    }
    setSavingId(null);
  };

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">상품 관리</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            소속 브랜드 상품 {products.length}개
            {pendingCount > 0 && <span className="text-amber-600 font-medium"> · 가격 미설정/비공개 {pendingCount}개</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          <PackageRegisterForm mode="middle" redirectPath="/middle/package-products" />
          <ProductRegisterForm brands={[]} mode="middle" buttonLabel="내 상품 등록" hideGroupBuy />
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 text-[12px] text-amber-700 leading-relaxed">
        브랜드가 등록한 상품에 <b>판매가</b>와 <b>마진</b>을 입력 후 저장하면, <b>최고관리자 승인</b> 후 라이브 셀러에게 노출됩니다.
        브랜드는 마진과 판매가를 볼 수 없습니다.
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="상품명/브랜드 검색"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-300"
          />
        </div>
        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-amber-300"
        >
          <option value="">브랜드 전체</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.brandName}</option>
          ))}
        </select>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 flex-wrap">
          {([
            { v: "all" as FilterMode, l: "전체" },
            { v: "selling" as FilterMode, l: `판매중 ${sellingCount}` },
            { v: "pending" as FilterMode, l: "비공개" },
            { v: "published" as FilterMode, l: "공개중" },
          ]).map((t) => (
            <button
              key={t.v}
              onClick={() => setFilter(t.v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === t.v
                  ? t.v === "selling"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Icon name="Package" size={48} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">표시할 상품이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {pageItems.map((p) => {
            const edit = edits[p.id] || defaultEdit(p);
            const saving = savingId === p.id;
            const activeSellers = p.activeSellers || [];
            const isSelling = activeSellers.length > 0;
            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    <ProductImage src={p.thumbnail} alt={p.name} width={56} height={56} className="w-full h-full object-cover" iconSize={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      {p.isOwn ? (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 ${
                            p.isApproved ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                          }`}
                        >
                          {p.isApproved ? <><Icon name="Check" size={10} /> 승인완료</> : <><Icon name="Clock" size={10} /> 최고관리자 승인 대기</>}
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 ${
                            p.isApproved ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                          }`}
                        >
                          {p.isApproved
                            ? <><Icon name="Certified" size={10} /> 승인완료 · 공개중</>
                            : <><Icon name="Clock" size={10} /> 최고관리자 승인 대기</>}
                        </span>
                      )}
                      {p.isOwn && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600">내 등록상품</span>
                      )}
                      {isSelling && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-600">
                          판매중 {activeSellers.length}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-gray-400">
                      {p.brandName && <span className="bg-purple-50 text-purple-500 px-1.5 py-0.5 rounded">{p.brandName}</span>}
                      {p.categoryName && (
                        <span className="flex items-center gap-0.5">
                          <Icon name="Tag" size={10} /> {p.categoryName}
                        </span>
                      )}
                      <span>공급가 {p.supplyPrice != null ? won(p.supplyPrice) : "미입력"}</span>
                    </div>
                    {isSelling && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {activeSellers.map((s) => (
                          <span key={s.id} className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                            {s.shopName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <ProductSalesDetail productId={p.id} productName={p.name} thumbnail={p.thumbnail} />
                    <ProductDetailModal productId={p.id} productName={p.name} />
                  </div>
                </div>

                {p.isOwn ? (
                  <div className="mt-3 text-[11px] text-gray-500 bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
                    {p.isApproved
                      ? "최고관리자 승인이 완료되어 셀러에게 노출됩니다."
                      : "최고관리자 승인 후 셀러의 상품 신청 목록에 노출됩니다."}
                  </div>
                ) : (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-gray-500 mb-1 block">판매가 <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={edit.basePrice}
                            onChange={(e) => updateEdit(p.id, "basePrice", e.target.value)}
                            placeholder="판매가 입력"
                            className="w-full text-sm pr-8 pl-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-300"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-gray-500 mb-1 block">중간관리자 마진</label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={edit.margin}
                            onChange={(e) => updateEdit(p.id, "margin", e.target.value)}
                            placeholder="0"
                            className="w-full text-sm pr-8 pl-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-300"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                        </div>
                      </div>
                    </div>
                    {p.supplyPrice != null && (
                      <p className="mt-1.5 text-[10px] text-gray-400">
                        판매가·마진은 자동 연동됩니다 (판매가 = 공급가 {won(p.supplyPrice)} + 마진)
                      </p>
                    )}

                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => save(p.id)}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                      >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 저장
                      </button>
                      <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
                        <Icon name="Clock" size={11} />
                        {p.isApproved ? "최고관리자 승인 완료 · 셀러 노출 중" : "저장 후 최고관리자 승인 시 셀러에게 노출됩니다"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
