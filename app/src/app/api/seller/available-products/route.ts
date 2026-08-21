import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatProductNameForSeller } from "@/lib/productName";

export const dynamic = "force-dynamic";

// 셀러 노출 공급가 = 공급가 + 중간관리자 마진 + 관리자 마진 (공급가 없으면 판매가로 폴백)
function effectiveSupply(p: { supplyPrice: any; middleAdminMargin: any; basePrice: any; adminMargin?: any }): number {
  const supply = p.supplyPrice != null ? Number(p.supplyPrice) : Number(p.basePrice);
  const middleMargin = p.middleAdminMargin != null ? Number(p.middleAdminMargin) : 0;
  const adminMargin = p.adminMargin != null ? Number(p.adminMargin) : 0;
  return supply + middleMargin + adminMargin;
}

// GET: 셀러가 사용할 수 있는 상품 목록
// ?type=groupbuy → 공동구매용 (allowGroupBuy=true인 상품 + 내 상품)
// ?type=live     → 라이브커머스용 (allowLiveCommerce=true인 상품 + 내 상품)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    const role = session.user.role;
    if (role !== "SELLER") {
      return NextResponse.json({ error: "라이브 셀러 전용" }, { status: 403 });
    }

    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
    });

    if (!seller) {
      return NextResponse.json({ error: "라이브 셀러 프로필이 없습니다" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "groupbuy"; // "groupbuy" | "live"

    // 1. 셀러 자신의 상품 (항상 표시)
    const shopProducts = await prisma.sellerShopProduct.findMany({
      where: { sellerId: seller.id, isActive: true },
      include: {
        product: {
          include: {
            brand: { select: { brandName: true } },
            category: { select: { name: true } },
          },
        },
      },
    });

    const shopProductIds = new Set(shopProducts.map((sp) => sp.productId));

    // 2. 브랜드/관리자가 해당 유형으로 등록한 상품
    const typeFilter = type === "live"
      ? { allowLiveCommerce: true }
      : { allowGroupBuy: true };

    const registeredProducts = await prisma.product.findMany({
      where: {
        isActive: true,
        isApproved: true,
        ...typeFilter,
        id: { notIn: Array.from(shopProductIds) }, // 내 상품 제외 (중복 방지)
      },
      include: {
        brand: { select: { brandName: true } },
        category: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // 결합: 내 상품 먼저, 그 다음 등록된 상품
    const products = [
      ...shopProducts.map((sp) => ({
        id: sp.product.id,
        name: formatProductNameForSeller(sp.product.name, sp.product.middleAdminId),
        thumbnail: sp.product.thumbnail,
        basePrice: Number(sp.product.basePrice),
        supplyPrice: effectiveSupply(sp.product),
        brandName: sp.product.brand?.brandName || null,
        categoryName: sp.product.category?.name || null,
        allowGroupBuy: sp.product.allowGroupBuy,
        allowLiveCommerce: (sp.product as any).allowLiveCommerce ?? false,
        isInShop: true,
        isOwn: true,
      })),
      ...registeredProducts.map((p) => ({
        id: p.id,
        name: formatProductNameForSeller(p.name, p.middleAdminId),
        thumbnail: p.thumbnail,
        basePrice: Number(p.basePrice),
        supplyPrice: effectiveSupply(p),
        brandName: p.brand?.brandName || null,
        categoryName: p.category?.name || null,
        allowGroupBuy: p.allowGroupBuy,
        allowLiveCommerce: (p as any).allowLiveCommerce ?? false,
        isInShop: false,
        isOwn: false,
      })),
    ];

    return NextResponse.json({ products, type });
  } catch (error) {
    console.error("Available products error:", error);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
