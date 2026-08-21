import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isMissingDbColumnError } from "@/lib/prismaErrors";
import { isForwardedText } from "@/lib/youtubeChatForward";

// YouTube 라이브 채팅 → 앱 채팅(LiveChatMessage) 병합 수집 엔드포인트
//
// 라이브 방송 화면(시청자/방송자)이 라이브 진행 중 주기적으로 호출한다.
// 서버가 셀러의 YouTube Data API v3 키로 liveChat/messages 를 폴링해
// 새 메시지를 isYoutube=true 로 저장하면, 기존 8초 채팅 폴링(/api/live?mode=detail)이
// 모든 접속 브라우저에 그대로 전달한다. (키득마켓/레어팜의 서버 폴링 방식을 DB 저장으로 적용)
//
// - 동시 다발 호출은 ytSyncedAt 타임스탬프를 원자적으로 선점(claim)해
//   실제 YouTube 폴링은 window 당 1회만 수행 → 쿼터 절약 + 중복 방지
// - 최초 폴링은 과거 백로그가 섞여 있어 커서만 저장하고 메시지는 건너뛴다
// - videoId → activeLiveChatId 조회 후 liveChat/messages 폴링 (레어팜/키득마켓 동일)

const SYNC_THROTTLE_MS = 4500; // YouTube 폴링 최소 간격 (쿼터 보호)
const MAX_INSERT = 80; // 한 번에 저장할 최대 메시지 수

// YouTube URL → videoId 추출 (watch?v=, youtu.be/, /live/, /embed/ 지원)
function extractYoutubeVideoId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&?]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/live\/([^?/]+)/,
    /youtube\.com\/embed\/([^?/]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    return await handleSync(req);
  } catch (e) {
    // yt* 컬럼 미반영 DB(prisma db push 전)에서는 폴링을 건너뛴다 (클라이언트 ping 은 무해하게 종료)
    if (isMissingDbColumnError(e)) return NextResponse.json({ skipped: "db_not_migrated" });
    console.error("[live/youtube-sync]", e);
    return NextResponse.json({ skipped: "error" });
  }
}

