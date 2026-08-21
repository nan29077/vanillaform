import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: 셀러가 이전에 만든 쿠폰(게임 쿠폰 + 라이브 쿠폰) 목록 — 새 게임 쿠폰으로 불러오기용
export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    if (session.user.role !== "SELLER") return NextResponse.json({ error: "라이브 셀러 전용" }, { status: 403 });
    const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user!.id } });
    if (!seller) return NextResponse.json({ error: "라이브 셀러 프로필 없음" }, { status: 400 });

    // 이 셀러의 게임에 연결된 게임 쿠폰
    const gameCoupons = await prisma.gameCoupon.findMany({
      where: { game: { sellerId: seller.id } },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { game: { select: { title: true } } },
    });

    // 이 셀러의 라이브 쿠폰
    const liveCoupons = await prisma.liveCoupon.findMany({
      where: { liveStream: { sellerId: seller.id } },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { liveStream: { select: { title: true } } },
    });

    return NextResponse.json({
      coupons: [
        ...gameCoupons.map((c) => ({
          source: "game" as const,
          sourceLabel: c.game.title,
          code: c.code,
          discountType: c.discountType, // PERCENT | AMOUNT
          discountValue: c.discountValue,
          minOrderAmount: c.minOrderAmount,
          maxIssueCount: c.maxIssueCount,
          validDays: c.validDays,
        })),
        ...liveCoupons.map((c) => ({
          source: "live" as const,
          sourceLabel: c.liveStream.title,
          code: c.code,
          // LiveCoupon 은 PERCENT|AMOUNT 저장 → 게임 쿠폰 형식으로 매핑
          discountType: c.discountType === "PERCENT" ? "PERCENT" : "AMOUNT",
          discountValue: Math.floor(Number(c.discountValue)),
          minOrderAmount: c.minOrderAmount != null ? Math.floor(Number(c.minOrderAmount)) : 0,
          maxIssueCount: c.maxCount,
          validDays: c.validDays,
        })),
      ],
    });
  } catch (error) {
    console.error("Seller coupons import list error:", error);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
