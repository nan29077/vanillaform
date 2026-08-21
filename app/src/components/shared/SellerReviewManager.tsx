"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useEffect, useCallback } from "react";
import {Loader2} from 'lucide-react';
import SafeImage from "@/components/shared/SafeImage";

interface Review {
  id: string;
  rating: number;
  content: string;
  images: string[];
  isHidden: boolean;
  sellerComment: string | null;
  sellerCommentedAt: string | null;
  createdAt: string;
  user: { name: string };
  product: { name: string; thumbnail: string | null };
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon name="Star"
          key={n}
          size={12}
          className={n <= rating ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"}
        />
      ))}
    </div>
  );
}

export default function SellerReviewManager() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [commentEditing, setCommentEditing] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const limit = 10;

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/seller/reviews?page=${page}&limit=${limit}`);
      const data = await res.json();
      setReviews(data.reviews ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const handleSaveComment = async (reviewId: string) => {
    const comment = commentEditing[reviewId] ?? "";
    setSavingId(reviewId);
    await fetch("/api/seller/reviews", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId, sellerComment: comment }),
    });
    setSavingId(null);
    setSavedId(reviewId);
    setTimeout(() => setSavedId(null), 2000);
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId
          ? { ...r, sellerComment: comment || null, sellerCommentedAt: new Date().toISOString() }
          : r
      )
    );
    setCommentEditing((e) => { const n = { ...e }; delete n[reviewId]; return n; });
  };

  const handleToggleHidden = async (reviewId: string, current: boolean) => {
    await fetch("/api/seller/reviews", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId, isHidden: !current }),
    });
    setReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, isHidden: !current } : r))
    );
  };

  const totalPages = Math.ceil(total / limit);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="py-16 text-center">
        <Icon name="Message" size={32} className="text-gray-200 mx-auto mb-3" />
        <p className="text-sm text-gray-400">아직 리뷰가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">총 {total}개 리뷰</p>

      {reviews.map((review) => {
        const isEditing = review.id in commentEditing;
        const commentValue = isEditing ? commentEditing[review.id] : (review.sellerComment ?? "");

        return (
          <div
            key={review.id}
            className={`bg-white border rounded-xl p-4 space-y-3 ${review.isHidden ? "border-gray-100 opacity-60" : "border-gray-100"}`}
          >
            {/* 상품 정보 */}
            <div className="flex items-center gap-2">
              {review.product.thumbnail && (
                <SafeImage
                  src={review.product.thumbnail}
                  alt={review.product.name}
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <span className="text-[11px] text-gray-500 truncate">{review.product.name}</span>
              <div className="ml-auto flex items-center gap-1">
                {review.isHidden && (
                  <span className="text-[10px] text-red-400 bg-red-50 px-1.5 py-0.5 rounded">숨김</span>
                )}
                <button
                  onClick={() => handleToggleHidden(review.id, review.isHidden)}
                  className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
                  title={review.isHidden ? "숨김 해제" : "리뷰 숨기기"}
                >
                  {review.isHidden ? <Icon name="Eye" size={12} /> : <Icon name="Eye" size={12} />}
                  {review.isHidden ? "표시" : "숨기기"}
                </button>
              </div>
            </div>

            {/* 리뷰 내용 */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <StarRow rating={review.rating} />
                <span className="text-[11px] text-gray-500">{review.user.name}</span>
                <span className="text-[10px] text-gray-300">
                  {new Date(review.createdAt).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <p className="text-[12px] text-gray-700 leading-relaxed">{review.content}</p>
              {review.images.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {review.images.map((img, i) => (
                    <SafeImage
                      key={i}
                      src={img}
                      alt={`리뷰이미지${i + 1}`}
                      width={56}
                      height={56}
                      className="w-14 h-14 rounded-lg object-cover border border-gray-100"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 셀러 댓글 영역 */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-600">라이브 셀러 댓글</span>
                {review.sellerCommentedAt && !isEditing && (
                  <span className="text-[10px] text-gray-400">
                    {new Date(review.sellerCommentedAt).toLocaleDateString("ko-KR")}
                  </span>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full text-[12px] border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-brand-300 bg-white"
                    rows={3}
                    placeholder="구매자에게 댓글을 남겨보세요..."
                    value={commentValue}
                    onChange={(e) =>
                      setCommentEditing((ed) => ({ ...ed, [review.id]: e.target.value }))
                    }
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() =>
                        setCommentEditing((ed) => { const n = { ...ed }; delete n[review.id]; return n; })
                      }
                      className="text-[11px] px-2.5 py-1 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => handleSaveComment(review.id)}
                      disabled={savingId === review.id}
                      className="text-[11px] px-3 py-1 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60 transition-colors flex items-center gap-1"
                    >
                      {savingId === review.id ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : savedId === review.id ? (
                        <Icon name="Check" size={10} />
                      ) : null}
                      저장
                    </button>
                  </div>
                </div>
              ) : review.sellerComment ? (
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[12px] text-gray-700 leading-relaxed flex-1">{review.sellerComment}</p>
                  <button
                    onClick={() =>
                      setCommentEditing((ed) => ({ ...ed, [review.id]: review.sellerComment ?? "" }))
                    }
                    className="text-[10px] text-brand-500 hover:text-brand-700 flex-shrink-0 mt-0.5"
                  >
                    수정
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCommentEditing((ed) => ({ ...ed, [review.id]: "" }))}
                  className="text-[11px] text-brand-500 hover:text-brand-700 flex items-center gap-1"
                >
                  <Icon name="Message" size={12} /> 댓글 달기
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
          >
            <Icon name="ChevronDown" size={16} className="rotate-90" />
          </button>
          <span className="text-xs text-gray-600">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
          >
            <Icon name="ChevronDown" size={16} className="-rotate-90" />
          </button>
        </div>
      )}
    </div>
  );
}
