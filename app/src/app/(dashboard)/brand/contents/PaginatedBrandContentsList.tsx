"use client";

import { Icon } from "@/components/shared/Icon";
import Link from "next/link";
import { parseJsonArray } from "@/lib/utils";
import { Image as ImageIcon } from "lucide-react";
import ProductSalesDetail from "@/components/shared/ProductSalesDetail";
import Pagination, { usePagination } from "@/components/shared/Pagination";

// 콘텐츠 목록 행 데이터 (서버에서 직렬화하여 전달)
interface ContentRow {
  id: string;
  title: string;
  images: string | null;
  isPublished: boolean;
  isApproved: boolean;
  viewCount: number;
  createdAt: string;
  seller: { shopName: string };
  _count: { likes: number; comments: number };
  shoppingTags: {
    id: string;
    product: { id: string; name: string; thumbnail: string | null };
  }[];
}

interface Props {
  items: ContentRow[];
  // 내 브랜드 상품 ID 목록 (연계 상품 강조용)
  myProductIds: string[];
}

// 표시용 날짜 포맷
const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });

export default function PaginatedBrandContentsList({ items, myProductIds }: Props) {
  const { pageItems, page, setPage, totalPages } = usePagination(items, 20);
  const myProductIdSet = new Set(myProductIds);

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
      {pageItems.map((post) => {
        const status = !post.isApproved ? "pending" : post.isPublished ? "published" : "draft";
        const statusColor: Record<string, string> = {
          pending: "text-yellow-600 bg-yellow-100",
          published: "text-green-600 bg-green-100",
          draft: "text-gray-500 bg-gray-200",
        };
        const statusLabel: Record<string, string> = {
          pending: "승인대기",
          published: "공개",
          draft: "비공개",
        };

        // Find my brand's products tagged in this content
        const myLinkedProducts = post.shoppingTags.filter((tag: any) => myProductIdSet.has(tag.product.id));

        return (
          <div key={post.id} className="p-3 sm:p-4 hover:bg-gray-50/50 transition-colors">
            <Link
              href={`/brand/contents/${post.id}`}
              className="flex items-center gap-3 cursor-pointer"
            >
              {/* Thumbnail */}
              <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                {parseJsonArray(post.images)[0] ? (
                  <img src={parseJsonArray(post.images)[0]} alt={post.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon size={18} className="text-gray-300" />
                  </div>
                )}
                {parseJsonArray(post.images).length > 1 && (
                  <div className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[8px] px-1 py-0.5 rounded">
                    +{parseJsonArray(post.images).length - 1}
                  </div>
                )}
              </div>

              {/* Content Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-[13px] sm:text-sm font-medium text-gray-900 truncate">{post.title}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${statusColor[status]}`}>
                    {statusLabel[status]}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{post.seller.shopName}</span>
                  <span className="text-[10px] text-gray-400">{formatDate(post.createdAt)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                    <Icon name="Eye" size={10} /> {post.viewCount}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                    <Icon name="Wishlist" size={10} /> {post._count.likes}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                    <Icon name="Message" size={10} /> {post._count.comments}
                  </span>
                  {post.shoppingTags.length > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-brand-500">
                      <Icon name="Cart" size={10} /> {post.shoppingTags.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Arrow indicator */}
              <div className="flex-shrink-0 text-gray-300">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </Link>

            {/* My brand's products linked in this content */}
            {myLinkedProducts.length > 0 && (
              <div className="mt-2 ml-[62px]">
                <div className="flex items-center gap-1 mb-1.5">
                  <Icon name="Package" size={10} className="text-brand-500" />
                  <span className="text-[10px] text-brand-500 font-medium">내 상품 연계 ({myLinkedProducts.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {myLinkedProducts.map((tag: any) => (
                    <div key={tag.id} className="flex items-center gap-1.5 px-2 py-1 bg-brand-50 border border-brand-100 rounded-lg">
                      <div className="w-6 h-6 rounded overflow-hidden bg-white flex-shrink-0">
                        {tag.product.thumbnail && (
                          <img src={tag.product.thumbnail} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <span className="text-[10px] text-brand-700 font-medium max-w-[80px] truncate">{tag.product.name}</span>
                      <ProductSalesDetail productId={tag.product.id} productName={tag.product.name} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
