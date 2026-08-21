import { Icon } from '@/components/shared/Icon';
import { redirect, notFound } from "next/navigation";
import { NO_IMAGE } from "@/lib/defaults";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice, parseJsonArray } from "@/lib/utils";
import { Hash, User, Clock, CheckCircle2, XCircle, Image as ImageIcon} from 'lucide-react';
import SafeImage from "@/components/shared/SafeImage";

export const dynamic = "force-dynamic";

export default async function BrandContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const session = await auth();
  if (session?.user?.role !== "BRAND_ADMIN") redirect("/");

  const brand = await prisma.brandProfile.findUnique({
    where: { userId: session!.user!.id },
  });
  if (!brand) redirect("/");

  const post = await prisma.contentPost.findUnique({
    where: { id: resolvedParams.id },
    include: {
      seller: {
        select: {
          id: true, shopName: true, shopLogo: true, slug: true,
          user: { select: { name: true } },
        },
      },
      shoppingTags: {
        include: {
          product: {
            select: { id: true, name: true, thumbnail: true, supplyPrice: true, slug: true },
          },
        },
      },
      comments: {
        include: {
          user: { select: { name: true, avatar: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      _count: {
        select: { likes: true, comments: true },
      },
    },
  });

  if (!post) notFound();

  // Verify this content is related to the brand's products
  const hasRelation = await prisma.sellerShopProduct.findFirst({
    where: {
      sellerId: post.sellerId,
      product: { brandId: brand.id },
    },
  });

  // Allow viewing even if no direct relation (brand may want to see all seller content)

  const status = !post.isApproved ? "pending" : post.isPublished ? "published" : "draft";
  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: "승인대기", color: "text-yellow-600 bg-yellow-50 border-yellow-200", icon: Clock },
    published: { label: "공개", color: "text-green-600 bg-green-50 border-green-200", icon: CheckCircle2 },
    draft: { label: "비공개", color: "text-gray-500 bg-gray-100 border-gray-200", icon: XCircle },
  };
  const st = statusConfig[status];

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      {/* Back */}
      <Link href="/brand/contents" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <Icon name="ChevronDown" size={16} className="rotate-90" /> 콘텐츠 목록
      </Link>

      {/* Status Badge */}
      <div className="mb-4">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${st.color}`}>
          <st.icon size={12} />
          {st.label}
        </span>
      </div>

      {/* Seller Info */}
      <div className="flex items-center gap-3 mb-5 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
        <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
          <SafeImage src={post.seller.shopLogo} alt={post.seller.shopName} width={40} height={40} fallbackText={post.seller.shopName.charAt(0)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{post.seller.shopName}</p>
          <p className="text-xs text-gray-500">{post.seller.user?.name || "라이브 셀러"}</p>
        </div>
        <Link href={`/shop/${post.seller.slug}`} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
          샵 보기 →
        </Link>
      </div>

      {/* Title & Meta */}
      <h1 className="text-xl font-bold text-gray-900 mb-2">{post.title}</h1>
      <div className="flex items-center gap-3 text-xs text-gray-400 mb-5">
        <span className="flex items-center gap-1"><Icon name="Calendar" size={12} /> {formatDate(post.createdAt)}</span>
        <span className="flex items-center gap-1"><Icon name="Eye" size={12} /> {post.viewCount}</span>
        <span className="flex items-center gap-1"><Icon name="Wishlist" size={12} /> {post._count.likes}</span>
        <span className="flex items-center gap-1"><Icon name="Message" size={12} /> {post._count.comments}</span>
      </div>

      {/* Images */}
      {parseJsonArray(post.images).length > 0 && (
        <div className="mb-5 space-y-2">
          {parseJsonArray(post.images).map((img, i) => (
            <div key={i} className="rounded-xl overflow-hidden bg-gray-100">
              <img src={img} alt={`${post.title} ${i + 1}`} className="w-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {post.content && (
        <div className="mb-5 bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{post.content}</p>
        </div>
      )}

      {/* Category & Hashtags */}
      <div className="flex flex-wrap gap-2 mb-5">
        {post.category && (
          <span className="inline-flex items-center gap-1 text-xs bg-brand-50 text-brand-600 px-2.5 py-1 rounded-full">
            <Icon name="Tag" size={10} /> {post.category}
          </span>
        )}
        {parseJsonArray(post.hashtags).map((tag, i) => (
          <span key={i} className="text-xs text-blue-500 bg-blue-50 px-2.5 py-1 rounded-full">
            <Hash size={10} className="inline mr-0.5" />{tag.replace(/^#/, "")}
          </span>
        ))}
      </div>

      {/* Shopping Tags / Tagged Products */}
      {post.shoppingTags.length > 0 && (
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
            <Icon name="Cart" size={14} /> 태그된 상품 ({post.shoppingTags.length})
          </h3>
          <div className="space-y-2">
            {post.shoppingTags.map((tag) => (
              <div key={tag.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                  <SafeImage src={tag.product?.thumbnail} placeholder={NO_IMAGE} alt={tag.product?.name || ""} width={48} height={48} fallbackText="P" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{tag.product?.name}</p>
                  <p className="text-xs text-brand-600 font-semibold">{tag.product?.supplyPrice != null ? formatPrice(Number(tag.product.supplyPrice)) : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments Preview */}
      {post.comments.length > 0 && (
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
            <Icon name="Message" size={14} /> 댓글 ({post._count.comments})
          </h3>
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
            {post.comments.slice(0, 5).map((comment) => (
              <div key={comment.id} className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                    <SafeImage src={comment.user?.avatar} alt={comment.user?.name || ""} width={24} height={24} fallbackText={comment.user?.name?.charAt(0) || "?"} />
                  </div>
                  <span className="text-xs font-medium text-gray-700">{comment.user?.name || "익명"}</span>
                  <span className="text-[10px] text-gray-400">{new Date(comment.createdAt).toLocaleDateString("ko-KR")}</span>
                </div>
                <p className="text-xs text-gray-600 ml-8">{comment.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <Icon name="Eye" size={16} className="mx-auto mb-1 text-gray-400" />
          <p className="text-lg font-bold text-gray-900">{post.viewCount}</p>
          <p className="text-[10px] text-gray-400">조회수</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <Icon name="Wishlist" size={16} className="mx-auto mb-1 text-pink-400" />
          <p className="text-lg font-bold text-gray-900">{post._count.likes}</p>
          <p className="text-[10px] text-gray-400">좋아요</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <Icon name="Message" size={16} className="mx-auto mb-1 text-blue-400" />
          <p className="text-lg font-bold text-gray-900">{post._count.comments}</p>
          <p className="text-[10px] text-gray-400">댓글</p>
        </div>
      </div>
    </div>
  );
}
