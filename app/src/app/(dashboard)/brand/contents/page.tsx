import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";
import {Sparkles, Image as ImageIcon, Tag, Clock, CheckCircle2, XCircle} from 'lucide-react';
import SafeImage from "@/components/shared/SafeImage";
import ProductSalesDetail from "@/components/shared/ProductSalesDetail";
import PaginatedBrandContentsList from "./PaginatedBrandContentsList";

export const dynamic = "force-dynamic";

export default async function BrandContentsPage() {
  const session = await auth();
  if (session?.user?.role !== "BRAND_ADMIN") redirect("/");

  const brand = await prisma.brandProfile.findUnique({
    where: { userId: session!.user!.id },
    include: {
      products: { select: { id: true, name: true, thumbnail: true, supplyPrice: true } },
    },
  });
  if (!brand) redirect("/");

  // My product IDs for matching
  const myProductIds = new Set(brand.products.map(p => p.id));
  const productLookup: Record<string, { id: string; name: string; thumbnail: string | null; supplyPrice: number | null }> = {};
  for (const p of brand.products) {
    productLookup[p.id] = { ...p, supplyPrice: p.supplyPrice != null ? Number(p.supplyPrice) : null };
  }

  // Get content posts from sellers who sell this brand's products
  const posts = await prisma.contentPost.findMany({
    where: {
      seller: {
        shopProducts: {
          some: {
            product: { brandId: brand.id },
          },
        },
      },
    },
    include: {
      seller: {
        select: { id: true, shopName: true, shopLogo: true, slug: true },
      },
      shoppingTags: {
        include: {
          product: { select: { id: true, name: true, thumbnail: true, brandId: true } },
        },
      },
      _count: {
        select: { likes: true, comments: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const publishedPosts = posts.filter((p) => p.isPublished && p.isApproved);
  const pendingPosts = posts.filter((p) => !p.isApproved);
  const draftPosts = posts.filter((p) => p.isApproved && !p.isPublished);

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={20} className="text-brand-500" />
            콘텐츠 관리
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">브랜드 관련 라이브 셀러 콘텐츠 {posts.length}건</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-lg font-bold text-gray-900">{publishedPosts.length}</p>
          <p className="text-[10px] text-gray-400">공개</p>
        </div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-100 p-3 text-center">
          <p className="text-lg font-bold text-yellow-700">{pendingPosts.length}</p>
          <p className="text-[10px] text-yellow-600">대기</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-lg font-bold text-gray-900">{draftPosts.length}</p>
          <p className="text-[10px] text-gray-400">비공개</p>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-16 sm:py-20 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Sparkles size={48} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">관련 콘텐츠가 없습니다</p>
          <p className="text-xs mt-1 text-gray-400">라이브 셀러가 콘텐츠를 등록하면 여기에 표시됩니다</p>
        </div>
      ) : (
        <PaginatedBrandContentsList
          items={posts.map((post) => ({
            id: post.id,
            title: post.title,
            images: post.images,
            isPublished: post.isPublished,
            isApproved: post.isApproved,
            viewCount: post.viewCount,
            createdAt: post.createdAt.toISOString(),
            seller: { shopName: post.seller.shopName },
            _count: { likes: post._count.likes, comments: post._count.comments },
            shoppingTags: post.shoppingTags.map((tag) => ({
              id: tag.id,
              product: {
                id: tag.product.id,
                name: tag.product.name,
                thumbnail: tag.product.thumbnail,
              },
            })),
          }))}
          myProductIds={Array.from(myProductIds)}
        />
      )}
    </div>
  );
}
