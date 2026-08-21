import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/appUrl";

// YouTube OAuth 2.0 공용 헬퍼 (채팅 쓰기·채널/방송 자동 감지)
// - 스코프: https://www.googleapis.com/auth/youtube.force-ssl (liveChatMessages.insert 포함)
// - 토큰은 SellerProfile.youtubeAccessToken / youtubeRefreshToken / youtubeTokenExpiry 에 저장
// - 환경변수: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_URL

export const YOUTUBE_OAUTH_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export function getYoutubeRedirectUri(): string {
  return `${getAppBaseUrl()}/api/auth/youtube/callback`;
}

export function buildYoutubeAuthUrl(state: string): string | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getYoutubeRedirectUri(),
    response_type: "code",
    scope: YOUTUBE_OAUTH_SCOPE,
    access_type: "offline", // refresh_token 발급
    prompt: "consent", // 재연결 시에도 refresh_token 재발급
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // 초
}

// 인가 코드 → access/refresh 토큰 교환
export async function exchangeYoutubeCode(code: string): Promise<TokenResponse | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: getYoutubeRedirectUri(),
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as TokenResponse;
  } catch {
    return null;
  }
}

// refresh_token → 새 access_token 발급 후 DB 갱신. 실패 시 null.
export async function refreshYoutubeToken(sellerId: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const seller = await prisma.sellerProfile.findUnique({
    where: { id: sellerId },
    select: { youtubeRefreshToken: true },
  });
  if (!seller?.youtubeRefreshToken) return null;

  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: seller.youtubeRefreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as TokenResponse;
    if (!data.access_token) return null;

    await prisma.sellerProfile.update({
      where: { id: sellerId },
      data: {
        youtubeAccessToken: data.access_token,
        youtubeTokenExpiry: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
      },
    });
    return data.access_token;
  } catch {
    return null;
  }
}

// 유효한 access_token 반환 (만료 임박 시 자동 갱신). 미연결이면 null.
export async function getValidYoutubeAccessToken(sellerId: string): Promise<string | null> {
  const seller = await prisma.sellerProfile.findUnique({
    where: { id: sellerId },
    select: { youtubeAccessToken: true, youtubeRefreshToken: true, youtubeTokenExpiry: true },
  });
  if (!seller?.youtubeAccessToken) return null;

  // 만료 1분 전부터는 갱신 시도
  const expiresSoon = !seller.youtubeTokenExpiry || seller.youtubeTokenExpiry.getTime() - Date.now() < 60_000;
  if (expiresSoon && seller.youtubeRefreshToken) {
    const refreshed = await refreshYoutubeToken(sellerId);
    if (refreshed) return refreshed;
  }
  return seller.youtubeAccessToken;
}

// OAuth 토큰으로 내 채널 정보 조회 (channels.list mine=true)
export async function fetchMyYoutubeChannel(accessToken: string): Promise<{ channelId: string; title: string } | null> {
  try {
    const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const ch = data.items?.[0];
    if (!ch?.id) return null;
    return { channelId: ch.id, title: ch.snippet?.title || "" };
  } catch {
    return null;
  }
}

// OAuth 토큰으로 현재 진행 중인 내 방송 조회 (liveBroadcasts.list broadcastStatus=active)
export async function fetchMyActiveBroadcast(accessToken: string): Promise<{ videoId: string; title: string; liveChatId: string | null } | null> {
  try {
    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/liveBroadcasts?part=id,snippet,status&broadcastStatus=active&broadcastType=all&maxResults=5",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const item = (data.items || []).find((b: any) => b.status?.lifeCycleStatus === "live") || data.items?.[0];
    if (!item?.id) return null;
    return {
      videoId: item.id,
      title: item.snippet?.title || "",
      liveChatId: item.snippet?.liveChatId ?? null,
    };
  } catch {
    return null;
  }
}

// OAuth 토큰으로 videoId → activeLiveChatId 조회
export async function fetchLiveChatIdWithToken(videoId: string, accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${encodeURIComponent(videoId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.items?.[0]?.liveStreamingDetails?.activeLiveChatId ?? null;
  } catch {
    return null;
  }
}

// 봇 메시지를 YouTube 라이브 채팅으로 전송 (liveChat/messages insert)
// 401(토큰 만료) 시 1회 자동 갱신 후 재시도. 성공 여부 반환.
export async function sendYoutubeChatMessage(
  sellerId: string,
  liveChatId: string,
  message: string,
  accessToken: string,
): Promise<{ ok: boolean; accessToken: string }> {
  const doSend = async (token: string) =>
    fetch("https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        snippet: {
          liveChatId,
          type: "textMessageEvent",
          textMessageDetails: { messageText: message.slice(0, 200) },
        },
      }),
    });

  try {
    let token = accessToken;
    let res = await doSend(token);
    if (res.status === 401) {
      const refreshed = await refreshYoutubeToken(sellerId);
      if (!refreshed) return { ok: false, accessToken: token };
      token = refreshed;
      res = await doSend(token);
    }
    return { ok: res.ok, accessToken: token };
  } catch {
    return { ok: false, accessToken };
  }
}
