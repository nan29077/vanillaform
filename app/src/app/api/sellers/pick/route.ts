import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncSellerFanCount } from "@/lib/sellerFans";

// POST: Toggle pick (follow/unfollow) a seller
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const { sellerId } = await req.json();
    if (!sellerId) {
      return NextResponse.json({ error: "sellerId 필수" }, { status: 400 });
    }

    // Get or create buyer profile
    let buyerProfile = await prisma.buyerProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!buyerProfile) {
      buyerProfile = await prisma.buyerProfile.create({
        data: { userId: session.user!.id },
      });
    }

    // Check existing follow
    const existing = await prisma.sellerFollower.findUnique({
      where: {
        buyerId_sellerId: {
          buyerId: buyerProfile.id,
          sellerId,
        },
      },
    });

    if (existing) {
      // Unfollow + 채널인증 기록 삭제
      await prisma.sellerFollower.delete({ where: { id: existing.id } });
      await prisma.channelVerification.deleteMany({
        where: { buyerId: buyerProfile.id, sellerId },
      });
      await syncSellerFanCount(sellerId);
      return NextResponse.json({ picked: false });
    } else {
      // 거절 이력 확인 — 거절된 적 있으면 재인증 필요
      const rejected = await prisma.channelVerification.findFirst({
        where: { buyerId: buyerProfile.id, sellerId, status: "REJECTED" },
      });
      if (rejected) {
        // 거절 기록 삭제 후 팔로워 생성하지 않고, 재인증 안내
        await prisma.channelVerification.deleteMany({
          where: { buyerId: buyerProfile.id, sellerId },
        });
        return NextResponse.json({
          picked: false,
          needVerification: true,
          message: "이전 인증이 거절되었습니다. 채널 구독 인증을 다시 진행해주세요.",
        });
      }

      // Follow
      await prisma.sellerFollower.create({
        data: {
          buyerId: buyerProfile.id,
          sellerId,
        },
      });
      await syncSellerFanCount(sellerId);
      return NextResponse.json({ picked: true });
    }
  } catch (error) {
    console.error("Pick error:", error);
    return NextResponse.json({ error: "처리 실패" }, { status: 500 });
  }
}

// GET: Check if current user has picked a seller
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ picked: false });
    }

    const { searchParams } = new URL(req.url);
    const sellerId = searchParams.get("sellerId");
    if (!sellerId) {
      return NextResponse.json({ picked: false });
    }

    const buyerProfile = await prisma.buyerProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!buyerProfile) {
      return NextResponse.json({ picked: false });
    }

    const existing = await prisma.sellerFollower.findUnique({
      where: {
        buyerId_sellerId: {
          buyerId: buyerProfile.id,
          sellerId,
        },
      },
    });

    return NextResponse.json({ picked: !!existing });
  } catch {
    return NextResponse.json({ picked: false });
  }
}
