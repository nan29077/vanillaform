import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// YouTube 라이브 채팅 읽기 전용 프록시 (YouTube Data API v3)
// - videoId → videos.list(liveStreamingDetails)로 activeLiveChatId 조회
// - liveChatId → liveChat/messages.list 폴링 결과 반환
// - 쓰기(liveChatMessages.insert)는 채널 소유자 OAuth가 필요해 지원하지 않음 (뷰어 UI에 안내만 표시)
// - API 키: liveId/code 로 라이브의 셀러를 찾아 유튜브AI챗봇 탭에서 등록한 키를 우선 사용,
//   없으면 서버 공용 YOUTUBE_API_KEY 폴백. 둘 다 없으면 503 API_KEY_NOT_SET → 클라이언트는 폴링 중단

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let liveChatId = searchParams.get("liveChatId");
  const videoId = searchParams.get("videoId");
  const pageToken = searchParams.get("pageToken");
  const liveId = searchParams.get("liveId");
  const code = searchParams.get("code");

  // 셀러가 유튜브AI챗봇 탭에서 등록한 API 키 조회 (없으면 서버 공용 키 폴백)
  let apiKey: string | null = process.env.YOUTUBE_API_KEY || null;
  if (liveId || code) {
    try {
      const live = await prisma.liveStream.findUnique({
        where: liveId ? { id: liveId } : { shareCode: code! },
        select: { seller: { select: { chatBotConfig: { select: { youtubeApiKey: true } } } } },
      });
      const sellerKey = live?.seller?.chatBotConfig?.youtubeApiKey?.trim();
      if (sellerKey) apiKey = sellerKey;
    } catch (e) {
      console.error("[live/youtube-chat] 셀러 API 키 조회 실패", e);
    }
  }
  if (!apiKey) {
    return NextResponse.json({ error: "API_KEY_NOT_SET" }, { status: 503 });
  }

  if (!liveChatId && !videoId) {
    return NextResponse.json({ error: "videoId 또는 liveChatId 파라미터가 필요합니다." }, { status: 400 });
  }

  try {
    // 1단계: videoId → activeLiveChatId (최초 1회, 이후 클라이언트가 liveChatId 캐싱)
    if (!liveChatId && videoId) {
      const vRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${encodeURIComponent(videoId)}&key=${apiKey}`,
      );
      if (!vRes.ok) {
        return NextResponse.json({ error: "YouTube API 호출에 실패했습니다." }, { status: 502 });
      }
      const vData = await vRes.json();
      liveChatId = vData.items?.[0]?.liveStreamingDetails?.activeLiveChatId ?? null;
      if (!liveChatId) {
        // 라이브가 아니거나 채팅이 꺼진 영상 → 클라이언트는 폴링 중단
        return NextResponse.json({ error: "NO_ACTIVE_CHAT" }, { status: 404 });
      }
    }

    // 2단계: 라이브 채팅 메시지 조회
    const params = new URLSearchParams({
      liveChatId: liveChatId!,
      part: "snippet,authorDetails",
      maxResults: "50",
      key: apiKey,
    });
    if (pageToken) params.set("pageToken", pageToken);

    const cRes = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?${params.toString()}`);
    if (!cRes.ok) {
      // 403/404는 채팅 종료·비활성 케이스 → 클라이언트가 폴링을 멈추도록 구분
      const ended = cRes.status === 403 || cRes.status === 404;
      return NextResponse.json(
        { error: ended ? "CHAT_ENDED" : "YouTube API 호출에 실패했습니다." },
        { status: ended ? 404 : 502 },
      );
    }
    const cData = await cRes.json();

    const messages = (cData.items || [])
      .filter((it: any) => it.snippet?.displayMessage)
      .map((it: any) => ({
        id: it.id,
        nickname: it.authorDetails?.displayName || "YouTube",
        message: it.snippet.displayMessage,
        createdAt: it.snippet.publishedAt,
        isOwner: Boolean(it.authorDetails?.isChatOwner),
      }));

    return NextResponse.json({
      liveChatId,
      nextPageToken: cData.nextPageToken ?? null,
      pollingIntervalMillis: cData.pollingIntervalMillis ?? 7000,
      messages,
    });
  } catch (e) {
    console.error("[live/youtube-chat]", e);
    return NextResponse.json({ error: "YouTube 채팅 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
