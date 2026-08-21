import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeCoupon } from "@/lib/gameCoupon";

export const dynamic = "force-dynamic";

// 게임 소유 셀러 확인
async function getOwnedGame(gameId: string, userId: string) {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (!seller) return { error: "라이브 셀러 프로필 없음", status: 400 as const };
  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true, sellerId: true } });
  if (!game || game.sellerId !== seller.id) {
    return { error: "이 게임에 대한 권한이 없습니다", status: 403 as const };
  }
  return { seller, game };
}

// GET: 게임에 연결된 쿠폰 목록 (발급 수량 포함)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    if (session.user.role !== "SELLER") return NextResponse.json({ error: "라이브 셀러 전용" }, { status: 403 });
    const { id } = await Promise.resolve(params);
    const owned = await getOwnedGame(id, session.user!.id);
    if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

    const coupons = await prisma.gameCoupon.findMany({
      where: { gameId: id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { issuedCoupons: true } } },
    });

    return NextResponse.json({
      coupons: coupons.map((c) => ({
        id: c.id,
        code: c.code,
        discountType: c.discountType,
        discountValue: Number(c.discountValue),
        minOrderAmount: Number(c.minOrderAmount),
        maxIssueCount: c.maxIssueCount,
        validDays: c.validDays,
        productId: (c as any).productId ?? null,
        issuedCount: c._count.issuedCoupons,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Game coupons list error:", error);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

// POST: 게임에 쿠폰 추가
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    if (session.user.role !== "SELLER") return NextResponse.json({ error: "라이브 셀러 전용" }, { status: 403 });
    const { id } = await Promise.resolve(params);
    const owned = await getOwnedGame(id, session.user!.id);
    if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

    const body = await req.json().catch(() => ({}));
    const norm = normalizeCoupon(body);
    if ("error" in norm) return NextResponse.json({ error: norm.error }, { status: 400 });

    const { productId, ...coreData } = norm.data;
    const coupon = await (prisma.gameCoupon.create as any)({
      data: { gameId: id, ...coreData, ...(productId != null ? { productId } : {}) },
    });
    return NextResponse.json({ success: true, coupon }, { status: 201 });
  } catch (error) {
    console.error("Game coupon create error:", error);
    return NextResponse.json({ error: "쿠폰 생성 실패" }, { status: 500 });
  }
}
