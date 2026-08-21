import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET    /api/auth/youtube/status — YouTube OAuth 연결 상태 조회 (셀러 전용)
// DELETE /api/auth/youtube/status — 연결 해제 (저장된 토큰 삭제)

async function getSeller() {
  const session = await auth();
  if (!session || session.user?.role !== "SELLER") return null;
  return prisma.sellerProfile.findUnique({ where: { userId: session.user!.id } });
}

export async function GET() {
  const seller = await getSeller();
  if (!seller) return NextResponse.json({ error: "라이브 셀러만 접근 가능" }, { status: 403 });

  const connected = Boolean(seller.youtubeAccessToken && seller.youtubeRefreshToken);
  return NextResponse.json({
    connected,
    channelTitle: connected ? seller.youtubeChannelTitle : null,
    channelId: connected ? seller.youtubeChannelId : null,
    envReady: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  });
}

export async function DELETE() {
  const seller = await getSeller();
  if (!seller) return NextResponse.json({ error: "라이브 셀러만 접근 가능" }, { status: 403 });

  await prisma.sellerProfile.update({
    where: { id: seller.id },
    data: {
      youtubeAccessToken: null,
      youtubeRefreshToken: null,
      youtubeTokenExpiry: null,
      youtubeChannelTitle: null,
    },
  });
  // 봇의 YouTube 전송 옵션도 함께 OFF
  await prisma.chatBotConfig.updateMany({
    where: { sellerId: seller.id },
    data: { youtubeSendEnabled: false },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
