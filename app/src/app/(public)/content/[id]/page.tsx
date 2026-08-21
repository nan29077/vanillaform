import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";
import { notFound } from "next/navigation";
import ContentDetailClient from "./ContentDetailClient";
import { getFeatureFlags } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const { brix: FEATURE_BRIX } = await getFeatureFlags();
  if (!FEATURE_BRIX) notFound();

  const resolvedParams = await Promise.resolve(params);
  const post = await prisma.contentPost.findUnique({
    where: { id: resolvedParams.id },
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
  });

  if (!post || (!post.isPublished && !post.isApproved)) {
    notFound();
  }

  // 조회수 증가
  await prisma.contentPost.update({
    where: { id: resolvedParams.id },
    data: { viewCount: { increment: 1 } },
  });

  const commentCount = await prisma.contentComment.count({
    where: { contentId: resolvedParams.id },
  });

  const serialized = {
    id: post.id,
    title: post.title,
    content: post.content,
    images: parseJsonArray(post.images),
    likeCount: post.likeCount,
    viewCount: post.viewCount + 1,
    commentCount,
    createdAt: post.createdAt.toISOString(),
    seller: post.seller,
    shoppingTags: post.shoppingTags.map((t) => ({
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
        comparePrice: t.product.comparePrice != null ? Number(t.product.comparePrice) : null,
      },
    })),
  };

  return <ContentDetailClient post={serialized} />;
}
