import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: List seller's campaigns
export async function GET(req: NextRequest) {
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
    if (!seller) return NextResponse.json({ error: "라이브 셀러 프로필 없음" }, { status: 400 });

    const campaigns = await prisma.groupBuyCampaign.findMany({
      where: { sellerId: seller.id },
      include: {
        product: { select: { id: true, name: true, thumbnail: true, basePrice: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      campaigns: campaigns.map(c => ({
        ...c,
        campaignPrice: Number(c.campaignPrice),
        originalPrice: Number(c.originalPrice),
        totalRevenue: Number(c.totalRevenue),
        commissionRate: Number(c.commissionRate),
        product: { ...c.product, basePrice: Number(c.product.basePrice) },
      })),
    });
  } catch (error) {
    console.error("Seller campaigns list error:", error);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

// POST: Create a group-buy campaign for a seller
export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const {
      productId, title, campaignPrice, originalPrice,
      goalQuantity, minOrderQuantity, maxOrderQuantity,
      limitPerPerson, startDate, endDate,
      description, bannerImage, estimatedDelivery,
    } = body;

    if (!productId || !campaignPrice || !startDate || !endDate) {
      return NextResponse.json(
        { error: "상품, 가격, 시작일, 종료일은 필수입니다" },
        { status: 400 }
      );
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: "상품을 찾을 수 없습니다" }, { status: 404 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    // Validate dates
    if (end <= start) {
      return NextResponse.json({ error: "종료일은 시작일 이후여야 합니다" }, { status: 400 });
    }

    // Ensure the product is in the seller's shop (or add it)
    const existingShopProduct = await prisma.sellerShopProduct.findUnique({
      where: { sellerId_productId: { sellerId: seller.id, productId } },
    });

    if (!existingShopProduct) {
      await prisma.sellerShopProduct.create({
        data: {
          sellerId: seller.id,
          productId,
          isActive: true,
        },
      });
    }

    // Mark product as allowing group buy
    if (!product.allowGroupBuy) {
      await prisma.product.update({
        where: { id: productId },
        data: { allowGroupBuy: true },
      });
    }

    const campaign = await prisma.groupBuyCampaign.create({
      data: {
        title: title || `${product.name} 공동구매`,
        sellerId: seller.id,
        productId,
        status: start <= now ? "ACTIVE" : "SCHEDULED",
        campaignPrice: parseFloat(String(campaignPrice)),
        originalPrice: originalPrice ? parseFloat(String(originalPrice)) : Number(product.basePrice),
        startDate: start,
        endDate: end,
        goalQuantity: goalQuantity ? parseInt(String(goalQuantity)) : null,
        minOrderQuantity: parseInt(String(minOrderQuantity)) || 1,
        maxOrderQuantity: maxOrderQuantity ? parseInt(String(maxOrderQuantity)) : null,
        limitPerPerson: parseInt(String(limitPerPerson)) || 10,
        description: description || null,
        bannerImage: bannerImage || null,
        estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null,
      },
    });

    return NextResponse.json({
      success: true,
      campaign: {
        ...campaign,
        campaignPrice: Number(campaign.campaignPrice),
        originalPrice: Number(campaign.originalPrice),
        totalRevenue: Number(campaign.totalRevenue),
        commissionRate: Number(campaign.commissionRate),
      },
      message: "공동구매 캠페인이 등록되었습니다",
    }, { status: 201 });
  } catch (error) {
    console.error("Seller campaign creation error:", error);
    return NextResponse.json({ error: "등록 실패: " + (error instanceof Error ? error.message : "알 수 없는 오류") }, { status: 500 });
  }
}
