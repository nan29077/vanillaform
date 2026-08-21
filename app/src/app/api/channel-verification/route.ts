import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncSellerFanCount } from "@/lib/sellerFans";

// GET: 구매자의 특정 셀러 채널 인증 상태 조회
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ verifications: [] });

  const { searchParams } = new URL(req.url);
  const sellerId = searchParams.get("sellerId");
  if (!sellerId) return NextResponse.json({ verifications: [] });

  const buyer = await prisma.buyerProfile.findUnique({
    where: { userId: session.user!.id },
  });
  if (!buyer) return NextResponse.json({ verifications: [] });

  const verifications = await prisma.channelVerification.findMany({
    where: { buyerId: buyer.id, sellerId },
  });

  return NextResponse.json({ verifications });
}

// POST: 채널 인증 제출 (스크린샷 업로드 + OCR 자동분석)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const { sellerId, channelType, screenshotUrl } = await req.json();
  if (!sellerId || !channelType) {
    return NextResponse.json({ error: "필수 정보 누락" }, { status: 400 });
  }

  let buyer = await prisma.buyerProfile.findUnique({
    where: { userId: session.user!.id },
  });
  if (!buyer) {
    buyer = await prisma.buyerProfile.create({
      data: { userId: session.user!.id },
    });
  }

  // 기존 인증 확인
  const existing = await prisma.channelVerification.findUnique({
    where: {
      buyerId_sellerId_channelType: {
        buyerId: buyer.id,
        sellerId,
        channelType,
      },
    },
  });

  if (existing) {
    if (existing.status === "APPROVED") {
      return NextResponse.json({ error: "이미 인증 완료된 채널입니다.", verification: existing });
    }
    // 재신청: PENDING으로 업데이트
    const updated = await prisma.channelVerification.update({
      where: { id: existing.id },
      data: { screenshotUrl, status: "PENDING" },
    });

    return NextResponse.json({
      verification: updated,
      message: "인증 재신청 완료. 라이브 셀러/관리자 확인 후 승인됩니다.",
    });
  }

  // 새로 생성 (항상 PENDING — 수동 승인 필요)
  const verification = await prisma.channelVerification.create({
    data: {
      buyerId: buyer.id,
      sellerId,
      channelType,
      screenshotUrl,
      status: "PENDING",
    },
  });

  return NextResponse.json({
    verification,
    message: "채널 인증 신청 완료. 라이브 셀러/관리자 확인 후 승인됩니다.",
  });
}

// PATCH: 인증 승인/거부 (셀러 또는 관리자)
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const role = session.user?.role;
  if (role !== "SELLER" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { verificationId, action } = await req.json();
  if (!verificationId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const verification = await prisma.channelVerification.findUnique({
    where: { id: verificationId },
    include: { seller: true, buyer: true },
  });

  if (!verification) return NextResponse.json({ error: "인증 요청 없음" }, { status: 404 });

  // 셀러인 경우 자기 인증만 처리 가능
  if (role === "SELLER") {
    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!seller || seller.id !== verification.sellerId) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }
  }

  const updated = await prisma.channelVerification.update({
    where: { id: verificationId },
    data: {
      status: action === "approve" ? "APPROVED" : "REJECTED",
      verifiedAt: action === "approve" ? new Date() : null,
    },
  });

  // 승인/거절 알림
  if (action === "approve") {
    await prisma.notification.create({
      data: {
        userId: verification.buyer.userId,
        title: "채널 구독 인증 승인!",
        message: `${verification.seller.shopName} 채널 구독 인증이 승인되었습니다. 할인 혜택이 적용됩니다!`,
        type: "channel_verification",
      },
    });
  } else {
    // 거절 시 Pick(팔로우) 해제 + totalFans 재집계 (인증 기록은 REJECTED로 유지)
    const follower = await prisma.sellerFollower.findUnique({
      where: {
        buyerId_sellerId: {
          buyerId: verification.buyerId,
          sellerId: verification.sellerId,
        },
      },
    });
    if (follower) {
      await prisma.sellerFollower.delete({ where: { id: follower.id } });
      await syncSellerFanCount(verification.sellerId);
    }

    await prisma.notification.create({
      data: {
        userId: verification.buyer.userId,
        title: "채널 구독 인증 거절",
        message: `${verification.seller.shopName} 채널 구독 인증이 거절되었습니다. 캡쳐 화면을 확인 후 다시 인증해주세요.`,
        type: "channel_verification",
      },
    });
  }

  return NextResponse.json({ verification: updated });
}
