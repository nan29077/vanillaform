import { Icon } from '@/components/shared/Icon';
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice, parseJsonArray } from "@/lib/utils";
import SafeImage from "@/components/shared/SafeImage";
import ContentFeedClient from "@/components/shared/ContentFeedClient";
import ContentSearchHeader from "@/components/shared/ContentSearchHeader";
;
import { getFeatureFlags } from "@/lib/settings";

export const dynamic = "force-dynamic";

const CONTENT_CATEGORIES = [
  { label: "전체", value: "" },
  { label: "패션", value: "패션" },
  { label: "뷰티", value: "뷰티" },
  { label: "라이프스타일", value: "라이프스타일" },
  { label: "홈리빙", value: "홈리빙" },
  { label: "푸드", value: "푸드" },
  { label: "디지털", value: "디지털" },
  { label: "여행", value: "여행" },
  { label: "키즈", value: "키즈" },
];

export default async function ContentPage({
  searchParams,
}: {
  searchParams: { category?: string; hashtag?: string };
}) {
  const { brix: FEATURE_BRIX } = await getFeatureFlags();
  if (!FEATURE_BRIX) notFound();

  const selectedCategory = searchParams.category || "";
  const selectedHashtag = searchParams.hashtag || "";

  const where: any = { isPublished: true, isApproved: true };
  if (selectedCategory) {
    where.category = selectedCategory;
  }
  if (selectedHashtag) {
    const searchTag = selectedHashtag.startsWith("#") ? selectedHashtag : `#${selectedHashtag}`;
    where.hashtags = { contains: searchTag };
  }

  const posts = await prisma.contentPost.findMany({
    where,
    include: {
      seller: { select: { id: true, shopName: true, shopLogo: true, slug: true } },
      shoppingTags: {
        include: {
          product: {
            select: { id: true, name: true, thumbnail: true, basePrice: true, comparePrice: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Get popular hashtags for display
  const allPosts = await prisma.contentPost.findMany({
    where: { isPublished: true, isApproved: true },
    select: { hashtags: true },
  });

  // Count hashtag frequency
  const hashtagCounts: Record<string, number> = {};
  for (const p of allPosts) {
    for (const tag of parseJsonArray(p.hashtags)) {
      hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
    }
  }
  const popularHashtags = Object.entries(hashtagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([tag, count]) => ({ tag, count }));

  const serialized = posts.map((p) => ({
    id: p.id,
    title: p.title,
    content: p.content,
    images: parseJsonArray(p.images),
    category: p.category,
    hashtags: parseJsonArray(p.hashtags),
    likeCount: p.likeCount,
    viewCount: p.viewCount,
    createdAt: p.createdAt.toISOString(),
    seller: p.seller,
    shoppingTags: p.shoppingTags.map((t) => ({
      id: t.id,
      productId: t.productId,
      imageIndex: t.imageIndex,
      posX: t.posX,
      posY: t.posY,
      label: t.label,
      product: {
        id: t.product.id,
        name: t.product.name,
        thumbnail: t.product.thumbnail,
        basePrice: Number(t.product.basePrice),
        comparePrice: t.product.comparePrice ? Number(t.product.comparePrice) : null,
      },
    })),
  }));

  return (
    <div className="animate-fade-in pb-4">
      <ContentSearchHeader
        selectedCategory={selectedCategory}
        selectedHashtag={selectedHashtag}
        categories={CONTENT_CATEGORIES}
        popularHashtags={popularHashtags}
      />

      {/* 현재 검색 태그 표시 */}
      {selectedHashtag && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-brand-600">{selectedHashtag.startsWith("#") ? selectedHashtag : `#${selectedHashtag}`}</span>
            <span className="text-xs text-gray-400">{serialized.length}개의 콘텐츠</span>
            <Link href="/content" className="ml-auto text-xs text-gray-400 hover:text-gray-600">
              전체보기
            </Link>
          </div>
        </div>
      )}

      {serialized.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Icon name="Camera" size={48} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {selectedHashtag
              ? `'${selectedHashtag}' 태그의 콘텐츠가 없습니다`
              : selectedCategory
              ? `'${selectedCategory}' 카테고리에 등록된 콘텐츠가 없습니다`
              : "아직 등록된 콘텐츠가 없습니다"}
          </p>
        </div>
      ) : (
        <ContentFeedClient posts={serialized} />
      )}
    </div>
  );
}
