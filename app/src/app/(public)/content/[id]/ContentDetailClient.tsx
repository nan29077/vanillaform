"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Tag, X, MoreHorizontal} from 'lucide-react';
import SafeImage from "@/components/shared/SafeImage";
import { pickBuyerAvatar } from "@/lib/defaults";

interface ShoppingTag {
  id: string;
  productId: string;
  imageIndex: number;
  posX: number;
  posY: number;
  label: string | null;
  product: {
    id: string;
    name: string;
    thumbnail: string | null;
    basePrice: number;
    comparePrice: number | null;
  };
}

interface ContentPost {
  id: string;
  title: string;
  content: string | null;
  images: string[];
  likeCount: number;
  viewCount: number;
  commentCount: number;
  createdAt: string;
  seller: { id: string; shopName: string; shopLogo: string | null; slug: string };
  shoppingTags: ShoppingTag[];
}

interface Comment {
  id: string;
  text: string;
  createdAt: string;
  user: { id: string; name: string; avatar: string | null };
  replies: Comment[];
}

export default function ContentDetailClient({ post }: { post: ContentPost }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [activeImg, setActiveImg] = useState(0);
  const [showTags, setShowTags] = useState(true);
  const [selectedTag, setSelectedTag] = useState<ShoppingTag | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [loadingLike, setLoadingLike] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const currentTags = post.shoppingTags.filter((t) => t.imageIndex === activeImg);
  const formatPrice = (n: number) => n.toLocaleString("ko-KR") + "원";
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "방금 전";
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}일 전`;
    return new Date(dateStr).toLocaleDateString("ko-KR");
  };

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/content/${post.id}` : "";

  // 좋아요 상태 조회
  useEffect(() => {
    fetch(`/api/content-posts/${post.id}/like`)
      .then((r) => r.json())
      .then((d) => { setIsLiked(d.isLiked); setLikeCount(d.likeCount); })
      .catch(() => {});
  }, [post.id]);

  // 댓글 목록 조회
  useEffect(() => {
    if (showComments) {
      fetch(`/api/content-posts/${post.id}/comments`)
        .then((r) => r.json())
        .then((d) => { setComments(d.comments || []); setCommentCount(d.totalCount || 0); })
        .catch(() => {});
    }
  }, [showComments, post.id]);

  const toggleLike = async () => {
    if (!session) { router.push("/auth/login"); return; }
    setLoadingLike(true);
    try {
      const res = await fetch(`/api/content-posts/${post.id}/like`, { method: "POST" });
      const data = await res.json();
      setIsLiked(data.isLiked);
      setLikeCount(data.likeCount);
    } catch {} finally { setLoadingLike(false); }
  };

  const submitComment = async () => {
    if (!session) { router.push("/auth/login"); return; }
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/content-posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: commentText, parentId: replyTo?.id || null }),
      });
      const data = await res.json();
      if (data.comment) {
        if (replyTo) {
          setComments((prev) => prev.map((c) =>
            c.id === replyTo.id ? { ...c, replies: [...c.replies, data.comment] } : c
          ));
        } else {
          setComments((prev) => [data.comment, ...prev]);
        }
        setCommentCount((prev) => prev + 1);
      }
      setCommentText("");
      setReplyTo(null);
    } catch {} finally { setSubmitting(false); }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await fetch(`/api/content-posts/${post.id}/comments?commentId=${commentId}`, { method: "DELETE" });
      setComments((prev) => prev.filter((c) => c.id !== commentId).map((c) => ({
        ...c,
        replies: c.replies.filter((r) => r.id !== commentId),
      })));
      setCommentCount((prev) => prev - 1);
    } catch {}
  };

  const shareToSNS = (platform: string) => {
    const text = encodeURIComponent(`${post.title} - ${post.seller.shopName}`);
    const url = encodeURIComponent(shareUrl);
    const links: Record<string, string> = {
      kakao: `https://story.kakao.com/share?url=${url}`,
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      line: `https://social-plugins.line.me/lineit/share?url=${url}`,
      band: `https://band.us/plugin/share?body=${text}&route=${url}`,
    };
    if (platform === "copy") {
      navigator.clipboard?.writeText(shareUrl).then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      });
      return;
    }
    // 카카오톡 JS SDK
    if (platform === "kakaotalk") {
      if (typeof window !== "undefined" && (window as any).Kakao) {
        const Kakao = (window as any).Kakao;
        Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title: post.title,
            description: post.content || post.seller.shopName,
            imageUrl: post.images[0] || "",
            link: { webUrl: shareUrl, mobileWebUrl: shareUrl },
          },
        });
        return;
      }
      // 카카오톡 URL scheme fallback
      window.open(`https://sharer.kakao.com/talk/friends/picker/shorturl?url=${url}`, "_blank");
      return;
    }
    if (links[platform]) window.open(links[platform], "_blank", "width=600,height=400");
  };

  return (
    <div className="animate-fade-in pb-20 bg-white min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1 -ml-1">
          <Icon name="ArrowRight" size={20} className="text-gray-700 rotate-180" />
        </button>
        <div className="flex-1 min-w-0">
          <Link href={`/shop/${post.seller.slug}`} className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-100 ring-1 ring-gray-200">
              <SafeImage src={post.seller.shopLogo} alt={post.seller.shopName} width={28} height={28} fallbackText={post.seller.shopName.charAt(0)} />
            </div>
            <span className="text-sm font-semibold text-gray-900">{post.seller.shopName}</span>
          </Link>
        </div>
      </div>

      {/* Image Carousel */}
      <div className="relative aspect-square bg-gray-100 overflow-hidden">
        <img src={post.images[activeImg]} alt={post.title} className="w-full h-full object-cover" />

        {/* Shopping tags on image */}
        {showTags && currentTags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => setSelectedTag(selectedTag?.id === tag.id ? null : tag)}
            className="absolute group animate-fade-in"
            style={{ left: `${tag.posX}%`, top: `${tag.posY}%`, transform: "translate(-50%, -50%)" }}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all ${
              selectedTag?.id === tag.id ? "bg-brand-600 scale-110" : "bg-white/90 hover:bg-brand-600 hover:scale-110"
            }`}>
              <Icon name="Cart" size={14} className={selectedTag?.id === tag.id ? "text-white" : "text-brand-600 group-hover:text-white"} />
            </div>
          </button>
        ))}

        {/* Selected tag product card */}
        {selectedTag && (
          <div className="absolute bottom-3 left-3 right-3 animate-fade-in">
            <Link
              href={`/products/${selectedTag.product.id}`}
              className="flex items-center gap-3 bg-white/95 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-gray-100 hover:bg-white transition-colors"
            >
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                {selectedTag.product.thumbnail && <img src={selectedTag.product.thumbnail} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{selectedTag.product.name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  {selectedTag.product.comparePrice && selectedTag.product.comparePrice > selectedTag.product.basePrice && (
                    <span className="text-[10px] text-red-500 font-bold">
                      {Math.round((1 - selectedTag.product.basePrice / selectedTag.product.comparePrice) * 100)}%
                    </span>
                  )}
                  <span className="text-sm font-bold text-gray-900">{formatPrice(selectedTag.product.basePrice)}</span>
                </div>
              </div>
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center">
                <Icon name="Cart" size={14} />
              </div>
            </Link>
            <button onClick={(e) => { e.preventDefault(); setSelectedTag(null); }}
              className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-gray-800 text-white flex items-center justify-center shadow">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Image navigation */}
        {post.images.length > 1 && (
          <>
            {activeImg > 0 && (
              <button onClick={() => { setActiveImg(activeImg - 1); setSelectedTag(null); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50">
                <Icon name="ChevronDown" size={18} className="rotate-90" />
              </button>
            )}
            {activeImg < post.images.length - 1 && (
              <button onClick={() => { setActiveImg(activeImg + 1); setSelectedTag(null); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50">
                <Icon name="ChevronDown" size={18} className="-rotate-90" />
              </button>
            )}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {post.images.map((_, idx) => (
                <span key={idx} className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === activeImg ? "bg-white" : "bg-white/40"}`} />
              ))}
            </div>
          </>
        )}

        {/* Tag toggle */}
        {post.shoppingTags.length > 0 && (
          <button
            onClick={() => setShowTags(!showTags)}
            className={`absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium shadow-lg transition-all ${
              showTags ? "bg-brand-600 text-white" : "bg-white/90 text-gray-600"
            }`}
          >
            <Icon name="Cart" size={12} />
            {post.shoppingTags.length}
          </button>
        )}
      </div>

      {/* Actions bar */}
      <div className="px-4 py-3 flex items-center gap-5 border-b border-gray-50">
        <button onClick={toggleLike} disabled={loadingLike}
          className="flex items-center gap-1.5 transition-colors">
          <Icon name="Wishlist" size={22} strokeWidth={1.5}
            className={isLiked ? "fill-red-500 text-red-500" : "text-gray-600 hover:text-red-500"} />
          <span className={`text-sm font-medium ${isLiked ? "text-red-500" : "text-gray-600"}`}>{likeCount}</span>
        </button>
        <button onClick={() => setShowComments(true)} className="flex items-center gap-1.5 text-gray-600 hover:text-brand-600 transition-colors">
          <Icon name="Message" size={22} strokeWidth={1.5} />
          <span className="text-sm font-medium">{commentCount}</span>
        </button>
        <button onClick={() => setShowShareModal(true)} className="flex items-center gap-1.5 text-gray-600 hover:text-brand-600 transition-colors">
          <Icon name="Share" size={20} strokeWidth={1.5} />
        </button>
        <div className="flex items-center gap-1 text-gray-400 ml-auto">
          <Icon name="Eye" size={16} strokeWidth={1.5} />
          <span className="text-xs">{post.viewCount}</span>
        </div>
      </div>

      {/* Title & Content */}
      <div className="px-4 py-3">
        <p className="text-sm">
          <Link href={`/shop/${post.seller.slug}`} className="font-bold text-gray-900 mr-1.5">{post.seller.shopName}</Link>
          <span className="text-gray-800">{post.title}</span>
        </p>
        {post.content && <p className="text-sm text-gray-600 mt-2 leading-relaxed whitespace-pre-wrap">{post.content}</p>}
        <p className="text-xs text-gray-400 mt-2">{timeAgo(post.createdAt)}</p>
      </div>

      {/* Tagged products list */}
      {post.shoppingTags.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">쇼핑 태그 상품</p>
          <div className="space-y-2">
            {[...new Map(post.shoppingTags.map((t) => [t.productId, t])).values()].map((tag) => (
              <Link key={tag.id} href={`/products/${tag.product.id}`}
                className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 hover:bg-gray-100 transition-colors">
                <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                  {tag.product.thumbnail && <img src={tag.product.thumbnail} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{tag.product.name}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {tag.product.comparePrice && tag.product.comparePrice > tag.product.basePrice && (
                      <span className="text-[10px] text-red-500 font-bold">
                        {Math.round((1 - tag.product.basePrice / tag.product.comparePrice) * 100)}%
                      </span>
                    )}
                    <span className="text-sm font-bold text-gray-900">{formatPrice(tag.product.basePrice)}</span>
                  </div>
                </div>
                <Icon name="ChevronDown" size={16} className="text-gray-300 -rotate-90" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Comments Bottom Sheet */}
      {showComments && (
        <div className="fixed inset-0 z-[100]" onClick={() => setShowComments(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[75vh] flex flex-col animate-slide-up"
            onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">댓글 {commentCount}개</h3>
              <button onClick={() => setShowComments(false)} className="p-1"><X size={20} className="text-gray-500" /></button>
            </div>

            {/* Comment list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {comments.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Icon name="Message" size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">첫 번째 댓글을 남겨보세요!</p>
                </div>
              ) : (
                comments.map((c) => (
                  <div key={c.id}>
                    <CommentItem
                      comment={c}
                      currentUserId={session?.user?.id}
                      onReply={() => { setReplyTo({ id: c.id, name: c.user.name }); commentInputRef.current?.focus(); }}
                      onDelete={() => deleteComment(c.id)}
                      timeAgo={timeAgo}
                    />
                    {/* Replies */}
                    {c.replies.length > 0 && (
                      <div className="ml-10 mt-2 space-y-2">
                        {c.replies.map((r) => (
                          <CommentItem
                            key={r.id}
                            comment={r}
                            currentUserId={session?.user?.id}
                            onDelete={() => deleteComment(r.id)}
                            timeAgo={timeAgo}
                            isReply
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Comment input */}
            <div className="border-t border-gray-100 px-4 py-3">
              {replyTo && (
                <div className="flex items-center gap-2 mb-2 text-xs text-brand-600">
                  <span>@{replyTo.name}에게 답글</span>
                  <button onClick={() => setReplyTo(null)} className="text-gray-400"><X size={14} /></button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  ref={commentInputRef}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submitComment()}
                  placeholder={session ? "댓글을 입력하세요..." : "로그인 후 댓글을 남길 수 있습니다"}
                  className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  disabled={!session}
                />
                <button onClick={submitComment} disabled={!commentText.trim() || submitting}
                  className={`p-2.5 rounded-full transition-colors ${commentText.trim() ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-400"}`}>
                  <Icon name="Share" size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[100]" onClick={() => setShowShareModal(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3" />
            <div className="px-4 py-4">
              <h3 className="text-sm font-bold text-gray-900 mb-4">공유하기</h3>
              <div className="grid grid-cols-5 gap-4 mb-4">
                {[
                  { id: "kakaotalk", label: "카카오톡", color: "bg-[#FEE500]", textColor: "text-[#3C1E1E]", icon: "💬" },
                  { id: "twitter", label: "X", color: "bg-black", textColor: "text-white", icon: "𝕏" },
                  { id: "facebook", label: "Facebook", color: "bg-[#1877F2]", textColor: "text-white", icon: "f" },
                  { id: "line", label: "LINE", color: "bg-[#00B900]", textColor: "text-white", icon: "L" },
                  { id: "band", label: "밴드", color: "bg-[#6CC655]", textColor: "text-white", icon: "B" },
                ].map((sns) => (
                  <button key={sns.id} onClick={() => shareToSNS(sns.id)}
                    className="flex flex-col items-center gap-1.5">
                    <div className={`w-12 h-12 rounded-full ${sns.color} ${sns.textColor} flex items-center justify-center text-lg font-bold shadow-sm`}>
                      {sns.icon}
                    </div>
                    <span className="text-[10px] text-gray-600">{sns.label}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => shareToSNS("copy")}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gray-100 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
                {linkCopied ? <Icon name="Check" size={16} className="text-emerald-500" /> : <Icon name="Copy" size={16} />}
                {linkCopied ? "복사 완료!" : "링크 복사"}
              </button>
            </div>
            <div className="h-safe-bottom" />
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
        .h-safe-bottom { height: env(safe-area-inset-bottom, 0px); }
      `}</style>
    </div>
  );
}

/* Comment Item Component */
function CommentItem({
  comment,
  currentUserId,
  onReply,
  onDelete,
  timeAgo,
  isReply = false,
}: {
  comment: Comment;
  currentUserId?: string;
  onReply?: () => void;
  onDelete: () => void;
  timeAgo: (d: string) => string;
  isReply?: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const isOwner = currentUserId === comment.user.id;

  return (
    <div className="flex gap-2.5">
      <div className={`${isReply ? "w-7 h-7" : "w-8 h-8"} rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500 flex-shrink-0`}>
        <img
          src={comment.user.avatar || pickBuyerAvatar(comment.user.id)}
          className="w-full h-full rounded-full object-cover"
          alt=""
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-900">{comment.user.name}</span>
          <span className="text-[10px] text-gray-400">{timeAgo(comment.createdAt)}</span>
          {isOwner && (
            <div className="relative ml-auto">
              <button onClick={() => setShowMenu(!showMenu)} className="p-0.5"><MoreHorizontal size={14} className="text-gray-400" /></button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-10">
                  <button onClick={() => { onDelete(); setShowMenu(false); }}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 w-full">
                    <Icon name="Delete" size={12} /> 삭제
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">{comment.text}</p>
        {!isReply && onReply && (
          <button onClick={onReply} className="text-[10px] text-gray-400 hover:text-brand-500 mt-1 font-medium">
            답글 달기
          </button>
        )}
      </div>
    </div>
  );
}
