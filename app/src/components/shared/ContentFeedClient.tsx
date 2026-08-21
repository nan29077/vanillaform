"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import Link from "next/link";
import {List, Hash} from 'lucide-react';
import SafeImage from "@/components/shared/SafeImage";

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
  hashtags?: string[];
  likeCount: number;
  viewCount: number;
  createdAt: string;
  seller: { id: string; shopName: string; shopLogo: string | null; slug: string };
  shoppingTags: ShoppingTag[];
}

export default function ContentFeedClient({ posts }: { posts: ContentPost[] }) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  return (
    <div>
      {/* 뷰 모드 토글 */}
      <div className="flex items-center justify-end px-4 mb-3 gap-1">
        <button
          onClick={() => setViewMode("grid")}
          className={`p-1.5 rounded-lg transition-colors ${viewMode === "grid" ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-400 hover:text-gray-600"}`}
          aria-label="카드 보기"
        >
          <Icon name="Category" size={16} />
        </button>
        <button
          onClick={() => setViewMode("list")}
          className={`p-1.5 rounded-lg transition-colors ${viewMode === "list" ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-400 hover:text-gray-600"}`}
          aria-label="한 줄 보기"
        >
          <List size={16} />
        </button>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-2 px-4 pb-20">
          {posts.map((post) => (
            <ContentGridCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="space-y-2 px-4 pb-20">
          {posts.map((post) => (
            <ContentListCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}

function ContentGridCard({ post }: { post: ContentPost }) {
  const formatPrice = (n: number) => n.toLocaleString("ko-KR") + "원";
  const uniqueProducts = [...new Map(post.shoppingTags.map((t) => [t.productId, t])).values()];

  return (
    <Link href={`/content/${post.id}`} className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-all">
      {/* 이미지 */}
      <div className="relative aspect-[3/4] bg-gray-50 overflow-hidden">
        <SafeImage
          src={post.images[0]}
          alt={post.title}
          width={200}
          height={267}
          fallbackText="Style"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {post.images.length > 1 && (
          <span className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[9px] font-medium px-1.5 py-0.5 rounded-full">
            +{post.images.length - 1}
          </span>
        )}

        {post.shoppingTags.length > 0 && (
          <span className="absolute top-2 right-2 flex items-center gap-0.5 text-[9px] bg-white/90 backdrop-blur-sm text-brand-600 px-1.5 py-0.5 rounded-full font-semibold shadow-sm">
            <Icon name="Cart" size={9} /> {post.shoppingTags.length}
          </span>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-full overflow-hidden bg-white/30 flex-shrink-0 ring-1 ring-white/50">
              <SafeImage src={post.seller.shopLogo} alt={post.seller.shopName} width={20} height={20} fallbackText={post.seller.shopName.charAt(0)} />
            </div>
            <span className="text-[10px] text-white/90 font-medium truncate">{post.seller.shopName}</span>
          </div>
          <p className="text-xs font-bold text-white line-clamp-2 leading-snug drop-shadow-sm">{post.title}</p>
        </div>
      </div>

      <div className="px-2.5 py-2">
        <div className="flex items-center gap-3 mb-1.5">
          <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
            <Icon name="Wishlist" size={10} className="text-rose-400" /> {post.likeCount}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
            <Icon name="Eye" size={10} /> {post.viewCount}
          </span>
          {post.shoppingTags.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-brand-500 ml-auto">
              <Icon name="Tag" size={9} /> {uniqueProducts.length}
            </span>
          )}
        </div>

        {/* 해시태그 표시 */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {post.hashtags.slice(0, 3).map((tag, i) => (
              <Link key={i} href={`/content?hashtag=${encodeURIComponent(tag)}`}
                className="text-[9px] text-brand-500 bg-brand-50 px-1.5 py-0.5 rounded-full hover:bg-brand-100 transition-colors"
                onClick={(e) => e.stopPropagation()}>
                {tag}
              </Link>
            ))}
            {post.hashtags.length > 3 && (
              <span className="text-[8px] text-gray-400">+{post.hashtags.length - 3}</span>
            )}
          </div>
        )}

        {uniqueProducts.length > 0 && (
          <div className="flex items-center gap-1 overflow-hidden">
            {uniqueProducts.slice(0, 2).map((tag) => (
              <div key={tag.id} className="flex items-center gap-1 bg-gray-50 rounded px-1.5 py-0.5 min-w-0">
                {tag.product.thumbnail && (
                  <div className="w-4 h-4 rounded overflow-hidden flex-shrink-0 bg-gray-100">
                    <img src={tag.product.thumbnail} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <span className="text-[8px] text-gray-600 truncate">{formatPrice(tag.product.basePrice)}</span>
              </div>
            ))}
            {uniqueProducts.length > 2 && (
              <span className="text-[8px] text-gray-400 flex-shrink-0">+{uniqueProducts.length - 2}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

function ContentListCard({ post }: { post: ContentPost }) {
  const formatPrice = (n: number) => n.toLocaleString("ko-KR") + "원";
  const uniqueProducts = [...new Map(post.shoppingTags.map((t) => [t.productId, t])).values()];

  return (
    <Link href={`/content/${post.id}`} className="group flex gap-3 bg-white rounded-xl border border-gray-100 p-3 hover:shadow-md transition-all">
      {/* 썸네일 */}
      <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-50">
        <SafeImage
          src={post.images[0]}
          alt={post.title}
          width={80}
          height={80}
          fallbackText="Style"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {post.images.length > 1 && (
          <span className="absolute top-1 left-1 bg-black/50 backdrop-blur-sm text-white text-[8px] font-medium px-1 py-0.5 rounded-full">
            +{post.images.length - 1}
          </span>
        )}
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-4 h-4 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
              <SafeImage src={post.seller.shopLogo} alt={post.seller.shopName} width={16} height={16} fallbackText={post.seller.shopName.charAt(0)} />
            </div>
            <span className="text-[10px] text-gray-500 truncate">{post.seller.shopName}</span>
          </div>
          <p className="text-sm font-bold text-gray-900 line-clamp-1 leading-snug">{post.title}</p>
          {post.content && (
            <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">{post.content}</p>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1.5">
          <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
            <Icon name="Wishlist" size={10} className="text-rose-400" /> {post.likeCount}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
            <Icon name="Eye" size={10} /> {post.viewCount}
          </span>
          {post.shoppingTags.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-brand-500">
              <Icon name="Cart" size={9} /> {uniqueProducts.length}개 상품
            </span>
          )}
        </div>
        {/* 해시태그 표시 */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {post.hashtags.slice(0, 2).map((tag, i) => (
              <Link key={i} href={`/content?hashtag=${encodeURIComponent(tag)}`}
                className="text-[9px] text-brand-500 bg-brand-50 px-1.5 py-0.5 rounded-full hover:bg-brand-100 transition-colors"
                onClick={(e) => e.stopPropagation()}>
                {tag}
              </Link>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
