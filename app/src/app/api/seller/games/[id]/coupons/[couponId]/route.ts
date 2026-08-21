import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeCoupon } from "@/lib/gameCoupon";

export const dynamic = "force-dynamic";

async function getOwnedCoupon(gameId: string, couponId: string, userId: string) {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (!seller) return { error: "라이브 셀러 프로필 없음", status: 400 as const };
  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true, sellerId: true } });
  if (!game || game.sellerId !== seller.id) {
    return { error: "이 게임에 대한 권한이 없습니다", status: 403 as const };
  }
  const coupon = await prisma.gameCoupon.findUnique({ where: { id: couponId } });
  if (!coupon || coupon.gameId !== gameId) {
    return { error: "쿠폰을 찾을 수 없습니다", status: 404 as const };
  }
  return { coupon };
}

// PATCH: 쿠폰 수정
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; couponId: string }> | { id: string; couponId: string } },
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    if (session.user.role !== "SELLER") return NextResponse.json({ error: "라이브 셀러 전용" }, { status: 403 });
    const { id, couponId } = await Promise.resolve(params);
    const owned = await getOwnedCoupon(id, couponId, session.user!.id);
    if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

    const body = await req.json().catch(() => ({}));
    const norm = normalizeCoupon(body);
    if ("error" in norm) return NextResponse.json({ error: norm.error }, { status: 400 });

    const { productId, ...coreData } = norm.data;
    const coupon = await (prisma.gameCoupon.update as any)({
      where: { id: couponId },
      data: { ...coreData, productId: productId ?? null },
    });
    return NextResponse.json({ success: true, coupon });
  } catch (error) {
    console.error("Game coupon update error:", error);
    return NextResponse.json({ error: "쿠폰 수정 실패" }, { status: 500 });
  }
}

// DELETE: 쿠폰 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; couponId: string }> | { id: string; couponId: string } },
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    if (session.user.role !== "SELLER") return NextResponse.json({ error: "라이브 셀러 전용" }, { status: 403 });
    const { id, couponId } = await Promise.resolve(params);
    const owned = await getOwnedCoupon(id, couponId, session.user!.id);
    if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

    await prisma.gameCoupon.delete({ where: { id: couponId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Game coupon delete error:", error);
    return NextResponse.json({ error: "쿠폰 삭제 실패" }, { status: 500 });
  }
}
