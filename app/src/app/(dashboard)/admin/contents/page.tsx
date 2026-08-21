import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {Sparkles} from 'lucide-react';
import PaginatedContentList from "./PaginatedContentList";

export const dynamic = "force-dynamic";

export default async function AdminContentsPage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/");

  // Get all products owned by admin (no specific brand filter for super admin)
  const allProducts = await prisma.product.findMany({
    select: { id: true, name: true, thumbnail: true, basePrice: true },
  });
  const allProductIds = new Set(allProducts.map(p => p.id));
  const productLookup: Record<string, { id: string; name: string; thumbnail: string | null; basePrice: number }> = {};
  for (const p of allProducts) {
    productLookup[p.id] = { ...p, basePrice: Number(p.basePrice) };
  }

  const rawPosts = await prisma.contentPost.findMany({
    include: {
      seller: {
        select: { id: true, shopName: true, shopLogo: true, slug: true, user: { select: { name: true } } },
      },
      shoppingTags: {
        include: {
          product: { select: { id: true, name: true, thumbnail: true, basePrice: true, brandId: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // 쇼핑태그의 product.basePrice 는 Prisma Decimal 이라 클라이언트 컴포넌트로
  // 그대로 넘길 수 없으므로 Number 로 직렬화한다.
  const posts = rawPosts.map((p) => ({
    ...p,
    shoppingTags: p.shoppingTags.map((t) => ({
      ...t,
      product: t.product ? { ...t.product, basePrice: Number(t.product.basePrice) } : t.product,
    })),
  }));

  const totalCount = posts.length;
  const pendingCount = posts.filter((p) => !p.isApproved).length;
  const publishedCount = posts.filter((p) => p.isPublished && p.isApproved).length;
  const totalTags = posts.reduce((sum, p) => sum + p.shoppingTags.length, 0);
  const totalViews = posts.reduce((sum, p) => sum + p.viewCount, 0);

  const pendingPosts = posts.filter((p) => !p.isApproved);
  const publishedPosts = posts.filter((p) => p.isApproved && p.isPublished);
  const unpublishedPosts = posts.filter((p) => p.isApproved && !p.isPublished);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={20} className="text-brand-500" />
            콘텐츠 관리
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            라이브 셀러 콘텐츠 승인, 쇼핑 태그 관리
          </p>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="Chart" size={14} className="text-gray-500" />
            <span className="text-[10px] text-gray-400">전체</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{totalCount}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="Clock" size={14} className="text-yellow-500" />
            <span className="text-[10px] text-yellow-600">승인 대기</span>
          </div>
          <p className="text-xl font-bold text-yellow-700">{pendingCount}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="Check" size={14} className="text-green-500" />
            <span className="text-[10px] text-green-600">공개중</span>
          </div>
          <p className="text-xl font-bold text-green-700">{publishedCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="Eye" size={14} className="text-blue-500" />
            <span className="text-[10px] text-gray-400">총 조회수</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{totalViews.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="Tag" size={14} className="text-brand-500" />
            <span className="text-[10px] text-gray-400">쇼핑 태그</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{totalTags}</p>
        </div>
      </div>

      {/* 승인 대기 */}
      {pendingPosts.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="Clock" size={16} strokeWidth={1.5} className="text-yellow-500" />
            <h2 className="text-sm font-bold text-gray-700">승인 대기 ({pendingPosts.length})</h2>
          </div>
          <div className="bg-yellow-50 rounded-xl border border-yellow-100 overflow-hidden">
            <PaginatedContentList items={pendingPosts} status="pending" allProductIds={allProductIds} divideClassName="divide-yellow-100" />
          </div>
        </div>
      )}

      {/* 공개 중 */}
      {publishedPosts.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="Check" size={16} strokeWidth={1.5} className="text-green-500" />
            <h2 className="text-sm font-bold text-gray-700">공개 중 ({publishedPosts.length})</h2>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <PaginatedContentList items={publishedPosts} status="published" allProductIds={allProductIds} divideClassName="divide-gray-50" />
          </div>
        </div>
      )}

      {/* 비공개 */}
      {unpublishedPosts.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="Close" size={16} strokeWidth={1.5} className="text-gray-400" />
            <h2 className="text-sm font-bold text-gray-700">비공개 ({unpublishedPosts.length})</h2>
          </div>
          <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
            <PaginatedContentList items={unpublishedPosts} status="draft" allProductIds={allProductIds} divideClassName="divide-gray-100" />
          </div>
        </div>
      )}

      {posts.length === 0 && (
        <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Sparkles size={48} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">등록된 콘텐츠가 없습니다</p>
        </div>
      )}
    </div>
  );
}
