"use client";

import { Icon } from "@/components/shared/Icon";
import Link from "next/link";
import SafeImage from "@/components/shared/SafeImage";
import Pagination, { usePagination } from "@/components/shared/Pagination";
import SignupBadges from "@/components/shared/SignupBadges";

// 브랜드 상품을 판매하는 라이브 셀러 목록 (서버에서 병합·전달)
export default function PaginatedBrandSellersList({ items }: { items: any[] }) {
  const { pageItems, page, setPage, totalPages } = usePagination(items, 20);

  return (
    <div className="space-y-3">
      {pageItems.map((seller: any) => (
        <div key={seller.id} className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
              <SafeImage src={seller.shopLogo} alt={seller.shopName} width={48} height={48} fallbackText={seller.shopName.charAt(0)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900">{seller.shopName}</p>
                {seller.isApproved && <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">승인</span>}
                <SignupBadges providers={seller.authProviders} />
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{seller.user.name} · {seller.user.email}</p>
              {seller.category && <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded mt-1 inline-block">{seller.category}</span>}
            </div>
            <Link href={`/shop/${seller.slug}`} className="text-gray-400 hover:text-gray-600 p-1" target="_blank">
              <Icon name="ArrowRight" size={16} />
            </Link>
          </div>

          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Icon name="Store" size={14} className="text-gray-400" />
              <span>상품 {seller.productCount}개</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Icon name="Cart" size={14} className="text-gray-400" />
              <span>캠페인 {seller.campaignCount}개</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Icon name="Wishlist" size={14} className="text-gray-400" />
              <span>팬 {seller.totalFans.toLocaleString()}</span>
            </div>
            {seller.instagramUrl && (
              <a href={seller.instagramUrl} target="_blank" className="text-xs text-blue-500 hover:underline ml-auto">Instagram</a>
            )}
          </div>
        </div>
      ))}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
