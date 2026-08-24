import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clampInt } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  // 페이지네이션 파라미터 정규화 — NaN/음수/과도한 limit 차단.
  // (검증이 없으면 ?page=-5 로 skip 이 음수가 되어 Prisma 가 예외를 던지고,
  //  ?limit=999999 로 테이블 전체를 한 번에 긁어가는 DoS 가 가능했다)
  const page = clampInt(url.searchParams.get("page"), 1, 1, Number.MAX_SAFE_INTEGER);
  const limit = clampInt(url.searchParams.get("limit"), 20, 1, 100);

  const where: any = { isApproved: true };
  if (category) where.category = category;

  const [sellers, total] = await Promise.all([
    prisma.sellerProfile.findMany({
      where,
      include: {
        user: { select: { name: true, avatar: true } },
        _count: { select: { campaigns: true, shopProducts: true, fans: true, followers: true } },
      },
      orderBy: { totalFans: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.sellerProfile.count({ where }),
  ]);

  return NextResponse.json({
    sellers: sellers.map((s) => ({
      id: s.id,
      slug: s.slug,
      shopName: s.shopName,
      shopDescription: s.shopDescription,
      shopBanner: s.shopBanner,
      shopLogo: s.shopLogo,
      category: s.category,
      mood: s.mood,
      instagramUrl: s.instagramUrl,
      youtubeUrl: s.youtubeUrl,
      totalFans: s.totalFans,
      totalSales: Number(s.totalSales),
      _count: s._count,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
