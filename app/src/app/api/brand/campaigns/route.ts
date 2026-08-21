import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: List brand's campaigns (from brand's products)
export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    const role = session.user.role;
    if (role !== "BRAND_ADMIN") {
      return NextResponse.json({ error: "브랜드 관리자 전용" }, { status: 403 });
    }

    const brand = await prisma.brandProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!brand) return NextResponse.json({ error: "브랜드 프로필 없음" }, { status: 400 });

    const campaigns = await prisma.groupBuyCampaign.findMany({
      where: { product: { brandId: brand.id } },
      include: {
        seller: { select: { id: true, shopName: true, slug: true, shopLogo: true } },
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
    console.error("Brand campaigns list error:", error);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

// POST: Create a group-buy campaign for a brand's product
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    const role = session.user.role;
    if (role !== "BRAND_ADMIN") {
      return NextResponse.json({ error: "브랜드 관리자 전용" }, { status: 403 });
    }

    const brand = await prisma.brandProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!brand) return NextResponse.json({ error: "브랜드 프로필 없음" }, { status: 400 });

    const body = await req.json();
    const {
      productId, title, campaignPrice, goalQuantity,
      minOrderQuantity, maxOrderQuantity, limitPerPerson,
      startDate, endDate, description, bannerImage, estimatedDelivery,
    } = body;

    if (!productId || !campaignPrice || !startDate || !endDate) {
      return NextResponse.json(
        { error: "상품, 가격, 시작일, 종료일은 필수입니다" },
        { status: 400 }
      );
    }

    // Verify product belongs to this brand
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      return NextResponse.json({ error: "상품을 찾을 수 없습니다" }, { status: 404 });
    }
    if (product.brandId !== brand.id) {
      return NextResponse.json({ error: "이 상품에 대한 권한이 없습니다" }, { status: 403 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (end <= start) {
      return NextResponse.json({ error: "종료일은 시작일 이후여야 합니다" }, { status: 400 });
    }

    // For brand-created campaigns, use the first approved seller or create without seller initially
    // We need a seller for the campaign. Find seller who has this product or first approved seller.
    let campaignSellerId: string | null = null;

    // First check if any seller already has this product
    const existingSellerProduct = await prisma.sellerShopProduct.findFirst({
      where: { productId, isActive: true },
      include: { seller: { select: { id: true, isApproved: true } } },
    });

    if (existingSellerProduct && existingSellerProduct.seller.isApproved) {
      campaignSellerId = existingSellerProduct.sellerId;
    } else {
      // Use first approved seller
      const anySeller = await prisma.sellerProfile.findFirst({
        where: { isApproved: true },
        orderBy: { totalFans: "desc" },
      });
      campaignSellerId = anySeller?.id || null;
    }

    if (!campaignSellerId) {
      return NextResponse.json(
        { error: "등록된 라이브 셀러가 없어 공동구매를 생성할 수 없습니다. 먼저 라이브 셀러를 승인해주세요." },
        { status: 400 }
      );
    }

    // Ensure the product is in the seller's shop
    const existingShopProduct = await prisma.sellerShopProduct.findUnique({
      where: { sellerId_productId: { sellerId: campaignSellerId, productId } },
    });
    if (!existingShopProduct) {
      await prisma.sellerShopProduct.create({
        data: { sellerId: campaignSellerId, productId, isActive: true },
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
        sellerId: campaignSellerId,
        productId,
        status: start <= now ? "ACTIVE" : "SCHEDULED",
        campaignPrice: parseFloat(String(campaignPrice)),
        originalPrice: Number(product.basePrice),
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
    console.error("Brand campaign creation error:", error);
    return NextResponse.json({ error: "등록 실패: " + (error instanceof Error ? error.message : "알 수 없는 오류") }, { status: 500 });
  }
}

// PATCH: Update campaign (status, details)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    if (session.user.role !== "BRAND_ADMIN") {
      return NextResponse.json({ error: "브랜드 관리자 전용" }, { status: 403 });
    }

    const brand = await prisma.brandProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!brand) return NextResponse.json({ error: "브랜드 프로필 없음" }, { status: 400 });

    const body = await req.json();
    const { campaignId, action, ...updateData } = body;

    if (!campaignId) {
      return NextResponse.json({ error: "campaignId는 필수입니다" }, { status: 400 });
    }

    // Verify campaign belongs to brand's product
    const campaign = await prisma.groupBuyCampaign.findUnique({
      where: { id: campaignId },
      include: { product: true },
    });
    if (!campaign || campaign.product.brandId !== brand.id) {
      return NextResponse.json({ error: "이 공동구매에 대한 권한이 없습니다" }, { status: 403 });
    }

    // Handle actions
    if (action === "cancel") {
      await prisma.groupBuyCampaign.update({
        where: { id: campaignId },
        data: { status: "CANCELLED" },
      });
      return NextResponse.json({ success: true, message: "공동구매가 취소되었습니다" });
    }

    if (action === "activate") {
      await prisma.groupBuyCampaign.update({
        where: { id: campaignId },
        data: { status: "ACTIVE" },
      });
      return NextResponse.json({ success: true, message: "공동구매가 활성화되었습니다" });
    }

    if (action === "schedule") {
      await prisma.groupBuyCampaign.update({
        where: { id: campaignId },
        data: { status: "SCHEDULED" },
      });
      return NextResponse.json({ success: true, message: "공동구매가 예정으로 변경되었습니다" });
    }

    // General update
    const allowedFields: Record<string, boolean> = {
      title: true, campaignPrice: true, goalQuantity: true, minOrderQuantity: true,
      maxOrderQuantity: true, limitPerPerson: true, startDate: true, endDate: true,
      description: true, bannerImage: true, estimatedDelivery: true,
    };

    const data: any = {};
    for (const [key, val] of Object.entries(updateData)) {
      if (allowedFields[key]) {
        if (key === "campaignPrice") data[key] = parseFloat(String(val));
        else if (["goalQuantity", "minOrderQuantity", "maxOrderQuantity", "limitPerPerson"].includes(key)) {
          data[key] = val ? parseInt(String(val)) : null;
        } else if (["startDate", "endDate", "estimatedDelivery"].includes(key)) {
          data[key] = val ? new Date(String(val)) : null;
        } else {
          data[key] = val || null;
        }
      }
    }

    if (Object.keys(data).length > 0) {
      await prisma.groupBuyCampaign.update({
        where: { id: campaignId },
        data,
      });
    }

    return NextResponse.json({ success: true, message: "공동구매가 수정되었습니다" });
  } catch (error) {
    console.error("Brand campaign update error:", error);
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}

// DELETE: Delete a campaign
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    if (session.user.role !== "BRAND_ADMIN") {
      return NextResponse.json({ error: "브랜드 관리자 전용" }, { status: 403 });
    }

    const brand = await prisma.brandProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!brand) return NextResponse.json({ error: "브랜드 프로필 없음" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get("id");

    if (!campaignId) {
      return NextResponse.json({ error: "campaignId는 필수입니다" }, { status: 400 });
    }

    const campaign = await prisma.groupBuyCampaign.findUnique({
      where: { id: campaignId },
      include: { product: true },
    });
    if (!campaign || campaign.product.brandId !== brand.id) {
      return NextResponse.json({ error: "이 공동구매에 대한 권한이 없습니다" }, { status: 403 });
    }

    // Check if there are orders
    const orderCount = await prisma.order.count({
      where: { campaignId },
    });

    if (orderCount > 0) {
      return NextResponse.json({
        error: `이 공동구매에 ${orderCount}건의 주문이 있어 삭제할 수 없습니다. 취소 처리를 이용해주세요.`,
      }, { status: 400 });
    }

    await prisma.groupBuyCampaign.delete({
      where: { id: campaignId },
    });

    return NextResponse.json({ success: true, message: "공동구매가 삭제되었습니다" });
  } catch (error) {
    console.error("Brand campaign delete error:", error);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}
