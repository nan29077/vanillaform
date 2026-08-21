"use client";

import { Icon } from '@/components/shared/Icon';
import ProductImage from "@/components/shared/ProductImage";
import SafeImage from "@/components/shared/SafeImage";

export interface ApprovedSellerItem {
  id: string;
  productId: string;
  productName: string;
  productThumbnail: string | null;
  sellerName: string;
  sellerShopLogo?: string | null;
  sellerPrice?: number | null;
  brandName?: string | null;
  approvedAt?: string | null;
}

const formatPrice = (n: number) => n.toLocaleString("ko-KR") + "원";

// 브랜드/중간관리자/최고관리자가 승인하여 현재 셀러가 판매 중인 상품 목록
export default function ApprovedSellerProducts({ items }: { items: ApprovedSellerItem[] }) {
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-gray-100">
        <p className="text-xs">현재 판매 중인 셀러 상품이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-green-50 rounded-xl border border-green-100 overflow-hidden divide-y divide-green-100">
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-3 p-3 sm:p-4">
          <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
            <ProductImage src={it.productThumbnail} alt={it.productName} width={40} height={40} className="w-full h-full object-cover" iconSize={14} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{it.productName}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full overflow-hidden bg-gray-100">
                  <SafeImage src={it.sellerShopLogo} alt="" width={16} height={16} fallbackText={it.sellerName.charAt(0)} />
                </div>
                <span className="text-[10px] text-blue-600 font-medium">{it.sellerName}</span>
              </div>
              {it.brandName && (
                <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{it.brandName}</span>
              )}
              {it.sellerPrice != null && (
                <span className="text-[10px] text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded font-medium">판매가 {formatPrice(it.sellerPrice)}</span>
              )}
              <span className="text-[10px] text-green-600 bg-green-100 px-1.5 py-0.5 rounded font-medium">판매중</span>
              {it.approvedAt && (
                <span className="text-[10px] text-gray-400">
                  승인 {new Date(it.approvedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => window.open(`/products/${it.productId}`, "_blank")}
            className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap flex-shrink-0"
            title="상품 상세 보기"
          >
            <Icon name="ArrowRight" size={12} className="shrink-0" /> 상품 상세 보기
          </button>
        </div>
      ))}
    </div>
  );
}
