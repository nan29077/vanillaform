import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: 내가 받은 게임 당첨 쿠폰 목록
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const coupons = await prisma.userGameCoupon.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        gameCoupon: {
          select: { discountType: true, discountValue: true, minOrderAmount: true, productId: true } as any,
        },
      },
    });

    // 셀러 샵 정보 매핑 (UserGameCoupon.sellerId → SellerProfile)
    const sellerIds = Array.from(new Set(coupons.map((c) => c.sellerId)));
    const sellers = await prisma.sellerProfile.findMany({
      where: { id: { in: sellerIds.length ? sellerIds : ["__none__"] } },
      select: { id: true, shopName: true, slug: true },
    });
    const sellerMap = new Map(sellers.map((s) => [s.id, s]));

    // 게임 제목 매핑 (UserGameCoupon.gameId → Game.title) — 관계 미설정이라 별도 조회
    const gameIds = Array.from(new Set(coupons.map((c) => c.gameId)));
    const games = await prisma.game.findMany({
      where: { id: { in: gameIds.length ? gameIds : ["__none__"] } },
      select: { id: true, title: true },
    });
    const gameMap = new Map(games.map((g) => [g.id, g.title]));

    const now = new Date();
    return NextResponse.json({
      coupons: coupons.map((c) => {
        const expired = c.expiresAt < now;
        const used = !!c.usedAt;
        const seller = sellerMap.get(c.sellerId);
        return {
          id: c.id,
          code: c.code,
          discountType: c.gameCoupon?.discountType ?? "PERCENT",
          discountValue: Number(c.gameCoupon?.discountValue ?? 0),
          minOrderAmount: Number(c.gameCoupon?.minOrderAmount ?? 0),
          productId: (c.gameCoupon as any)?.productId ?? null,
          gameTitle: gameMap.get(c.gameId) ?? "게임",
          sellerId: c.sellerId,
          sellerName: seller?.shopName ?? "셀러 샵",
          sellerSlug: seller?.slug ?? null,
          usedAt: c.usedAt ? c.usedAt.toISOString() : null,
          expiresAt: c.expiresAt.toISOString(),
          status: used ? "used" : expired ? "expired" : "available",
        };
      }),
    });
  } catch (error) {
    console.error("My game coupons error:", error);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
