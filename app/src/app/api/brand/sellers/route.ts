import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Get sellers associated with brand's products
export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    const role = session.user.role;
    if (role !== "BRAND_ADMIN") {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const brand = await prisma.brandProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!brand) return NextResponse.json({ error: "브랜드 없음" }, { status: 404 });

    // Find sellers who have the brand's products in their shop
    const sellerProducts = await prisma.sellerShopProduct.findMany({
      where: { product: { brandId: brand.id } },
      include: {
        seller: {
          include: {
            user: { select: { name: true, email: true, avatar: true } },
            _count: { select: { shopProducts: true, campaigns: true, followers: true } },
          },
        },
        product: { select: { id: true, name: true, thumbnail: true } },
      },
    });

    // Group by seller
    const sellerMap = new Map<string, any>();
    for (const sp of sellerProducts) {
      if (!sellerMap.has(sp.sellerId)) {
        sellerMap.set(sp.sellerId, {
          ...sp.seller,
          products: [],
        });
      }
      sellerMap.get(sp.sellerId).products.push(sp.product);
    }

    // Also get sellers from campaigns
    const campaignSellers = await prisma.groupBuyCampaign.findMany({
      where: { product: { brandId: brand.id } },
      include: {
        seller: {
          include: {
            user: { select: { name: true, email: true, avatar: true } },
            _count: { select: { shopProducts: true, campaigns: true, followers: true } },
          },
        },
      },
      distinct: ["sellerId"],
    });

    for (const cs of campaignSellers) {
      if (!sellerMap.has(cs.sellerId)) {
        sellerMap.set(cs.sellerId, {
          ...cs.seller,
          products: [],
        });
      }
    }

    const sellers = Array.from(sellerMap.values());

    return NextResponse.json({ sellers });
  } catch (error) {
    console.error("Brand sellers error:", error);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
