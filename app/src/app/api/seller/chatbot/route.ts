import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DB_MIGRATION_WARNING } from "@/lib/prismaErrors";

// 셀러 AI 채팅 봇 설정 조회/저장 + 봇 활동 로그
// keywords/bannedWords/faqs 는 MySQL 배열 미지원으로 String @db.Text 에 JSON 직렬화 저장
// youtubeApiKey 컬럼이 DB에 아직 없으면(P2022) 해당 필드를 제외하고 폴백 조회/저장한다.

export interface KeywordRule { keyword: string; response: string }
export interface FaqRule { question: string; answer: string }

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function clampInterval(value: unknown, fallback: number): number {
  const n = parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(120, n));
}

async function getSeller(userId: string) {
  return prisma.sellerProfile.findUnique({ where: { userId } });
}

function serializeConfig(config: any) {
  return {
    enabled: config?.enabled ?? false,
    greetingEnabled: config?.greetingEnabled ?? true,
    greetingMessage: config?.greetingMessage ?? "",
    keywordEnabled: config?.keywordEnabled ?? true,
    keywords: parseJson<KeywordRule[]>(config?.keywords, []),
    productInfoEnabled: config?.productInfoEnabled ?? true,
    spamFilterEnabled: config?.spamFilterEnabled ?? true,
    bannedWords: parseJson<string[]>(config?.bannedWords, []),
    faqEnabled: config?.faqEnabled ?? true,
    faqs: parseJson<FaqRule[]>(config?.faqs, []),
    purchaseNudgeEnabled: config?.purchaseNudgeEnabled ?? false,
    purchaseNudgeMessage: config?.purchaseNudgeMessage ?? "",
    purchaseNudgeInterval: config?.purchaseNudgeInterval ?? 5,
    statsEnabled: config?.statsEnabled ?? false,
    statsInterval: config?.statsInterval ?? 10,
    couponEnabled: config?.couponEnabled ?? false,
    couponInterval: config?.couponInterval ?? 10,
    youtubeSendEnabled: config?.youtubeSendEnabled ?? false,
    youtubeApiKey: config?.youtubeApiKey ?? "",
  };
}

// youtubeApiKey 컬럼이 없는 DB 폴백용 — 기존 컬럼만 명시적으로 select
const LEGACY_CONFIG_SELECT = {
  enabled: true,
  greetingEnabled: true,
  greetingMessage: true,
  keywordEnabled: true,
  keywords: true,
  productInfoEnabled: true,
  spamFilterEnabled: true,
  bannedWords: true,
  faqEnabled: true,
  faqs: true,
  purchaseNudgeEnabled: true,
  purchaseNudgeMessage: true,
  purchaseNudgeInterval: true,
  statsEnabled: true,
  statsInterval: true,
  couponEnabled: true,
  couponInterval: true,
  youtubeSendEnabled: true,
} as const;

