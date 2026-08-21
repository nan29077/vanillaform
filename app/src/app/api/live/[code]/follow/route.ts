import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncSellerFanCount } from "@/lib/sellerFans";

// POST: 라이브 채널(셀러) 팔로우/언팔로우 토글
export async function POST(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const live = await prisma.liveStream.findUnique({
      where: { shareCode: params.code },
      select: { sellerId: true },
    });
    if (!live) {
      return NextResponse.json({ error: "라이브 채널을 찾을 수 없습니다." }, { status: 404 });
    }

    // 구매자 프로필 조회/생성
    let buyer = await prisma.buyerProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!buyer) {
      buyer = await prisma.buyerProfile.create({ data: { userId: session.user.id } });
    }

    const existing = await prisma.sellerFollower.findUnique({
      where: { buyerId_sellerId: { buyerId: buyer.id, sellerId: live.sellerId } },
    });

    if (existing) {
      await prisma.sellerFollower.delete({ where: { id: existing.id } });
      await syncSellerFanCount(live.sellerId);
      return NextResponse.json({ following: false });
    }

    await prisma.sellerFollower.create({
      data: { buyerId: buyer.id, sellerId: live.sellerId },
    });
    await syncSellerFanCount(live.sellerId);
    return NextResponse.json({ following: true });
  } catch (error) {
    console.error("채널 팔로우 오류:", error);
    return NextResponse.json({ error: "팔로우 처리에 실패했습니다." }, { status: 500 });
  }
}
