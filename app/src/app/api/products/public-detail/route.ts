import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/products/public-detail?id=xxx&sellerId=yyy&ref=slug
 * 인증 불필요 — 셀러샵 바텀시트 등 구매자 노출용 상품 상세
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const sellerId = searchParams.get("sellerId");
  const ref = searchParams.get("ref"); // seller slug

  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  try {
    const product = await prisma.product.findUnique({
      where: { id, isActive: true, isApproved: true },
      include: {
        brand: { select: { brandName: true } },
        category: { select: { name: true } },
        variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
        images: { orderBy: { sortOrder: "asc" } },
        reviews: { select: { rating: true }, take: 100 },
        sellerProducts: {
          where: { isActive: true },
          select: {
            sellerId: true,
            sellerPrice: true,
            seller: { select: { id: true, slug: true } },
          },
        },
      },
    });

    if (!product) return NextResponse.json({ error: "상품 없음" }, { status: 404 });

    const basePrice = Number(product.basePrice);
    const comparePrice = product.comparePrice ? Number(product.comparePrice) : null;

    // ref(slug) 또는 sellerId 기준으로 셀러 판매가 결정
    const refSellerProduct = ref
      ? product.sellerProducts.find((sp: any) => sp.seller?.slug === ref)
      : sellerId
        ? product.sellerProducts.find((sp: any) => sp.sellerId === sellerId)
        : null;

    const displayPrice = (refSellerProduct as any)?.sellerPrice
      ? Number((refSellerProduct as any).sellerPrice)
      : basePrice;

    const avgRating =
      product.reviews.length > 0
        ? product.reviews.reduce((s: number, r: any) => s + r.rating, 0) / product.reviews.length
        : 0;

    const allImages =
      product.images.length > 0
        ? product.images.map((img: any) => img.url)
        : product.thumbnail
          ? [product.thumbnail]
          : [];

    return NextResponse.json({
      id: product.id,
      name: product.name,
      description: product.description,
      basePrice: displayPrice,
      comparePrice,
      thumbnail: product.thumbnail,
      images: allImages,
      shippingFee: Number(product.shippingFee),
      freeShipping: product.freeShipping,
      freeShippingThreshold: product.freeShippingThreshold
        ? Number(product.freeShippingThreshold)
        : null,
      remoteAreaFee: Number(product.remoteAreaFee),
      brandName: product.brand?.brandName || null,
      categoryName: product.category?.name || null,
      avgRating: Math.round(avgRating * 10) / 10,
      reviewCount: product.reviews.length,
      // optionGroups: 다차원 그룹 메타데이터 (있을 경우)
      optionGroups: (product as any).optionGroups
        ? (() => { try { return JSON.parse((product as any).optionGroups); } catch { return null; } })()
        : null,
      variants: product.variants.map((v: any) => ({
        id: v.id,
        name: v.name,
        price: Number(v.price),
        stock: v.stock,
      })),
      // 어떤 sellerId를 기본으로 쓸지
      defaultSellerId:
        sellerId ||
        product.sellerProducts[0]?.sellerId ||
        null,
    });
  } catch (e: any) {
    console.error("[public-detail]", e?.message);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
