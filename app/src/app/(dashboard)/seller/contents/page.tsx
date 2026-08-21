import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {Sparkles, Image as ImageIcon} from 'lucide-react';
import ContentPostForm from "@/components/shared/ContentPostForm";
import PaginatedContentList from "./PaginatedContentList";

export const dynamic = "force-dynamic";

export default async function SellerContentsPage() {
  const session = await auth();
  if (session?.user?.role !== "SELLER") redirect("/");

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session!.user!.id },
    include: {
      contentPosts: {
        include: {
          shoppingTags: {
            include: {
              product: { select: { id: true, name: true, thumbnail: true, basePrice: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!seller) redirect("/");

  // 쇼핑태그의 product.basePrice 는 Prisma Decimal 이라 클라이언트 컴포넌트로
  // 그대로 넘길 수 없으므로 Number 로 직렬화한다. (나머지 필드는 그대로 유지)
  const posts = (seller.contentPosts || []).map((p) => ({
    ...p,
    shoppingTags: p.shoppingTags.map((t) => ({
      ...t,
      product: t.product ? { ...t.product, basePrice: Number(t.product.basePrice) } : t.product,
    })),
  }));
  // 승인 대기: 공개 신청했지만 아직 승인되지 않은 콘텐츠
  const pendingPosts = posts.filter((p) => p.isPublished && !p.isApproved);
  // 공개 중: 승인 완료 + 공개 상태
  const publishedPosts = posts.filter((p) => p.isPublished && p.isApproved);
  // 비공개: 공개하지 않은 콘텐츠 (임시저장)
  const draftPosts = posts.filter((p) => !p.isPublished);

  const totalViews = posts.reduce((sum, p) => sum + p.viewCount, 0);
  const totalLikes = posts.reduce((sum, p) => sum + p.likeCount, 0);
  const totalTags = posts.reduce((sum, p) => sum + p.shoppingTags.length, 0);

  return (
    <div className="animate-fade-in">
      {/* Header - 모바일 최적화 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={18} className="text-brand-500" />
            콘텐츠 관리
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            SNS 스타일 콘텐츠를 등록하고 쇼핑 태그로 상품을 연결하세요
          </p>
        </div>
        <ContentPostForm />
      </div>

      {/* 통계 카드 - 모바일 2x2 그리드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
            <ImageIcon size={13} className="text-blue-500" />
            <span className="text-[10px] text-gray-400">전체 콘텐츠</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-gray-900">{posts.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
            <Icon name="Eye" size={13} className="text-green-500" />
            <span className="text-[10px] text-gray-400">총 조회수</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-gray-900">{totalViews.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
            <Icon name="Wishlist" size={13} className="text-red-500" />
            <span className="text-[10px] text-gray-400">총 좋아요</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-gray-900">{totalLikes.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
            <Icon name="Tag" size={13} className="text-brand-500" />
            <span className="text-[10px] text-gray-400">쇼핑 태그</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-gray-900">{totalTags}</p>
        </div>
      </div>

      {/* 승인 대기 */}
      {pendingPosts.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2.5">
            <Icon name="Clock" size={16} strokeWidth={1.5} className="text-yellow-500" />
            <h2 className="text-sm font-bold text-gray-700">승인 대기 ({pendingPosts.length})</h2>
          </div>
          <div className="bg-yellow-50 rounded-xl border border-yellow-100 overflow-hidden">
            <PaginatedContentList posts={pendingPosts} status="pending" divideClassName="divide-y divide-yellow-100" />
          </div>
        </div>
      )}

      {/* 공개 중 */}
      {publishedPosts.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2.5">
            <Icon name="Check" size={16} strokeWidth={1.5} className="text-green-500" />
            <h2 className="text-sm font-bold text-gray-700">공개 중 ({publishedPosts.length})</h2>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <PaginatedContentList posts={publishedPosts} status="published" divideClassName="divide-y divide-gray-50" />
          </div>
        </div>
      )}

      {/* 비공개 */}
      {draftPosts.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2.5">
            <Icon name="Close" size={16} strokeWidth={1.5} className="text-gray-400" />
            <h2 className="text-sm font-bold text-gray-700">비공개 ({draftPosts.length})</h2>
          </div>
          <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
            <PaginatedContentList posts={draftPosts} status="draft" divideClassName="divide-y divide-gray-100" />
          </div>
        </div>
      )}

      {posts.length === 0 && (
        <div className="text-center py-16 sm:py-20 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Sparkles size={40} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">등록된 콘텐츠가 없습니다</p>
          <p className="text-xs mt-1 text-gray-400">스트릿 패션, 룩북, 스타일링 콘텐츠를 등록해보세요!</p>
          <p className="text-xs mt-1 text-gray-400">이미지에 쇼핑 태그를 달면 팬들이 바로 구매할 수 있어요</p>
        </div>
      )}
    </div>
  );
}
