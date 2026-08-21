import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refreshYoutubeToken } from "@/lib/youtubeOAuth";

// POST /api/auth/youtube/refresh — access_token 수동 갱신 (셀러 전용)

export async function POST() {
  const session = await auth();
  if (!session || session.user?.role !== "SELLER") {
    return NextResponse.json({ error: "라이브 셀러만 접근 가능" }, { status: 403 });
  }
  const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user!.id } });
  if (!seller) return NextResponse.json({ error: "라이브 셀러 프로필 없음" }, { status: 404 });
  if (!seller.youtubeRefreshToken) {
    return NextResponse.json({ error: "YouTube 채널이 연결되어 있지 않습니다." }, { status: 400 });
  }

  const accessToken = await refreshYoutubeToken(seller.id);
  if (!accessToken) {
    return NextResponse.json({ error: "토큰 갱신에 실패했습니다. YouTube 채널을 다시 연결해주세요." }, { status: 502 });
  }
  return NextResponse.json({ success: true });
}
