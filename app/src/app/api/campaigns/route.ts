import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clampInt } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const sellerId = url.searchParams.get("sellerId");
  // 페이지네이션 파라미터 정규화 — NaN/음수/과도한 limit 차단.
  // (검증이 없으면 ?page=-5 로 skip 이 음수가 되어 Prisma 가 예외를 던지고,
  //  ?limit=999999 로 테이블 전체를 한 번에 긁어가는 DoS 가 가능했다)
  const page = clampInt(url.searchParams.get("page"), 1, 1, Number.MAX_SAFE_INTEGER);
  const limit = clampInt(url.searchParams.get("limit"), 20, 1, 100);

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
