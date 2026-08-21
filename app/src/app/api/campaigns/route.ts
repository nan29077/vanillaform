import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const sellerId = url.searchParams.get("sellerId");
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");

  const where: any = {};
  if (status) where.status = status;
  if (sellerId) where.sellerId = sellerId;

  const [campaigns, total] = await Promise.all([
    prisma.groupBuyCampaign.findMany({
      where,
      include: {
        seller: { select: { slug: true, shopName: true, shopLogo: true } },
        product: { select: { name: true, thumbnail: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.groupBuyCampaign.count({ where }),
  ]);

  return NextResponse.json({
    campaigns: campaigns.map((c) => ({
      ...c,
      campaignPrice: Number(c.campaignPrice),
      originalPrice: Number(c.originalPrice),
      totalRevenue: Number(c.totalRevenue),
      commissionRate: Number(c.commissionRate),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
