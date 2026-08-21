"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/shared/Icon";
import { Loader2, Save, Package } from "lucide-react";
import ProductImage from "@/components/shared/ProductImage";
import PackageRegisterForm from "@/components/shared/PackageRegisterForm";
import { useAppDialog } from "@/components/shared/AppDialog";
import Pagination, { usePagination } from "@/components/shared/Pagination";

interface PackageItemRow {
  id: string;
  quantity: number;
  unitPrice: number;
  productName: string;
  productThumbnail: string | null;
  brandName: string | null;
}

interface PackageRow {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  packagePrice: number;
  middleAdminMargin: number | null;
  stock: number;
  status: string; // PENDING | APPROVED | REJECTED
  rejectReason: string | null;
  isOwn: boolean;
  creatorName: string | null;
  orderCount: number;
  createdAt: string;
  items: PackageItemRow[];
}

interface Props {
  initialPackages: PackageRow[];
}

const won = (n: number) => n.toLocaleString("ko-KR") + "원";

type FilterMode = "all" | "own" | "brand" | "pending";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PENDING: { label: "승인 대기", className: "bg-amber-50 text-amber-600" },
  APPROVED: { label: "승인 완료", className: "bg-green-50 text-green-600" },
  REJECTED: { label: "거부됨", className: "bg-red-50 text-red-600" },
};

export default function MiddlePackageProductsClient({ initialPackages }: Props) {
  const { appAlert } = useAppDialog();
  const [packages, setPackages] = useState<PackageRow[]>(initialPackages);
  const [edits, setEdits] = useState<Record<string, { price: string; margin: string }>>(() => {
    const init: Record<string, { price: string; margin: string }> = {};
    for (const p of initialPackages) {
      init[p.id] = {
        price: String(p.packagePrice),
        margin: p.middleAdminMargin != null ? String(p.middleAdminMargin) : "",
      };
    }
    return init;
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");

  const filtered = useMemo(() => {
    return packages.filter((p) => {
      if (filter === "own" && !p.isOwn) return false;
      if (filter === "brand" && p.isOwn) return false;
      if (filter === "pending" && p.status !== "PENDING") return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !(p.creatorName || "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [packages, filter, query]);

  const { pageItems, page, setPage, totalPages } = usePagination(filtered, 20);

  const ownCount = packages.filter((p) => p.isOwn).length;
  const brandCount = packages.length - ownCount;
  const pendingCount = packages.filter((p) => p.status === "PENDING").length;

  const updateEdit = (id: string, key: "price" | "margin", value: string) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  };

  const saveMargin = async (id: string) => {
    const edit = edits[id];
    if (!edit) return;

    const body: any = { action: "setMargin" };
    body.middleAdminMargin = edit.margin === "" ? null : parseFloat(edit.margin);
    if (edit.price !== "") body.packagePrice = parseFloat(edit.price);

    setSavingId(id);
    try {
      const res = await fetch(`/api/package-products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setPackages((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  packagePrice: data.packagePrice,
                  middleAdminMargin: data.middleAdminMargin ?? null,
                }
              : p
          )
        );
        await appAlert({ message: "저장되었습니다.", type: "success" });
      } else {
        await appAlert({ message: data.error || "저장 실패", type: "warning" });
      }
    } catch {
      await appAlert({ message: "오류가 발생했습니다.", type: "warning" });
    }
    setSavingId(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">패키지 상품 관리</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            내 패키지 {ownCount}개 · 소속 브랜드 패키지 {brandCount}개
            {pendingCount > 0 && (
              <span className="text-amber-600 font-medium"> · 승인 대기 {pendingCount}개</span>
            )}
          </p>
        </div>
        <PackageRegisterForm mode="middle" />
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 text-[12px] text-amber-700 leading-relaxed">
        소속 브랜드가 등록한 패키지 상품에 <b>마진</b>을 설정하고 <b>판매가</b>를 조정할 수 있습니다.
        직접 패키지를 구성하여 등록하면 <b>최고관리자 승인</b> 후 판매됩니다.
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="패키지명/등록자 검색"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-300"
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 flex-wrap">
          {([
            { v: "all" as FilterMode, l: "전체" },
            { v: "own" as FilterMode, l: `내 패키지 ${ownCount}` },
            { v: "brand" as FilterMode, l: `브랜드 ${brandCount}` },
            { v: "pending" as FilterMode, l: "승인 대기" },
          ]).map((t) => (
            <button
              key={t.v}
              onClick={() => setFilter(t.v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === t.v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Package size={48} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">표시할 패키지 상품이 없습니다.</p>
          <p className="text-xs mt-1 text-gray-300">우측 상단 버튼으로 패키지 상품을 등록해보세요.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {pageItems.map((p) => {
            const edit = edits[p.id] || { price: String(p.packagePrice), margin: "" };
            const saving = savingId === p.id;
            const badge = STATUS_BADGE[p.status] || { label: p.status, className: "bg-gray-50 text-gray-500" };
            const expanded = expandedId === p.id;
            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    <ProductImage src={p.imageUrl} alt={p.name} width={56} height={56} className="w-full h-full object-cover" iconSize={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                      {p.isOwn ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600">내 등록 패키지</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-purple-50 text-purple-500">
                          {p.creatorName || "브랜드"}
                        </span>
                      )}
                      {p.orderCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-600">
                          주문 {p.orderCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-gray-400">
                      <span>판매가 {won(p.packagePrice)}</span>
                      <span>·</span>
                      <span>구성 {p.items.length}개</span>
                      <span>·</span>
                      <span>재고 {p.stock}</span>
                      {p.middleAdminMargin != null && (
                        <>
                          <span>·</span>
                          <span className="text-amber-600 font-medium">마진 {won(p.middleAdminMargin)}</span>
                        </>
                      )}
                    </div>
                    {p.status === "REJECTED" && p.rejectReason && (
                      <p className="text-[11px] text-red-500 mt-1">거부 사유: {p.rejectReason}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setExpandedId(expanded ? null : p.id)}
                    className="flex-shrink-0 text-[11px] text-gray-400 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-50"
                  >
                    구성 {expanded ? "접기 ▲" : "보기 ▼"}
                  </button>
                </div>

                {expanded && (
                  <div className="mt-3 border border-gray-100 rounded-lg divide-y divide-gray-50">
                    {p.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2.5 px-3 py-2">
                        <div className="w-8 h-8 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                          <ProductImage src={item.productThumbnail} alt={item.productName} width={32} height={32} className="w-full h-full object-cover" iconSize={12} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-gray-800 truncate">{item.productName}</p>
                          {item.brandName && <p className="text-[10px] text-gray-400">{item.brandName}</p>}
                        </div>
                        <p className="text-[11px] text-gray-500 flex-shrink-0">
                          {won(item.unitPrice)} × {item.quantity}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-gray-500 mb-1 block">패키지 판매가</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={edit.price}
                        onChange={(e) => updateEdit(p.id, "price", e.target.value)}
                        placeholder="판매가"
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

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => saveMargin(p.id)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 저장
                  </button>
                  <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
                    <Icon name="Clock" size={11} />
                    {p.isOwn
                      ? p.status === "APPROVED"
                        ? "최고관리자 승인 완료 · 판매 중"
                        : "최고관리자 승인 후 판매 가능합니다"
                      : "브랜드 패키지에 마진/판매가를 설정할 수 있습니다"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
