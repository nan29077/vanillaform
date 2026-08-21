import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 위시리스트 조회
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const wishlists = await prisma.wishlist.findMany({
    where: { userId: session.user!.id },
    include: {
      product: {
        include: {
          brand: true,
          sellerProducts: {
            where: { isActive: true },
            include: { seller: true },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    items: wishlists.map((w) => ({
      id: w.id,
      productId: w.productId,
      createdAt: w.createdAt,
      product: {
        id: w.product.id,
        name: w.product.name,
        thumbnail: w.product.thumbnail,
        basePrice: Number(w.product.basePrice),
        comparePrice: w.product.comparePrice ? Number(w.product.comparePrice) : null,
        brandName: w.product.brand?.brandName || null,
        sellerName: w.product.sellerProducts[0]?.seller?.shopName || null,
        badges: w.product.badges,
      },
    })),
  });
}

// 위시리스트 추가/제거 (토글)
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { productId } = await request.json();
  if (!productId) {
    return NextResponse.json({ error: "상품 ID가 필요합니다." }, { status: 400 });
  }

  // Check if already wishlisted
  const existing = await prisma.wishlist.findUnique({
    where: {
      userId_productId: {
        userId: session.user!.id,
        productId,
      },
    },
  });

  if (existing) {
    // Remove
    await prisma.wishlist.delete({
      where: { id: existing.id },
    });
    return NextResponse.json({ liked: false, message: "찜 목록에서 제거되었습니다." });
  } else {
    // Add
    await prisma.wishlist.create({
      data: {
        userId: session.user!.id,
        productId,
      },
    });
    return NextResponse.json({ liked: true, message: "찜 목록에 추가되었습니다." }, { status: 201 });
  }
}

// 특정 상품 찜 여부 확인
export async function PUT(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ liked: false });
  }

  const { productIds } = await request.json();
  if (!productIds || !Array.isArray(productIds)) {
    return NextResponse.json({ error: "상품 ID 배열이 필요합니다." }, { status: 400 });
  }

  const wishlists = await prisma.wishlist.findMany({
    where: {
      userId: session.user!.id,
      productId: { in: productIds },
    },
    select: { productId: true },
  });

  const likedIds = wishlists.map((w) => w.productId);
  return NextResponse.json({ likedIds });
}
