import { prisma } from "@/lib/prisma";
import {
  getValidYoutubeAccessToken,
  fetchLiveChatIdWithToken,
  sendYoutubeChatMessage,
} from "@/lib/youtubeOAuth";

// 사이트 라이브 채팅 → YouTube 라이브 채팅 전달.
// 전달 실패는 사이트 채팅 저장에 영향을 주지 않는다.
//
// YouTube Data API 는 OAuth 인증 계정 명의로만 게시되므로(표시 이름 지정 불가)
// 셀러 채널이 직접 친 것처럼 보인다. 발신 주체를 구분하려고 본문에 프리픽스를 붙인다.
// 계정 자체를 바닐라폼 명의로 바꾸려면 전용 봇 계정 OAuth 가 필요하다.

/** 바닐라폼가 대신 게시한 메시지임을 나타내는 프리픽스 */
export const YT_FORWARD_PREFIX = "[바닐라폼]";

/** 프리픽스를 붙인 YouTube 전송용 본문 생성 */
export function withForwardPrefix(body: string): string {
  return `${YT_FORWARD_PREFIX} ${body}`;
}

/**
 * 바닐라폼가 보낸 메시지인지 판별 (폴링 에코 필터용).
 * 프리픽스 형식을 바꾸면 이 함수도 함께 유지보수할 것.
 */
export function isForwardedText(text: string): boolean {
  if (text.startsWith(`${YT_FORWARD_PREFIX} `)) return true;
  // 구 형식 "[닉네임] 메시지" — 이 배포 이전에 전송된 메시지 호환
  return /^\[[^\]]{1,30}\]\s/.test(text);
}

// 분당 발송 상한 — YouTube API 쿼터(프로젝트 공유)와 동일 계정 연속 채팅 제한 보호.
// 초과분은 YouTube 전달만 조용히 생략된다 (사이트 채팅은 정상 표시).
const FORWARD_LIMIT_PER_MIN = 10;
const forwardWindows = new Map<string, { windowStart: number; count: number }>();

function underRateLimit(liveId: string): boolean {
  const now = Date.now();
  const w = forwardWindows.get(liveId);
  if (!w || now - w.windowStart >= 60_000) {
    forwardWindows.set(liveId, { windowStart: now, count: 1 });
    return true;
  }
  if (w.count >= FORWARD_LIMIT_PER_MIN) return false;
  w.count++;
  return true;
}

// YouTube URL → videoId 추출 (youtube-sync 와 동일 패턴)
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

export async function forwardSiteChatToYoutube(
  liveId: string,
  nickname: string,
  message: string,
): Promise<void> {
  const live = await prisma.liveStream.findUnique({
    where: { id: liveId },
    select: {
      status: true,
      platform: true,
      externalUrl: true,
      ytLiveChatId: true,
      ytChatForward: true,
      sellerId: true,
    },
  });
  if (!live || live.status !== "LIVE" || live.platform !== "YOUTUBE") return;
  if (!live.ytChatForward) return;
  if (!underRateLimit(liveId)) return;

  const accessToken = await getValidYoutubeAccessToken(live.sellerId);
  if (!accessToken) return; // 셀러 YouTube OAuth 미연결

  // liveChatId: 채팅 폴링(youtube-sync)이 캐시해둔 값 우선, 없으면 OAuth로 조회 후 캐시
  let liveChatId = live.ytLiveChatId;
  if (!liveChatId && live.externalUrl) {
    const videoId = extractYoutubeVideoId(live.externalUrl);
    if (!videoId) return;
    liveChatId = await fetchLiveChatIdWithToken(videoId, accessToken);
    if (!liveChatId) return;
    await prisma.liveStream
      .update({ where: { id: liveId }, data: { ytLiveChatId: liveChatId } })
      .catch(() => {});
  }
  if (!liveChatId) return;

  // "[바닐라폼] 닉네임: 메시지" — 에코 필터(youtube-sync)가 isForwardedText 로 인식한다
  const text = withForwardPrefix(`${(nickname || "익명").slice(0, 30)}: ${message}`);
  await sendYoutubeChatMessage(live.sellerId, liveChatId, text, accessToken);
}
