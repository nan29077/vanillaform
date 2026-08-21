"use client";

import { Icon } from "@/components/shared/Icon";
import Link from "next/link";
import { Image as ImageIcon } from "lucide-react";
import { parseJsonArray } from "@/lib/utils";
import ContentPostActions from "@/components/shared/ContentPostActions";
import Pagination, { usePagination } from "@/components/shared/Pagination";

type ContentStatus = "pending" | "published" | "draft";

// 콘텐츠 목록(섹션 내부) — 페이지당 20개씩 클라이언트 페이지네이션
// 바깥 색상 래퍼/헤더는 서버 page.tsx가 유지하고, 여기서는 divide 리스트 + 페이지네이션만 렌더한다.
export default function PaginatedContentList({
  posts,
  status,
  divideClassName,
}: {
  posts: any[];
  status: ContentStatus;
  divideClassName: string;
}) {
  const { pageItems, page, setPage, totalPages } = usePagination(posts, 20);

  return (
    <>
      <div className={divideClassName}>
        {pageItems.map((post) => (
          <ContentRow key={post.id} post={post} status={status} />
        ))}
      </div>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </>
  );
}

function ContentRow({
  post,
  status,
}: {
  post: any;
  status: ContentStatus;
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

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 p-3 sm:p-4 hover:bg-gray-50/50 transition-colors">
      {/* 클릭 시 콘텐츠 상세 페이지로 이동 */}
      <Link href={`/content/${post.id}`} className="flex items-start sm:items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
        {/* 이미지 프리뷰 */}
        <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
          {parseJsonArray(post.images)[0] ? (
            <img src={parseJsonArray(post.images)[0]} alt={post.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon size={18} className="text-gray-300" />
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
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-[13px] sm:text-sm font-medium text-gray-900 truncate">{post.title}</p>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${statusColor[status]}`}>
              {statusLabel[status]}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-[10px] text-gray-400">{formatDate(post.createdAt)}</span>
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
              <Icon name="Eye" size={10} /> {post.viewCount}
            </span>
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
              <Icon name="Wishlist" size={10} /> {post.likeCount}
            </span>
            {post.shoppingTags.length > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-brand-500 font-medium hidden sm:flex">
                <Icon name="Tag" size={10} /> {post.shoppingTags.length}개
              </span>
            )}
          </div>
          {post.content && (
            <p className="text-[10px] text-gray-400 truncate mt-0.5 hidden sm:block">{post.content}</p>
          )}
        </div>
      </Link>

      {/* 액션 */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <ContentPostActions postId={post.id} status={status} />
      </div>
    </div>
  );
}
