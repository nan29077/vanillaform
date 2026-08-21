import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/seller/reviews?page=1&limit=10
export async function GET(req: NextRequest) {
  const session = await auth();
  if ((session?.user as any)?.role !== "SELLER") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session!.user!.id },
    select: { id: true },
  });
  if (!seller) return NextResponse.json({ error: "라이브 셀러 없음" }, { status: 404 });

  const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "10");
  const skip = (page - 1) * limit;

  // 셀러 샵에 등록된 상품의 리뷰 조회
  const shopProductIds = await prisma.sellerShopProduct.findMany({
    where: { sellerId: seller.id },
    select: { productId: true },
  });
  const productIds = shopProductIds.map((p) => p.productId);

  const [reviews, total] = await Promise.all([
    (prisma.review as any).findMany({
      where: { productId: { in: productIds } },
      include: {
        user: { select: { name: true } },
        product: { select: { name: true, thumbnail: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.review.count({ where: { productId: { in: productIds } } }),
  ]);

  const serialized = reviews.map((r: any) => ({
    id: r.id,
    rating: r.rating,
    content: r.content,
    images: (() => { try { return JSON.parse(r.images || "[]"); } catch { return []; } })(),
    isHidden: r.isHidden ?? false,
    sellerComment: r.sellerComment ?? null,
    sellerCommentedAt: r.sellerCommentedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    user: { name: r.user?.name ?? "탈퇴회원" },
    product: { name: r.product?.name ?? "", thumbnail: r.product?.thumbnail ?? null },
  }));

  return NextResponse.json({ reviews: serialized, total, page, limit });
}

// PATCH /api/seller/reviews  { reviewId, sellerComment?, isHidden? }
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if ((session?.user as any)?.role !== "SELLER") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session!.user!.id },
    select: { id: true },
  });
  if (!seller) return NextResponse.json({ error: "라이브 셀러 없음" }, { status: 404 });

  const { reviewId, sellerComment, isHidden } = await req.json();
  if (!reviewId) return NextResponse.json({ error: "reviewId 필수" }, { status: 400 });

  // 해당 리뷰가 셀러의 상품 것인지 검증
  const review = await (prisma.review as any).findUnique({
    where: { id: reviewId },
    include: { product: { include: { sellerProducts: { where: { sellerId: seller.id } } } } },
  });
  if (!review || review.product.sellerProducts.length === 0) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const updateData: any = {};
  if (typeof sellerComment === "string") {
    updateData.sellerComment = sellerComment || null;
    updateData.sellerCommentedAt = sellerComment ? new Date() : null;
  }
  if (typeof isHidden === "boolean") {
    updateData.isHidden = isHidden;
  }

  await (prisma.review as any).update({ where: { id: reviewId }, data: updateData });
  return NextResponse.json({ ok: true });
}
