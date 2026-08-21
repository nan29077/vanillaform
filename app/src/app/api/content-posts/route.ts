import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: 콘텐츠 목록 조회 (셀러용 - 자기 콘텐츠, 관리자용 - 전체)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const role = session.user.role;
  const { searchParams } = new URL(req.url);
  const sellerId = searchParams.get("sellerId");

  let where: any = {};

  if (role === "SUPER_ADMIN") {
    if (sellerId) where.sellerId = sellerId;
  } else if (role === "SELLER") {
    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!seller) return NextResponse.json({ error: "라이브 셀러 프로필 없음" }, { status: 400 });
    where.sellerId = seller.id;
  } else {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const posts = await prisma.contentPost.findMany({
    where,
    include: {
      seller: { select: { id: true, shopName: true, shopLogo: true, slug: true } },
      shoppingTags: {
        include: {
          product: {
            select: { id: true, name: true, thumbnail: true, basePrice: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const serialized = posts.map((p) => ({
    ...p,
    shoppingTags: p.shoppingTags.map((t) => ({
      ...t,
      product: { ...t.product, basePrice: Number(t.product.basePrice) },
    })),
  }));

  return NextResponse.json({ posts: serialized });
}

// POST: 콘텐츠 생성 (셀러)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const role = session.user.role;
  if (role !== "SELLER" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const body = await req.json();
  const { title, content, images, shoppingTags, isPublished, category, hashtags } = body;

  if (!title || !images || images.length === 0) {
    return NextResponse.json({ error: "제목과 이미지는 필수입니다" }, { status: 400 });
  }

  let sellerId: string;

  if (role === "SELLER") {
    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!seller) return NextResponse.json({ error: "라이브 셀러 프로필 없음" }, { status: 400 });
    sellerId = seller.id;
  } else {
    // Admin: sellerId can be in body
    sellerId = body.sellerId;
    if (!sellerId) return NextResponse.json({ error: "라이브 셀러 ID 필요" }, { status: 400 });
  }

  try {
    const post = await prisma.contentPost.create({
      data: {
        sellerId,
        title,
        content: content || null,
        images: JSON.stringify(images || []),
        category: category || null,
        hashtags: JSON.stringify(hashtags && hashtags.length > 0 ? hashtags : []),
        productTags: JSON.stringify(shoppingTags?.map((t: any) => t.productId) || []),
        isPublished: isPublished ?? false,
        isApproved: false, // 관리자 승인 대기
        shoppingTags: shoppingTags && shoppingTags.length > 0
          ? {
              create: shoppingTags.map((tag: any) => ({
                productId: tag.productId,
                imageIndex: tag.imageIndex || 0,
                posX: tag.posX,
                posY: tag.posY,
                label: tag.label || null,
              })),
            }
          : undefined,
      },
      include: {
        shoppingTags: {
          include: {
            product: { select: { id: true, name: true, thumbnail: true, basePrice: true } },
          },
        },
      },
    });

    return NextResponse.json({ post, message: "콘텐츠가 등록되었습니다. 관리자 승인 후 공개됩니다." });
  } catch (error) {
    console.error("Content post creation error:", error);
    return NextResponse.json({ error: "콘텐츠 등록 실패" }, { status: 500 });
  }
}

// DELETE: 콘텐츠 삭제
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const role = session.user.role;
  const { searchParams } = new URL(req.url);
  const postId = searchParams.get("id");

  if (!postId) return NextResponse.json({ error: "ID 필요" }, { status: 400 });

  const post = await prisma.contentPost.findUnique({ where: { id: postId } });
  if (!post) return NextResponse.json({ error: "콘텐츠 없음" }, { status: 404 });

  // 셀러는 자기 콘텐츠만 삭제 가능
  if (role === "SELLER") {
    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!seller || seller.id !== post.sellerId) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }
  } else if (role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  await prisma.contentPost.delete({ where: { id: postId } });
  return NextResponse.json({ message: "삭제되었습니다" });
}

// PATCH: 콘텐츠 수정 (승인, 공개/비공개 토글 등)
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const role = session.user.role;
  const body = await req.json();
  const { id, action, isPublished, isApproved, title, content } = body;

  if (!id) return NextResponse.json({ error: "ID 필요" }, { status: 400 });

  const post = await prisma.contentPost.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "콘텐츠 없음" }, { status: 404 });

  // 관리자: 승인/거부
  if (role === "SUPER_ADMIN") {
    const updateData: any = {};
    if (typeof isApproved === "boolean") updateData.isApproved = isApproved;
    if (typeof isPublished === "boolean") updateData.isPublished = isPublished;
    if (title) updateData.title = title;
    if (content !== undefined) updateData.content = content;

    // 관리자 액션: approve, reject
    if (action === "approve") {
      updateData.isApproved = true;
      updateData.isPublished = true;
    } else if (action === "reject") {
      updateData.isApproved = false;
      updateData.isPublished = false;
    }

    const updated = await prisma.contentPost.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({ post: updated });
  }

  // 셀러: 자기 콘텐츠만 수정
  if (role === "SELLER") {
    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!seller || seller.id !== post.sellerId) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }
    const updateData: any = {};
    if (typeof isPublished === "boolean") updateData.isPublished = isPublished;
    if (title) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (body.images && Array.isArray(body.images)) updateData.images = JSON.stringify(body.images);
    if (body.category !== undefined) updateData.category = body.category || null;
    if (body.hashtags && Array.isArray(body.hashtags)) updateData.hashtags = JSON.stringify(body.hashtags);

    // Action-based updates (publish/unpublish)
    if (action === "publish") {
      updateData.isPublished = true;
    } else if (action === "unpublish") {
      updateData.isPublished = false;
    }

    const updated = await prisma.contentPost.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({ post: updated });
  }

  return NextResponse.json({ error: "권한 없음" }, { status: 403 });
}