async function handleSync(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const liveId = String(body?.liveId || "");
  if (!liveId) return NextResponse.json({ error: "liveId가 필요합니다." }, { status: 400 });

  const live = await prisma.liveStream.findUnique({
    where: { id: liveId },
    select: {
      id: true,
      sellerId: true,
      status: true,
      platform: true,
      externalUrl: true,
      ytLiveChatId: true,
      ytNextPageToken: true,
      seller: { select: { youtubeChannelId: true } },
    },
  });
  if (!live) return NextResponse.json({ error: "라이브를 찾을 수 없습니다." }, { status: 404 });
  if (live.status !== "LIVE") return NextResponse.json({ skipped: "not_live" });
  if (live.platform !== "YOUTUBE" || !live.externalUrl) return NextResponse.json({ skipped: "not_youtube" });

  const videoId = extractYoutubeVideoId(live.externalUrl);
  if (!videoId) return NextResponse.json({ skipped: "no_video_id" });

  // 셀러가 유튜브AI챗봇 탭에서 입력한 API 키 우선, 없으면 서버 공용 키 폴백
  const config = await prisma.chatBotConfig.findUnique({
    where: { sellerId: live.sellerId },
    select: { youtubeApiKey: true },
  });
  const apiKey = (config?.youtubeApiKey && config.youtubeApiKey.trim()) || process.env.YOUTUBE_API_KEY || "";
  if (!apiKey) return NextResponse.json({ skipped: "no_api_key", needsApiKey: true });

  // ── 폴링 window 원자적 선점: throttle 이내면 다른 요청이 이미 처리 중 → 스킵
  const now = new Date();
  const claim = await prisma.liveStream.updateMany({
    where: {
      id: liveId,
      OR: [{ ytSyncedAt: null }, { ytSyncedAt: { lt: new Date(now.getTime() - SYNC_THROTTLE_MS) } }],
    },
    data: { ytSyncedAt: now },
  });
  if (claim.count === 0) return NextResponse.json({ skipped: "throttled" });

  try {
    // 1) liveChatId 확보 (없으면 videos.list 로 activeLiveChatId 조회 후 캐시)
    let liveChatId = live.ytLiveChatId;
    if (!liveChatId) {
      const vRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${encodeURIComponent(videoId)}&key=${apiKey}`,
      );
      if (!vRes.ok) return NextResponse.json({ skipped: "video_lookup_failed" });
      const vData = await vRes.json();
      liveChatId = vData.items?.[0]?.liveStreamingDetails?.activeLiveChatId ?? null;
      if (!liveChatId) return NextResponse.json({ skipped: "no_active_chat" });
      await prisma.liveStream.update({ where: { id: liveId }, data: { ytLiveChatId: liveChatId } });
    }

    // 2) liveChat/messages 폴링 (커서 기반)
    const params = new URLSearchParams({
      liveChatId,
      part: "snippet,authorDetails",
      maxResults: "200",
      key: apiKey,
    });
    const isFirstPage = !live.ytNextPageToken;
    if (live.ytNextPageToken) params.set("pageToken", live.ytNextPageToken);

    const cRes = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?${params.toString()}`);
    if (!cRes.ok) {
      // 채팅 종료/쿼터 초과 등 → 커서 리셋해 다음 폴링에서 재시도
      await prisma.liveStream.update({ where: { id: liveId }, data: { ytLiveChatId: null, ytNextPageToken: null } });
      const ended = cRes.status === 403 || cRes.status === 404;
      return NextResponse.json({ skipped: ended ? "chat_ended" : "poll_failed" });
    }
    const cData = await cRes.json();
    const nextPageToken: string | null = cData.nextPageToken ?? null;

    // 바닐라폼가 셀러 계정 명의로 보낸 메시지("[바닐라폼] ...")가 폴링으로 되돌아와
    // 사이트 채팅에 중복 표시되는 것 방지. 셀러가 YouTube에서 직접 친 일반 채팅은 프리픽스가 없어 통과한다.
    const sellerChannelId = live.seller?.youtubeChannelId || null;
    const isForwardedEcho = (it: any): boolean => {
      const author = it?.authorDetails || {};
      const fromSellerAccount =
        author.isChatOwner === true || (sellerChannelId && author.channelId === sellerChannelId);
      return Boolean(fromSellerAccount) && isForwardedText(String(it?.snippet?.displayMessage || ""));
    };

    // 최초 폴링은 과거 백로그를 저장하지 않고 커서만 확보 (도배 방지)
    let inserted = 0;
    if (!isFirstPage) {
      const items = (cData.items || [])
        .filter((it: any) => it?.id && it?.snippet?.displayMessage && !isForwardedEcho(it))
        .slice(-MAX_INSERT)
        .map((it: any) => ({
          liveStreamId: liveId,
          nickname: String(it.authorDetails?.displayName || "YouTube"),
          message: String(it.snippet.displayMessage),
          isYoutube: true,
          ytMessageId: String(it.id).slice(0, 191),
          // YouTube 게시 시각으로 저장 → 앱 채팅과 시간순으로 자연스럽게 병합
          createdAt: it.snippet?.publishedAt ? new Date(it.snippet.publishedAt) : now,
        }));
      if (items.length > 0) {
        const res = await prisma.liveChatMessage.createMany({ data: items, skipDuplicates: true });
        inserted = res.count;
      }
    }

    await prisma.liveStream.update({ where: { id: liveId }, data: { ytNextPageToken: nextPageToken } });
    return NextResponse.json({ inserted, hasChat: true });
  } catch (e) {
    console.error("[live/youtube-sync]", e);
    return NextResponse.json({ skipped: "error" });
  }
}
