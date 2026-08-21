import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidYoutubeAccessToken, fetchLiveChatIdWithToken, sendYoutubeChatMessage } from "@/lib/youtubeOAuth";
import { withForwardPrefix } from "@/lib/youtubeChatForward";
import { isMissingDbColumnError } from "@/lib/prismaErrors";

// AI 채팅 봇 엔진 (tick 방식)
// 셀러 라이브 관리 페이지가 라이브 진행 중 주기적으로 호출하면(약 20초 간격)
// 마지막 처리 시점 이후의 앱 채팅 + YouTube 채팅을 분석해 봇 메시지를 앱 채팅에 발송한다.
// - 봇 메시지는 바닐라폼 앱 채팅에 표시 (isBot=true)
// - 셀러가 YouTube OAuth(youtube.force-ssl) 연결 + "YouTube로 전송" 옵션 ON 시
//   liveChat/messages insert 로 YouTube 채팅에도 동시 전송 (토큰 만료 시 자동 갱신)

const BOT_NICKNAME = "AI 바닐라봇";
const MAX_MESSAGES_PER_TICK = 5;

interface KeywordRule { keyword: string; response: string }
interface FaqRule { question: string; answer: string }
interface IncomingMsg { nickname: string; message: string }

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function extractYoutubeVideoId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&?]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/live\/([^?/]+)/,
    /youtube\.com\/embed\/([^?/]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// YouTube 라이브 채팅 새 메시지 조회 (커서 기반).
// 첫 호출(pageToken 없음)은 과거 백로그가 섞여 있어 커서만 저장하고 메시지는 처리하지 않는다.
async function fetchYoutubeMessages(
  videoId: string,
  cursor: { liveChatId: string | null; pageToken: string | null },
  sellerApiKey?: string | null,
): Promise<{ messages: IncomingMsg[]; liveChatId: string | null; pageToken: string | null }> {
  // 셀러가 유튜브AI챗봇 탭에서 등록한 키 우선, 없으면 서버 공용 키 폴백
  const apiKey = sellerApiKey?.trim() || process.env.YOUTUBE_API_KEY;
  if (!apiKey) return { messages: [], liveChatId: cursor.liveChatId, pageToken: cursor.pageToken };

  try {
    let liveChatId = cursor.liveChatId;
    if (!liveChatId) {
      const vRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${encodeURIComponent(videoId)}&key=${apiKey}`,
      );
      if (!vRes.ok) return { messages: [], liveChatId: null, pageToken: null };
      const vData = await vRes.json();
      liveChatId = vData.items?.[0]?.liveStreamingDetails?.activeLiveChatId ?? null;
      if (!liveChatId) return { messages: [], liveChatId: null, pageToken: null };
    }

    const params = new URLSearchParams({ liveChatId, part: "snippet,authorDetails", maxResults: "50", key: apiKey });
    const isFirstPage = !cursor.pageToken;
    if (cursor.pageToken) params.set("pageToken", cursor.pageToken);

    const cRes = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?${params.toString()}`);
    if (!cRes.ok) {
      // 채팅 종료 등 → 커서 리셋 (다음 틱에서 재시도)
      return { messages: [], liveChatId: null, pageToken: null };
    }
    const cData = await cRes.json();
    const messages: IncomingMsg[] = isFirstPage
      ? [] // 백로그 스킵 — 커서 확보용
      : (cData.items || [])
          .filter((it: any) => it.snippet?.displayMessage)
          .map((it: any) => ({
            nickname: it.authorDetails?.displayName || "YouTube",
            message: String(it.snippet.displayMessage),
          }));
    return { messages, liveChatId, pageToken: cData.nextPageToken ?? cursor.pageToken ?? null };
  } catch {
    return { messages: [], liveChatId: cursor.liveChatId, pageToken: cursor.pageToken };
  }
}

// interval(분) 경과 여부
function isDue(last: Date | null, intervalMinutes: number, now: Date): boolean {
  if (!last) return true;
  return now.getTime() - last.getTime() >= intervalMinutes * 60_000;
}

export async function POST(req: NextRequest) {
  try {
    return await handleTick(req);
  } catch (e) {
    // 새 컬럼(isYoutube 등) 미반영 DB(prisma db push 전)에서는 봇 틱을 건너뛴다
    if (isMissingDbColumnError(e)) return NextResponse.json({ skipped: "db_not_migrated" });
    console.error("[live/chatbot]", e);
    return NextResponse.json({ error: "봇 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

async function handleTick(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "SELLER") {
    return NextResponse.json({ error: "라이브 셀러만 접근 가능" }, { status: 403 });
  }
  const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user!.id } });
  if (!seller) return NextResponse.json({ error: "라이브 셀러 프로필 없음" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const liveId = String(body.liveId || "");
  if (!liveId) return NextResponse.json({ error: "liveId가 필요합니다." }, { status: 400 });

  const config = await prisma.chatBotConfig.findUnique({ where: { sellerId: seller.id } });
  if (!config || !config.enabled) return NextResponse.json({ skipped: "봇 비활성" });

  const live = await prisma.liveStream.findUnique({
    where: { id: liveId },
    include: {
      products: {
        include: { product: { select: { name: true, basePrice: true } } },
        orderBy: { sortOrder: "asc" },
      },
      coupons: true,
    },
  });
  if (!live || live.sellerId !== seller.id) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  if (live.status !== "LIVE") return NextResponse.json({ skipped: "라이브 중이 아님" });

  const now = new Date();

  // 라이브가 바뀌면 커서 리셋 (첫 틱: 백로그 스킵, 주기 메시지는 interval 후 시작)
  const isNewLive = config.activeLiveId !== live.id;
  let lastProcessedAt = isNewLive ? now : (config.lastProcessedAt ?? new Date(now.getTime() - 60_000));
  let lastNudgeAt = isNewLive ? now : config.lastNudgeAt;
  let lastStatsAt = isNewLive ? now : config.lastStatsAt;
  let lastCouponAt = isNewLive ? now : config.lastCouponAt;
  let ytLiveChatId = isNewLive ? null : config.ytLiveChatId;
  let ytPageToken = isNewLive ? null : config.ytPageToken;

  const botMessages: string[] = [];

  // ── 신규 앱 채팅 수집 (봇/시스템/매니저/숨김 제외)
  const newMsgs = isNewLive
    ? []
    : await prisma.liveChatMessage.findMany({
        where: {
          liveStreamId: live.id,
          createdAt: { gt: lastProcessedAt },
          isBot: false,
          isSystem: false,
          isManager: false,
          isHidden: false,
          // YouTube 채팅은 아래에서 별도 커서로 직접 수집하므로 앱 채팅 집계에서 제외 (이중 처리 방지)
          isYoutube: false,
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      });

  // ── YouTube 채팅 수집 (읽기 연동 — 키워드 감지에만 사용)
  let ytMsgs: IncomingMsg[] = [];
  const videoId = live.externalUrl ? extractYoutubeVideoId(live.externalUrl) : null;
  if (videoId) {
    const yt = await fetchYoutubeMessages(videoId, { liveChatId: ytLiveChatId, pageToken: ytPageToken }, config.youtubeApiKey);
    ytMsgs = yt.messages;
    ytLiveChatId = yt.liveChatId;
    ytPageToken = yt.pageToken;
  }

  // ── 4. 스팸/욕설 필터: 앱 채팅은 자동 숨김 + 경고, YouTube 채팅은 응답 대상에서만 제외
  const banned = config.spamFilterEnabled ? parseJson<string[]>(config.bannedWords, []).filter(Boolean) : [];
  const containsBanned = (text: string) => banned.some(w => text.includes(w));
  let cleanAppMsgs = newMsgs;
  if (banned.length > 0) {
    const offenders = newMsgs.filter(m => containsBanned(m.message));
    if (offenders.length > 0) {
      await prisma.liveChatMessage.updateMany({
        where: { id: { in: offenders.map(o => o.id) } },
        data: { isHidden: true },
      });
      botMessages.push("🚫 부적절한 표현이 감지되어 일부 메시지가 숨김 처리되었어요. 클린한 채팅 부탁드립니다!");
      cleanAppMsgs = newMsgs.filter(m => !containsBanned(m.message));
    }
    ytMsgs = ytMsgs.filter(m => !containsBanned(m.message));
  }
  const combined: IncomingMsg[] = [
    ...cleanAppMsgs.map(m => ({ nickname: m.nickname, message: m.message })),
    ...ytMsgs,
  ];

  // ── 1. 자동 인사: 이 라이브에서 처음 채팅한 시청자 환영
  if (config.greetingEnabled && cleanAppMsgs.length > 0) {
    const nicknames = Array.from(new Set(cleanAppMsgs.map(m => m.nickname))).slice(0, 10);
    const newcomers: string[] = [];
    for (const nick of nicknames) {
      const earlier = await prisma.liveChatMessage.count({
        where: { liveStreamId: live.id, nickname: nick, isBot: false, createdAt: { lte: lastProcessedAt } },
      });
      if (earlier === 0) newcomers.push(nick);
    }
    if (newcomers.length > 0) {
      const greet = config.greetingMessage?.trim() || "환영합니다! 즐거운 라이브 되세요 🍯";
      botMessages.push(`@${newcomers.slice(0, 3).join("님, @")}님 ${greet}`);
    }
  }

  // ── 2 + 5. 키워드 자동 응답 & FAQ 자동 응답 (contains 매칭, 응답 중복 제거)
  const rules: KeywordRule[] = [
    ...(config.keywordEnabled ? parseJson<KeywordRule[]>(config.keywords, []) : []),
    ...(config.faqEnabled
      ? parseJson<FaqRule[]>(config.faqs, []).map(f => ({ keyword: f.question, response: f.answer }))
      : []),
  ].filter(r => r.keyword?.trim() && r.response?.trim());
  if (rules.length > 0 && combined.length > 0) {
    const matchedResponses = new Set<string>();
    for (const msg of combined) {
      for (const r of rules) {
        if (msg.message.includes(r.keyword.trim())) matchedResponses.add(r.response.trim());
      }
    }
    botMessages.push(...Array.from(matchedResponses).slice(0, 3).map(resp => resp));
  }

  // ── 3. 상품 정보 자동 안내 ("N번 상품", "가격/얼마", "재고/품절")
  if (config.productInfoEnabled && combined.length > 0 && live.products.length > 0) {
    for (const msg of combined) {
      const numMatch = msg.message.match(/(\d+)\s*번/);
      if (numMatch && /상품|제품|아이템|뭐예요|뭐에요/.test(msg.message)) {
        const lp = live.products[parseInt(numMatch[1], 10) - 1];
        if (lp) {
          const price = lp.livePrice ? Number(lp.livePrice) : Number(lp.product.basePrice);
          botMessages.push(`${numMatch[1]}번 상품은 「${lp.product.name}」 — 라이브 특가 ${price.toLocaleString()}원! 화면의 상품 목록에서 바로 구매하실 수 있어요 🍯`);
          break; // 틱당 1건
        }
      } else if (/가격|얼마/.test(msg.message)) {
        const lp = live.products.find(p => p.isActive) || live.products[0];
        const price = lp.livePrice ? Number(lp.livePrice) : Number(lp.product.basePrice);
        botMessages.push(`지금 소개 중인 「${lp.product.name}」은 라이브 특가 ${price.toLocaleString()}원이에요! 🍯`);
        break;
      } else if (/재고|품절|남았/.test(msg.message)) {
        botMessages.push("라이브 특가 재고는 실시간으로 소진되고 있어요! 상품 상세 페이지에서 옵션별 재고를 확인해 주세요 🍯");
        break;
      }
    }
  }

  // ── 6. 구매 유도 메시지 (주기)
  if (config.purchaseNudgeEnabled && isDue(lastNudgeAt, config.purchaseNudgeInterval, now)) {
    botMessages.push(`🍯 ${config.purchaseNudgeMessage?.trim() || "지금 구매하시면 라이브 특가 적용! 화면의 상품을 확인해보세요"}`);
    lastNudgeAt = now;
  }

  // ── 7. 라이브 통계 공지 (주기)
  if (config.statsEnabled && isDue(lastStatsAt, config.statsInterval, now)) {
    botMessages.push(`📊 현재 시청자 ${live.viewerCount.toLocaleString()}명 · 좋아요 ${live.likeCount.toLocaleString()}개! 함께해 주셔서 감사합니다`);
    lastStatsAt = now;
  }

  // ── 8. 쿠폰 코드 자동 공지 (주기)
  if (config.couponEnabled && live.coupons.length > 0 && isDue(lastCouponAt, config.couponInterval, now)) {
    const couponText = live.coupons
      .slice(0, 3)
      .map(c => `[${c.code}] ${Number(c.discountValue).toLocaleString()}${c.discountType === "PERCENT" ? "%" : "원"} 할인`)
      .join(" · ");
    botMessages.push(`🎁 라이브 쿠폰 안내! ${couponText} — 쿠폰 탭에서 받아가세요`);
    lastCouponAt = now;
  }

  // ── 발송: 최근 2분 내 동일 봇 메시지는 스킵(도배 방지), 틱당 최대 5건
  const recentBot = await prisma.liveChatMessage.findMany({
    where: { liveStreamId: live.id, isBot: true, createdAt: { gt: new Date(now.getTime() - 2 * 60_000) } },
    select: { message: true },
  });
  const recentSet = new Set(recentBot.map(b => b.message));
  const toSend = Array.from(new Set(botMessages)).filter(m => !recentSet.has(m)).slice(0, MAX_MESSAGES_PER_TICK);

  if (toSend.length > 0) {
    await prisma.liveChatMessage.createMany({
      data: toSend.map(m => ({ liveStreamId: live.id, nickname: BOT_NICKNAME, message: m, isBot: true })),
    });
  }

  // ── YouTube 채팅 동시 전송 (OAuth 연결 + "YouTube로 전송" ON + 라이브 채팅 확보 시)
  let ytSent = 0;
  if (toSend.length > 0 && config.youtubeSendEnabled && videoId) {
    let accessToken = await getValidYoutubeAccessToken(seller.id);
    if (accessToken) {
      // API 키 폴링으로 확보한 liveChatId 재사용, 없으면 OAuth 로 조회
      let chatId = ytLiveChatId;
      if (!chatId) {
        chatId = await fetchLiveChatIdWithToken(videoId, accessToken);
        if (chatId) ytLiveChatId = chatId;
      }
      if (chatId) {
        for (const m of toSend) {
          // 프리픽스를 붙여야 (1) 봇 메시지임이 구분되고 (2) 폴링으로 되돌아온 메시지를
          // youtube-sync 에코 필터가 걸러내 사이트 채팅에 중복 표시되지 않는다.
          const result = await sendYoutubeChatMessage(seller.id, chatId, withForwardPrefix(m), accessToken);
          accessToken = result.accessToken; // 갱신된 토큰 재사용
          if (result.ok) ytSent += 1;
          else break; // 연속 실패 시 중단 (쿼터/권한 문제)
        }
      }
    }
  }

  // 커서 저장
  await prisma.chatBotConfig.update({
    where: { id: config.id },
    data: { activeLiveId: live.id, lastProcessedAt: now, lastNudgeAt, lastStatsAt, lastCouponAt, ytLiveChatId, ytPageToken },
  });

  return NextResponse.json({ sent: toSend.length, ytSent, messages: toSend });
}