// GET: 봇 설정 조회 (mode=logs 이면 최근 봇 발송 메시지 로그)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "SELLER") {
    return NextResponse.json({ error: "라이브 셀러만 접근 가능" }, { status: 403 });
  }
  const seller = await getSeller(session.user!.id);
  if (!seller) return NextResponse.json({ error: "라이브 셀러 프로필 없음" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  if (searchParams.get("mode") === "logs") {
    // isYoutube 컬럼 미반영 DB에서도 동작하도록 사용 컬럼만 select
    const logs = await prisma.liveChatMessage.findMany({
      where: { isBot: true, liveStream: { sellerId: seller.id } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, message: true, createdAt: true, liveStream: { select: { title: true } } },
    });
    return NextResponse.json({
      logs: logs.map(l => ({ id: l.id, message: l.message, createdAt: l.createdAt, liveTitle: l.liveStream.title })),
    });
  }

  try {
    const config = await prisma.chatBotConfig.findUnique({ where: { sellerId: seller.id } });
    return NextResponse.json({ config: serializeConfig(config) });
  } catch (e) {
    // youtubeApiKey 컬럼 미반영 DB / 재생성 전 Prisma Client 등 어떤 오류든
    // 기존 필드만 명시 select 하는 폴백을 시도하고, 그마저 실패할 때만 500
    try {
      const config = await prisma.chatBotConfig.findUnique({
        where: { sellerId: seller.id },
        select: LEGACY_CONFIG_SELECT,
      });
      return NextResponse.json({ config: serializeConfig(config), warning: DB_MIGRATION_WARNING });
    } catch (e2) {
      console.error("[seller/chatbot] 설정 조회 실패", e, e2);
      return NextResponse.json({ error: "설정 조회 중 오류가 발생했습니다." }, { status: 500 });
    }
  }
}

// PUT: 봇 설정 저장 (upsert)
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "SELLER") {
    return NextResponse.json({ error: "라이브 셀러만 접근 가능" }, { status: 403 });
  }
  const seller = await getSeller(session.user!.id);
  if (!seller) return NextResponse.json({ error: "라이브 셀러 프로필 없음" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  // 키워드/FAQ/금지어 정제 (빈 값 제거, 개수 제한)
  const keywords: KeywordRule[] = Array.isArray(body.keywords)
    ? body.keywords
        .map((k: any) => ({ keyword: String(k?.keyword ?? "").trim(), response: String(k?.response ?? "").trim() }))
        .filter((k: KeywordRule) => k.keyword && k.response)
        .slice(0, 50)
    : [];
  const bannedWords: string[] = Array.isArray(body.bannedWords)
    ? body.bannedWords.map((w: any) => String(w ?? "").trim()).filter(Boolean).slice(0, 100)
    : [];
  const faqs: FaqRule[] = Array.isArray(body.faqs)
    ? body.faqs
        .map((f: any) => ({ question: String(f?.question ?? "").trim(), answer: String(f?.answer ?? "").trim() }))
        .filter((f: FaqRule) => f.question && f.answer)
        .slice(0, 50)
    : [];

  const data = {
    enabled: Boolean(body.enabled),
    greetingEnabled: Boolean(body.greetingEnabled),
    greetingMessage: String(body.greetingMessage ?? "").trim() || null,
    keywordEnabled: Boolean(body.keywordEnabled),
    keywords: JSON.stringify(keywords),
    productInfoEnabled: Boolean(body.productInfoEnabled),
    spamFilterEnabled: Boolean(body.spamFilterEnabled),
    bannedWords: JSON.stringify(bannedWords),
    faqEnabled: Boolean(body.faqEnabled),
    faqs: JSON.stringify(faqs),
    purchaseNudgeEnabled: Boolean(body.purchaseNudgeEnabled),
    purchaseNudgeMessage: String(body.purchaseNudgeMessage ?? "").trim() || null,
    purchaseNudgeInterval: clampInterval(body.purchaseNudgeInterval, 5),
    statsEnabled: Boolean(body.statsEnabled),
    statsInterval: clampInterval(body.statsInterval, 10),
    couponEnabled: Boolean(body.couponEnabled),
    couponInterval: clampInterval(body.couponInterval, 10),
    // YouTube 전송은 OAuth 연결된 셀러만 ON 가능
    youtubeSendEnabled: Boolean(body.youtubeSendEnabled) && Boolean(seller.youtubeAccessToken && seller.youtubeRefreshToken),
    // 셀러 개인 YouTube Data API v3 키 (라이브 YouTube 채팅 읽기용)
    youtubeApiKey: String(body.youtubeApiKey ?? "").trim().slice(0, 200) || null,
  };

  try {
    const saved = await prisma.chatBotConfig.upsert({
      where: { sellerId: seller.id },
      create: { sellerId: seller.id, ...data },
      update: data,
    });
    return NextResponse.json({ config: serializeConfig(saved) });
  } catch (e) {
    // youtubeApiKey 컬럼 미반영 DB / 재생성 전 Prisma Client 등 어떤 오류든
    // API 키를 제외한 레거시 필드 저장을 시도하고, 그마저 실패할 때만 500
    try {
      const { youtubeApiKey: _omit, ...legacyData } = data;
      const saved = await prisma.chatBotConfig.upsert({
        where: { sellerId: seller.id },
        create: { sellerId: seller.id, ...legacyData },
        update: legacyData,
        select: LEGACY_CONFIG_SELECT,
      });
      return NextResponse.json({
        config: serializeConfig(saved),
        warning: `YouTube API 키를 제외한 설정만 저장되었습니다. ${DB_MIGRATION_WARNING}`,
      });
    } catch (e2) {
      console.error("[seller/chatbot] 설정 저장 실패", e, e2);
      return NextResponse.json({ error: "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
    }
  }
}
