"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Check, X, Package, ChevronDown } from "lucide-react";
import SafeImage from "@/components/shared/SafeImage";
import { formatPrice } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  thumbnail: string | null;
  basePrice: number;
  supplyPrice: number | null;
  category: { id: string; name: string } | null;
  brand: { id: string; brandName: string; userId: string } | null;
}

interface Category {
  id: string;
  name: string;
}

interface Brand {
  id: string;
  brandName: string;
}

export interface SelectedItem {
  productId: string;
  productName: string;
  thumbnail: string | null;
  unitPrice: number;
  quantity: number;
  brandName: string;
}

interface Props {
  selected: SelectedItem[];
  onChange: (items: SelectedItem[]) => void;
}

export default function PackageItemSelector({ selected, onChange }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "price">("name");

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterCategory) params.set("categoryId", filterCategory);
      if (filterBrand) params.set("brandId", filterBrand);
      const res = await fetch(`/api/products/for-package?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setFetchError(data.error || "상품 목록을 불러오지 못했습니다.");
        setProducts([]);
        setCategories([]);
        setBrands([]);
        return;
      }
      setProducts(data.products || []);
      setCategories(data.categories || []);
      setBrands(data.brands || []);
    } catch {
      setFetchError("상품 목록을 불러오는 중 오류가 발생했습니다.");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [search, filterCategory, filterBrand]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = [...products].sort((a, b) => {
    if (sortBy === "price") return a.basePrice - b.basePrice;
    return a.name.localeCompare(b.name);
  });

  const isSelected = (productId: string) =>
    selected.some((s) => s.productId === productId);

  const toggleProduct = (product: Product) => {
    if (isSelected(product.id)) {
      onChange(selected.filter((s) => s.productId !== product.id));
    } else {
      const newItem: SelectedItem = {
        productId: product.id,
        productName: product.name,
        thumbnail: product.thumbnail,
        unitPrice: product.supplyPrice ?? product.basePrice,
        quantity: 1,
        brandName: product.brand?.brandName ?? "",
      };
      onChange([...selected, newItem]);
    }
  };

  const removeItem = (productId: string) => {
    onChange(selected.filter((s) => s.productId !== productId));
  };

  const selectedTotal = selected.reduce((sum, s) => sum + s.unitPrice * s.quantity, 0);

  return (
    <div className="space-y-4">
      {/* 선택된 구성 상품 */}
      {selected.length > 0 && (
        <div className="bg-brand-50 rounded-xl p-4 border border-brand-200">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-gray-800">
              선택된 구성 상품 ({selected.length}개)
            </p>
            <p className="text-xs text-gray-500">
              단가 합계: <span className="font-bold text-brand-600">{formatPrice(selectedTotal)}원</span>
              <span className="text-gray-400 ml-1">(참고용)</span>
            </p>
          </div>
          <div className="space-y-2">
            {selected.map((item) => (
              <div
                key={item.productId}
                className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 shadow-sm"
              >
                <div className="w-8 h-8 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                  {item.thumbnail ? (
                    <SafeImage
                      src={item.thumbnail}
                      alt={item.productName}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package size={16} className="m-auto mt-1 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{item.productName}</p>
                  <p className="text-[10px] text-gray-400">{item.brandName}</p>
                </div>
                <p className="text-xs font-bold text-gray-700 whitespace-nowrap">
                  {formatPrice(item.unitPrice)}원
                </p>
                <button
                  type="button"
                  onClick={() => removeItem(item.productId)}
                  className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selected.length < 2 && (
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
          ⚠ 구성 상품을 최소 2개 이상 선택해야 합니다.
        </p>
      )}

      {/* 필터 & 검색 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="상품명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
        <div className="relative">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="">전체 카테고리</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="w-full pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="">전체 브랜드</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.brandName}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">총 {filteredProducts.length}개 상품</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">정렬:</span>
          <button
            type="button"
            onClick={() => setSortBy("name")}
            className={`text-xs px-2 py-1 rounded ${sortBy === "name" ? "bg-brand-500 text-black font-bold" : "bg-gray-100 text-gray-500"}`}
          >
            이름순
          </button>
          <button
            type="button"
            onClick={() => setSortBy("price")}
            className={`text-xs px-2 py-1 rounded ${sortBy === "price" ? "bg-brand-500 text-black font-bold" : "bg-gray-100 text-gray-500"}`}
          >
            가격순
          </button>
        </div>
      </div>

      {/* 상품 목록 */}
      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400">상품 불러오는 중...</div>
      ) : fetchError ? (
        <div className="py-10 text-center text-sm text-red-500 bg-red-50 rounded-xl px-4">
          <Package size={32} className="mx-auto mb-2 opacity-30" />
          {fetchError}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">
          <Package size={32} className="mx-auto mb-2 opacity-30" />
          조건에 맞는 상품이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
          {filteredProducts.map((product) => {
            const selected_ = isSelected(product.id);
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => toggleProduct(product)}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  selected_
                    ? "border-brand-500 bg-brand-50 shadow-sm"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {/* 체크박스 */}
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    selected_ ? "bg-brand-500 border-brand-500" : "border-gray-300"
                  }`}
                >
                  {selected_ && <Check size={12} className="text-black" />}
                </div>
                {/* 썸네일 */}
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {product.thumbnail ? (
                    <SafeImage
                      src={product.thumbnail}
                      alt={product.name}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package size={20} className="m-auto mt-2.5 text-gray-300" />
                  )}
                </div>
                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{product.name}</p>
                  <p className="text-[10px] text-gray-400 truncate">{product.brand?.brandName}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {product.category && (
                      <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                        {product.category.name}
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-gray-700">
                      {formatPrice(product.supplyPrice ?? product.basePrice)}원
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
