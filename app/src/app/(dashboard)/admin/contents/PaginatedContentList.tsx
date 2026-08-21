"use client";

import { Icon } from "@/components/shared/Icon";
import { Image as ImageIcon } from "lucide-react";
import { parseJsonArray } from "@/lib/utils";
import SafeImage from "@/components/shared/SafeImage";
import ContentPostActions from "@/components/shared/ContentPostActions";
import ProductSalesDetail from "@/components/shared/ProductSalesDetail";
import Pagination, { usePagination } from "@/components/shared/Pagination";

// 날짜 포맷 (순수 표현용 헬퍼)
const formatDate = (date: Date) =>
  new Date(date).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function AdminContentRow({
  post,
  status,
  allProductIds,
}: {
  post: any;
  status: "pending" | "published" | "draft";
  allProductIds: Set<string>;
}) {
  const statusColor = {
    pending: "text-yellow-600 bg-yellow-100",
    published: "text-green-600 bg-green-100",
    draft: "text-gray-500 bg-gray-200",
  };
  const statusLabel = {
    pending: "승인대기",
    published: "공개",
    draft: "비공개",
  };

  // Find products in this content that belong to admin's catalog
  const linkedProducts = post.shoppingTags.filter((tag: any) => allProductIds.has(tag.product.id));

  return (
    <div className="p-4 hover:bg-gray-50/50 transition-colors">
      <div className="flex items-center gap-3">
        {/* 이미지 프리뷰 */}
        <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
          {parseJsonArray(post.images)[0] ? (
            <img src={parseJsonArray(post.images)[0]} alt={post.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon size={20} className="text-gray-300" />
            </div>
          )}
          {parseJsonArray(post.images).length > 1 && (
            <span className="absolute top-0.5 right-0.5 text-[8px] bg-black/60 text-white px-1 rounded font-medium">
              +{parseJsonArray(post.images).length - 1}
            </span>
          )}
          {post.shoppingTags.length > 0 && (
            <span className="absolute bottom-0.5 left-0.5 flex items-center gap-0.5 text-[8px] bg-brand-600 text-white px-1.5 py-0.5 rounded-full font-medium">
              <Icon name="Cart" size={8} /> {post.shoppingTags.length}
            </span>
          )}
        </div>

        {/* 콘텐츠 정보 */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{post.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full overflow-hidden bg-gray-100">
                <SafeImage src={post.seller.shopLogo} alt="" width={16} height={16} fallbackText={post.seller.shopName.charAt(0)} />
              </div>
              <span className="text-[10px] text-gray-500 font-medium">{post.seller.shopName}</span>
            </div>
            <span className="text-[10px] text-gray-400">{formatDate(post.createdAt)}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
              <Icon name="Eye" size={10} /> {post.viewCount}
            </span>
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
              <Icon name="Wishlist" size={10} /> {post.likeCount}
            </span>
            {post.shoppingTags.length > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-brand-500 font-medium">
                <Icon name="Tag" size={10} /> {post.shoppingTags.length}개 태그
              </span>
            )}
          </div>
        </div>

        {/* 태그된 상품 미리보기 */}
        {post.shoppingTags.length > 0 && (
          <div className="hidden md:flex items-center gap-1 flex-shrink-0">
            {post.shoppingTags.slice(0, 3).map((tag: any) => (
              <div key={tag.id} className="w-8 h-8 rounded bg-gray-100 overflow-hidden" title={tag.product.name}>
                {tag.product.thumbnail && (
                  <img src={tag.product.thumbnail} alt="" className="w-full h-full object-cover" />
                )}
              </div>
            ))}
            {post.shoppingTags.length > 3 && (
              <span className="text-[9px] text-gray-400">+{post.shoppingTags.length - 3}</span>
            )}
          </div>
        )}

        {/* 상태 + 액션 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor[status]}`}>
            {statusLabel[status]}
          </span>
          <ContentPostActions postId={post.id} status={status} isAdmin={true} />
        </div>
      </div>

      {/* Linked Products with Sales Detail */}
      {linkedProducts.length > 0 && (
        <div className="mt-2 ml-[76px]">
          <div className="flex items-center gap-1 mb-1.5">
            <Icon name="Package" size={10} className="text-brand-500" />
            <span className="text-[10px] text-brand-500 font-medium">내 상품 연계 ({linkedProducts.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {linkedProducts.map((tag: any) => (
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
}

/**
 * 콘텐츠 목록을 페이지당 20개씩 페이지네이션하여 렌더링하는 클라이언트 컴포넌트.
 * 승인 대기/공개 중/비공개 3개 섹션에서 배경 구분선 클래스만 다르게 재사용한다.
 */
export default function PaginatedContentList({
  items,
  status,
  allProductIds,
  divideClassName = "divide-gray-50",
}: {
  items: any[];
  status: "pending" | "published" | "draft";
  allProductIds: Set<string>;
  divideClassName?: string;
}) {
  const { pageItems, page, setPage, totalPages } = usePagination(items, 20);

  return (
    <>
      <div className={`divide-y ${divideClassName}`}>
        {pageItems.map((post: any) => (
          <AdminContentRow key={post.id} post={post} status={status} allProductIds={allProductIds} />
        ))}
      </div>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </>
  );
}
