import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET: 콘텐츠 상세 조회 + 조회수 증가
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const contentId = params.id;

  const post = await prisma.contentPost.findUnique({
    where: { id: contentId },
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

  if (!post) return NextResponse.json({ error: "콘텐츠 없음" }, { status: 404 });

  // 조회수 증가
  await prisma.contentPost.update({
    where: { id: contentId },
    data: { viewCount: { increment: 1 } },
  });

  const commentCount = await prisma.contentComment.count({ where: { contentId } });

  return NextResponse.json({
    post: {
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
          comparePrice: t.product.comparePrice ? Number(t.product.comparePrice) : null,
        },
      })),
    },
  });
}
