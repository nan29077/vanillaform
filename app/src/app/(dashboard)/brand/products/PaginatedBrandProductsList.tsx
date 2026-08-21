"use client";

import { Icon } from "@/components/shared/Icon";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import ProductImage from "@/components/shared/ProductImage";
import ProductItemActions from "@/components/shared/ProductItemActions";
import ProductSalesDetail from "@/components/shared/ProductSalesDetail";
import ProductSellerChatPanel from "@/components/shared/ProductSellerChatPanel";
import Pagination, { usePagination } from "@/components/shared/Pagination";
import { useMemo, useState } from "react";

interface BrandProductRow {
  id: string;
  name: string;
  thumbnail: string | null;
  isActive: boolean;
  isApproved: boolean;
  supplyPrice: number | null;
  category: { name: string } | null;
  _count: { sellerProducts: number; campaigns: number; reviews: number };
  sellerProducts: {
    id: string;
    isActive: boolean;
    isApproved: boolean;
    seller: { id: string; shopName: string; shopLogo: string | null };
  }[];
}

interface Props {
  items: BrandProductRow[];
  unreadMap: Record<string, number>;
  currentUserId: string;
}

type FilterTab = "all" | "selling";

export default function PaginatedBrandProductsList({ items, unreadMap, currentUserId }: Props) {
  const [filterTab, setFilterTab] = useState<FilterTab>("all");

  const filtered = useMemo(() => {
    if (filterTab === "selling") {
      return items.filter((p) => p.sellerProducts.some((sp) => sp.isApproved && sp.isActive));
    }
    return items;
  }, [items, filterTab]);

  const sellingCount = useMemo(
    () => items.filter((p) => p.sellerProducts.some((sp) => sp.isApproved && sp.isActive)).length,
    [items]
  );

  const { pageItems, page, setPage, totalPages } = usePagination(filtered, 20);

  return (
    <div className="space-y-3">
      {/* 필터 탭 */}
      <div className="flex items-center gap-1.5">
        {([
          { v: "all" as const, l: "전체", count: items.length },
          { v: "selling" as const, l: "판매중", count: sellingCount },
        ]).map((t) => (
          <button
            key={t.v}
            onClick={() => { setFilterTab(t.v); }}
            className={`flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold rounded-full border whitespace-nowrap transition-colors ${
              filterTab === t.v
                ? t.v === "selling"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "bg-brand-600 text-white border-brand-600 shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-600"
            }`}
          >
            {t.l}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filterTab === t.v ? "bg-white/20 text-white" : "bg-gray-100 text-gray-400"}`}>{t.count}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="divide-y divide-gray-50">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Icon name="Package" size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">표시할 상품이 없습니다.</p>
            </div>
          ) : pageItems.map((product) => {
            const activeSellers = product.sellerProducts.filter((sp) => sp.isApproved && sp.isActive);
            const showSellers = filterTab === "selling" && activeSellers.length > 0;
            return (
              <div key={product.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <Link href={`/products/${product.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                      <ProductImage src={product.thumbnail} alt={product.name} width={56} height={56} className="w-full h-full object-cover" iconSize={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {product.category && (
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{product.category?.name}</span>
                        )}
                        {showSellers ? (
                          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">
                            판매중 {activeSellers.length}개 샵
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">
                            라이브 셀러 {product._count.sellerProducts} · 공구 {product._count.campaigns} · 리뷰 {product._count.reviews}
                          </span>
                        )}
                      </div>
                      {showSellers && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {activeSellers.slice(0, 5).map((sp) => (
                            <span key={sp.id} className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                              {sp.seller.shopName}
                            </span>
                          ))}
                          {activeSellers.length > 5 && (
                            <span className="text-[10px] text-gray-400 px-1">+{activeSellers.length - 5}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold">
                        {product.supplyPrice != null ? formatPrice(Number(product.supplyPrice)) : "공급가 미입력"}
                      </p>
                      <p className="text-[10px] text-gray-400">공급가</p>
                      <span
                        className={`text-[10px] ${
                          !product.isActive
                            ? "text-gray-400"
                            : product.isApproved
                              ? "text-green-600"
                              : "text-amber-500"
                        }`}
                      >
                        {!product.isActive ? "숨김" : product.isApproved ? "라이브 셀러 공개중" : "검수중(비공개)"}
                      </span>
                    </div>
                  </Link>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <ProductSalesDetail productId={product.id} productName={product.name} thumbnail={product.thumbnail} />
                    <ProductSellerChatPanel
                      productId={product.id}
                      productName={product.name}
                      currentUserId={currentUserId}
                      sellers={product.sellerProducts.map((sp) => ({
                        id: sp.seller.id,
                        shopName: sp.seller.shopName,
                        shopLogo: sp.seller.shopLogo || null,
                        isActive: sp.isActive,
                      }))}
                    />
                    <ProductItemActions productId={product.id} productName={product.name} mode="brand" isActive={product.isActive} />
                  </div>
                </div>

                {filterTab === "all" && product.sellerProducts.length > 0 && (
                  <div className="mt-2 ml-[52px]">
                    <div className="flex items-center gap-1 mb-1.5">
                      <Icon name="Users" size={10} className="text-gray-400" />
                      <span className="text-[10px] text-gray-400 font-medium">판매 라이브 셀러 ({product.sellerProducts.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {product.sellerProducts.slice(0, 5).map((sp) => (
                        <div key={sp.id} className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] ${
                          sp.isApproved && sp.isActive ? "bg-green-50 border-green-100 text-green-600" : "bg-gray-50 border-gray-100 text-gray-400"}`}>
                          {sp.seller.shopName}
                        </div>
                      ))}
                      {product.sellerProducts.length > 5 && (
                        <span className="text-[10px] text-gray-400 px-1">+{product.sellerProducts.length - 5}명</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}
