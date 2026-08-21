import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidYoutubeAccessToken, fetchMyActiveBroadcast } from "@/lib/youtubeOAuth";

// GET /api/youtube/my-live — OAuth 연결된 셀러의 진행 중인 YouTube 방송 자동 감지 (B방식)
// liveBroadcasts.list(broadcastStatus=active) 로 현재 방송 중인 videoId 를 반환.
// OAuth 미연결 시 fallback: 저장된 youtubeChannelId + YOUTUBE_API_KEY 검색.

export async function GET() {
  const session = await auth();
  if (!session || session.user?.role !== "SELLER") {
    return NextResponse.json({ error: "라이브 셀러만 접근 가능" }, { status: 403 });
  }
  const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user!.id } });
  if (!seller) return NextResponse.json({ error: "라이브 셀러 프로필 없음" }, { status: 404 });

  // 1) OAuth 기반 감지 (정확 — 비공개/일부공개 방송도 감지)
  const accessToken = await getValidYoutubeAccessToken(seller.id);
  if (accessToken) {
    const broadcast = await fetchMyActiveBroadcast(accessToken);
    if (broadcast) {
      return NextResponse.json({
        live: true,
        videoId: broadcast.videoId,
        title: broadcast.title,
        liveUrl: `https://www.youtube.com/watch?v=${broadcast.videoId}`,
        source: "oauth",
      });
    }
    return NextResponse.json({ live: false, source: "oauth" });
  }

  // 2) fallback: 채널 ID + API 키 공개 검색
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (seller.youtubeChannelId && apiKey) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${encodeURIComponent(seller.youtubeChannelId)}&eventType=live&type=video&key=${apiKey}`,
      );
      if (res.ok) {
        const data = await res.json();
        const videoId = data.items?.[0]?.id?.videoId ?? null;
        if (videoId) {
          return NextResponse.json({
            live: true,
            videoId,
            title: null,
            liveUrl: `https://www.youtube.com/watch?v=${videoId}`,
            source: "apikey",
          });
        }
        return NextResponse.json({ live: false, source: "apikey" });
      }
    } catch {
      // 아래 NOT_CONNECTED 응답으로 진행
    }
  }

  return NextResponse.json({ live: false, error: "NOT_CONNECTED" }, { status: 400 });
}
