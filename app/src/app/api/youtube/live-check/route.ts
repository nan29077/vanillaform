import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** 유튜브 채널 URL 또는 @handle → 채널 ID 추출 */
function extractChannelId(input: string): { channelId?: string; handle?: string } {
  const s = input.trim();

  // 직접 채널 ID (UCxxx...)
  if (/^UC[\w-]{22}$/.test(s)) return { channelId: s };

  // URL 파싱
  try {
    const url = new URL(s.startsWith("http") ? s : `https://${s}`);
    const path = url.pathname;

    // /channel/UCxxx
    const chanMatch = path.match(/\/channel\/(UC[\w-]{22})/);
    if (chanMatch) return { channelId: chanMatch[1] };

    // /@handle 또는 /c/handle 또는 /user/handle
    const handleMatch = path.match(/\/(?:@|c\/|user\/)([^/]+)/);
    if (handleMatch) return { handle: handleMatch[1] };
  } catch {
    // URL 파싱 실패 → handle로 시도
    if (s.startsWith("@")) return { handle: s.slice(1) };
    return { handle: s };
  }

  return {};
}

/** handle → 채널 ID (YouTube Data API forHandle) */
async function resolveHandleToChannelId(handle: string, apiKey: string): Promise<string | null> {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.items?.[0]?.id ?? null;
}

/** 채널 ID → 현재 라이브 비디오 ID */
async function getLiveVideoId(channelId: string, apiKey: string): Promise<string | null> {
  const url = `https://www.googleapis.com/youtube/v3/search?part=id,snippet&channelId=${channelId}&eventType=live&type=video&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.items?.[0]?.id?.videoId ?? null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 셀러가 유튜브AI챗봇 탭에 등록한 API 키 우선, 없으면 서버 공용 키 폴백
  let apiKey = process.env.YOUTUBE_API_KEY || "";
  try {
    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
      select: { chatBotConfig: { select: { youtubeApiKey: true } } },
    });
    const sellerKey = seller?.chatBotConfig?.youtubeApiKey?.trim();
    if (sellerKey) apiKey = sellerKey;
  } catch {
    // youtubeApiKey 컬럼 미반영 DB(prisma db push 전) 등 → 서버 공용 키로 폴백
  }
  if (!apiKey) {
    return NextResponse.json({ error: "API_KEY_NOT_SET" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const channelInput = (searchParams.get("channelId") || searchParams.get("channelUrl") || "").trim();
  if (!channelInput) {
    return NextResponse.json({ error: "channelId 또는 channelUrl 파라미터가 필요합니다." }, { status: 400 });
  }

  // 셀러 페이지의 키 설정 여부 프로브 — 실제 YouTube API 호출 없이 즉시 응답 (쿼터 보호)
  if (channelInput === "_check_only_") {
    return NextResponse.json({ ok: true });
  }

  try {
    const extracted = extractChannelId(channelInput);
    let channelId = extracted.channelId ?? null;

    // handle → channelId 변환
    if (!channelId && extracted.handle) {
      channelId = await resolveHandleToChannelId(extracted.handle, apiKey);
      if (!channelId) {
        return NextResponse.json({ error: "채널을 찾을 수 없습니다. 채널 ID 또는 URL을 확인하세요." }, { status: 404 });
      }
    }

    if (!channelId) {
      return NextResponse.json({ error: "채널 ID를 인식할 수 없습니다." }, { status: 400 });
    }

    const videoId = await getLiveVideoId(channelId, apiKey);
    if (!videoId) {
      return NextResponse.json({ error: "현재 라이브 중인 방송이 없습니다." }, { status: 404 });
    }

    const liveUrl = `https://www.youtube.com/watch?v=${videoId}`;
    return NextResponse.json({ liveUrl, videoId, channelId });
  } catch (e) {
    console.error("[youtube/live-check]", e);
    return NextResponse.json({ error: "YouTube API 호출 중 오류가 발생했습니다." }, { status: 500 });
  }
}
