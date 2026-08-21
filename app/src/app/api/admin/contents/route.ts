import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET: 관리자 콘텐츠 목록 (전체)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // "pending" | "approved" | "all"

  let where: any = {};
  if (status === "pending") {
    where.isApproved = false;
  } else if (status === "approved") {
    where.isApproved = true;
  }

  const posts = await prisma.contentPost.findMany({
    where,
    include: {
      seller: { select: { id: true, shopName: true, shopLogo: true, slug: true, user: { select: { name: true } } } },
      shoppingTags: {
        include: {
          product: { select: { id: true, name: true, thumbnail: true, basePrice: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = posts.map((p) => ({
    id: p.id,
    title: p.title,
    content: p.content,
    images: parseJsonArray(p.images),
    isPublished: p.isPublished,
    isApproved: p.isApproved,
    viewCount: p.viewCount,
    likeCount: p.likeCount,
    createdAt: p.createdAt.toISOString(),
    seller: {
      id: p.seller.id,
      shopName: p.seller.shopName,
      shopLogo: p.seller.shopLogo,
      slug: p.seller.slug,
      userName: p.seller.user.name,
    },
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
      },
    })),
    tagCount: p.shoppingTags.length,
  }));

  // 통계
  const totalCount = await prisma.contentPost.count();
  const pendingCount = await prisma.contentPost.count({ where: { isApproved: false } });
  const approvedCount = await prisma.contentPost.count({ where: { isApproved: true } });
  const publishedCount = await prisma.contentPost.count({ where: { isPublished: true, isApproved: true } });

  return NextResponse.json({
    posts: serialized,
    stats: { totalCount, pendingCount, approvedCount, publishedCount },
  });
}

// PATCH: 콘텐츠 승인/거부/수정
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { id, action } = await req.json();
  if (!id || !action) return NextResponse.json({ error: "필수 정보 누락" }, { status: 400 });

  const post = await prisma.contentPost.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "콘텐츠 없음" }, { status: 404 });

  let updateData: any = {};
  if (action === "approve") {
    updateData = { isApproved: true, isPublished: true };
  } else if (action === "reject") {
    updateData = { isApproved: false, isPublished: false };
  } else if (action === "unpublish") {
    updateData = { isPublished: false };
  } else if (action === "publish") {
    updateData = { isPublished: true };
  } else {
    return NextResponse.json({ error: "잘못된 액션" }, { status: 400 });
  }

  const updated = await prisma.contentPost.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ post: updated, message: `${action} 완료` });
}

// DELETE: 콘텐츠 삭제 (관리자)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID 필요" }, { status: 400 });

  await prisma.contentPost.delete({ where: { id } });
  return NextResponse.json({ message: "삭제 완료" });
}
