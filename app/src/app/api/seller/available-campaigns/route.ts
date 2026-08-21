import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: List available group-buy campaigns that seller can join
export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    if (session.user.role !== "SELLER") {
      return NextResponse.json({ error: "라이브 셀러 전용" }, { status: 403 });
    }

    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!seller) return NextResponse.json({ error: "라이브 셀러 프로필 없음" }, { status: 400 });

    // Get all active/scheduled campaigns
    const campaigns = await prisma.groupBuyCampaign.findMany({
      where: {
        status: { in: ["ACTIVE", "SCHEDULED"] },
      },
      include: {
        product: {
          select: {
            id: true, name: true, thumbnail: true, basePrice: true,
            brand: { select: { brandName: true, brandLogo: true } },
            category: { select: { name: true } },
          },
        },
        seller: { select: { id: true, shopName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get seller's existing campaigns to mark which ones they've already joined
    const sellerCampaignIds = new Set(
      (await prisma.groupBuyCampaign.findMany({
        where: { sellerId: seller.id },
        select: { id: true, productId: true },
      })).map(c => c.productId)
    );

    // Get seller's shop products
    const sellerShopProductIds = new Set(
      (await prisma.sellerShopProduct.findMany({
        where: { sellerId: seller.id },
        select: { productId: true },
      })).map(sp => sp.productId)
    );

    return NextResponse.json({
      campaigns: campaigns.map(c => ({
        id: c.id,
        title: c.title,
        status: c.status,
        campaignPrice: Number(c.campaignPrice),
        originalPrice: Number(c.originalPrice),
        startDate: c.startDate,
        endDate: c.endDate,
        goalQuantity: c.goalQuantity,
        currentQuantity: c.currentQuantity,
        participantCount: c.participantCount,
        description: c.description,
        bannerImage: c.bannerImage,
        product: {
          ...c.product,
          basePrice: Number(c.product.basePrice),
        },
        createdBySeller: c.seller.shopName,
        isMyProduct: sellerShopProductIds.has(c.productId),
        alreadyJoined: sellerCampaignIds.has(c.productId),
        isMyCampaign: c.sellerId === seller.id,
      })),
    });
  } catch (error) {
    console.error("Available campaigns error:", error);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

// POST: Seller joins an existing campaign by creating their own campaign for the same product
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    if (session.user.role !== "SELLER") {
      return NextResponse.json({ error: "라이브 셀러 전용" }, { status: 403 });
    }

    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!seller) return NextResponse.json({ error: "라이브 셀러 프로필 없음" }, { status: 400 });

    const { campaignId } = await req.json();
    if (!campaignId) {
      return NextResponse.json({ error: "campaignId는 필수입니다" }, { status: 400 });
    }

    // Get the original campaign
    const original = await prisma.groupBuyCampaign.findUnique({
      where: { id: campaignId },
      include: { product: true },
    });
    if (!original) {
      return NextResponse.json({ error: "공동구매를 찾을 수 없습니다" }, { status: 404 });
    }

    // Check if seller already has a campaign for this product
    const existing = await prisma.groupBuyCampaign.findFirst({
      where: { sellerId: seller.id, productId: original.productId },
    });
    if (existing) {
      return NextResponse.json({ error: "이미 이 상품의 공동구매에 참여하고 있습니다" }, { status: 400 });
    }

    // Ensure product is in seller's shop
    const shopProduct = await prisma.sellerShopProduct.findUnique({
      where: { sellerId_productId: { sellerId: seller.id, productId: original.productId } },
    });
    if (!shopProduct) {
      await prisma.sellerShopProduct.create({
        data: { sellerId: seller.id, productId: original.productId, isActive: true },
      });
    }

    // Create seller's own campaign based on original
    const campaign = await prisma.groupBuyCampaign.create({
      data: {
        title: original.title,
        sellerId: seller.id,
        productId: original.productId,
        status: original.status,
        campaignPrice: original.campaignPrice,
        originalPrice: original.originalPrice,
        startDate: original.startDate,
        endDate: original.endDate,
        goalQuantity: original.goalQuantity,
        minOrderQuantity: original.minOrderQuantity,
        maxOrderQuantity: original.maxOrderQuantity,
        limitPerPerson: original.limitPerPerson,
        description: original.description,
        bannerImage: original.bannerImage,
        estimatedDelivery: original.estimatedDelivery,
      },
    });

    return NextResponse.json({
      success: true,
      campaign,
      message: "공동구매에 참여했습니다. 내 공동구매 관리에서 확인하세요.",
    }, { status: 201 });
  } catch (error) {
    console.error("Join campaign error:", error);
    return NextResponse.json({ error: "참여 실패" }, { status: 500 });
  }
}
