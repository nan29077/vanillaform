import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Fetch seller-by-seller sales details for a product
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    const role = session.user.role;
    if (!["SUPER_ADMIN", "BRAND_ADMIN"].includes(role)) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    if (!productId) {
      return NextResponse.json({ error: "productId는 필수입니다" }, { status: 400 });
    }

    const isBrand = role === "BRAND_ADMIN";

    // 상품 정보 조회 (판매가/공급가 — 매출 산정 기준에 사용)
    const productInfo = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, thumbnail: true, basePrice: true, supplyPrice: true, soldCount: true, brandId: true },
    });
    if (!productInfo) {
      return NextResponse.json({ error: "상품을 찾을 수 없습니다" }, { status: 404 });
    }

    // Verify product ownership for brand admin
    if (isBrand) {
      const brand = await prisma.brandProfile.findUnique({ where: { userId: session.user!.id } });
      if (!brand) return NextResponse.json({ error: "브랜드 정보 없음" }, { status: 403 });
      if (productInfo.brandId !== brand.id) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    // 판매가 비노출: 브랜드 매출은 공급가 단가 × 수량으로 집계 (판매가 누출 방지)
    const brandSupplyUnit = isBrand ? Number(productInfo.supplyPrice ?? 0) : 0;

    // Get all sellers who sell this product (via SellerShopProduct)
    const sellerProducts = await prisma.sellerShopProduct.findMany({
      where: { productId },
      include: {
        seller: {
          select: { id: true, shopName: true, shopLogo: true, slug: true, category: true },
        },
      },
    });

    // Get campaigns for this product
    const campaigns = await prisma.groupBuyCampaign.findMany({
      where: { productId },
      include: {
        seller: {
          select: { id: true, shopName: true, shopLogo: true, slug: true },
        },
      },
    });

    // Get orders for this product grouped by seller
    const orders = await prisma.order.findMany({
      where: {
        items: { some: { productId } },
        paymentStatus: { in: ["COMPLETED"] },
      },
      include: {
        seller: {
          select: { id: true, shopName: true, shopLogo: true, slug: true },
        },
        items: {
          where: { productId },
        },
      },
    });

    // Aggregate by seller
    const sellerSalesMap: Record<string, {
      sellerId: string;
      shopName: string;
      shopLogo: string | null;
      slug: string;
      totalOrders: number;
      totalQuantity: number;
      totalRevenue: number;
      isShopProduct: boolean;
      campaignCount: number;
    }> = {};

    // Initialize with seller products
    for (const sp of sellerProducts) {
      sellerSalesMap[sp.seller.id] = {
        sellerId: sp.seller.id,
        shopName: sp.seller.shopName,
        shopLogo: sp.seller.shopLogo,
        slug: sp.seller.slug,
        totalOrders: 0,
        totalQuantity: 0,
        totalRevenue: 0,
        isShopProduct: true,
        campaignCount: 0,
      };
    }

    // Add campaigns
    for (const c of campaigns) {
      if (!sellerSalesMap[c.seller.id]) {
        sellerSalesMap[c.seller.id] = {
          sellerId: c.seller.id,
          shopName: c.seller.shopName,
          shopLogo: c.seller.shopLogo,
          slug: c.seller.slug,
          totalOrders: 0,
          totalQuantity: 0,
          totalRevenue: 0,
          isShopProduct: false,
          campaignCount: 0,
        };
      }
      sellerSalesMap[c.seller.id].campaignCount += 1;
    }

    // Aggregate orders
    for (const order of orders) {
      const sellerId = order.sellerId;
      if (!sellerSalesMap[sellerId]) {
        sellerSalesMap[sellerId] = {
          sellerId,
          shopName: order.seller.shopName,
          shopLogo: order.seller.shopLogo,
          slug: order.seller.slug,
          totalOrders: 0,
          totalQuantity: 0,
          totalRevenue: 0,
          isShopProduct: false,
          campaignCount: 0,
        };
      }
      sellerSalesMap[sellerId].totalOrders += 1;
      for (const item of order.items) {
        sellerSalesMap[sellerId].totalQuantity += item.quantity;
        // 브랜드: 공급가 기준 매출 / 그 외(관리자): 실제 판매 금액
        sellerSalesMap[sellerId].totalRevenue += isBrand
          ? brandSupplyUnit * item.quantity
          : Number(item.totalPrice);
      }
    }

    const sellerSales = Object.values(sellerSalesMap).sort(
      (a, b) => b.totalRevenue - a.totalRevenue
    );

    // 응답 상품 정보 — 판매가 비노출: 브랜드에는 basePrice를 내려보내지 않음
    const product = {
      id: productInfo.id,
      name: productInfo.name,
      thumbnail: productInfo.thumbnail,
      soldCount: productInfo.soldCount,
      basePrice: isBrand ? null : Number(productInfo.basePrice),
      supplyPrice: productInfo.supplyPrice != null ? Number(productInfo.supplyPrice) : null,
    };

    return NextResponse.json({
      product,
      sellerSales,
      totalSellers: sellerSales.length,
      totalOrders: sellerSales.reduce((s, x) => s + x.totalOrders, 0),
      totalRevenue: sellerSales.reduce((s, x) => s + x.totalRevenue, 0),
    });
  } catch (error) {
    console.error("Product sales fetch error:", error);
    return NextResponse.json({ error: "판매내역 조회 실패" }, { status: 500 });
  }
}
