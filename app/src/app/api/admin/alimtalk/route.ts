import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LOGS_PAGE_SIZE = 20;

// 셀러 없는(시스템) 발송을 가리키는 sellerId 파라미터 값
const SYSTEM_SELLER_KEY = "system";

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// 알리고 실발송 기록(aligo_send_logs) 기준 셀러별 사용량 집계.
// 발신 계정은 플랫폼 공용이므로 sellerId가 null인 기록은 "시스템 발송"(비밀번호 문자 등)이다.
//
// 쿼리 파라미터
// - from / to : ISO 일시. 클라이언트가 사용자 로컬(KST) 기준 하루의 시작·끝을 계산해 보낸다.
// - sellerId  : 발송 내역을 특정 셀러로 좁힘. "system"이면 sellerId가 null인 기록.
// - page      : 발송 내역 페이지 (1부터)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "SUPER_ADMIN" && role !== "MIDDLE_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const from = parseDate(sp.get("from"));
  const to = parseDate(sp.get("to"));
  const sellerParam = sp.get("sellerId");
  const page = Math.max(1, Number(sp.get("page")) || 1);

  // 기간 조건 — 셀러별 집계/합계는 셀러 필터와 무관하게 항상 기간 전체를 보여준다
  const rangeWhere: any = {};
  if (from || to) {
    rangeWhere.createdAt = {};
    if (from) rangeWhere.createdAt.gte = from;
    if (to) rangeWhere.createdAt.lte = to;
  }

  // 발송 내역 조건 — 기간 + 선택된 셀러
  const logWhere: any = { ...rangeWhere };
  if (sellerParam === SYSTEM_SELLER_KEY) logWhere.sellerId = null;
  else if (sellerParam) logWhere.sellerId = sellerParam;

  const [grouped, logs, logCount, kindTotals, purposeGrouped] = await Promise.all([
    prisma.aligoSendLog.groupBy({
      by: ["sellerId", "kind"],
      where: rangeWhere,
      _sum: { recipientCount: true, acceptedCount: true, failCount: true, cost: true },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.aligoSendLog.findMany({
      where: logWhere,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * LOGS_PAGE_SIZE,
      take: LOGS_PAGE_SIZE,
      include: { seller: { select: { shopName: true, user: { select: { name: true } } } } },
    }),
    prisma.aligoSendLog.count({ where: logWhere }),
    prisma.aligoSendLog.aggregate({
      where: rangeWhere,
      _sum: { recipientCount: true, acceptedCount: true, failCount: true, cost: true },
    }),
    // 셀러를 선택했을 때만 발송 사유별 내역을 함께 내려준다
    sellerParam
      ? prisma.aligoSendLog.groupBy({
          by: ["purpose", "kind"],
          where: logWhere,
          _sum: { recipientCount: true, acceptedCount: true, failCount: true, cost: true },
          _count: { _all: true },
          _max: { createdAt: true },
        })
      : Promise.resolve([] as any[]),
  ]);

  // 셀러 정보 일괄 조회
  const sellerIds = Array.from(new Set(grouped.map((g) => g.sellerId).filter(Boolean))) as string[];
  const sellerProfiles = sellerIds.length
    ? await prisma.sellerProfile.findMany({
        where: { id: { in: sellerIds } },
        select: { id: true, shopName: true, user: { select: { name: true } } },
      })
    : [];
  const sellerMap = new Map(sellerProfiles.map((s) => [s.id, s]));

  // sellerId 기준으로 kind별 집계를 한 행으로 합침
  const rowMap = new Map<string | null, {
    sellerId: string | null;
    sellerKey: string;
    sellerName: string | null;
    shopName: string;
    alimtalkCount: number;
    smsCount: number;
    acceptedCount: number;
    failCount: number;
    sendCount: number;
    cost: number;
    lastSentAt: Date | null;
  }>();
  for (const g of grouped) {
    const key = g.sellerId ?? null;
    const profile = key ? sellerMap.get(key) : null;
    const row = rowMap.get(key) ?? {
      sellerId: key,
      sellerKey: key ?? SYSTEM_SELLER_KEY,
      sellerName: profile?.user.name ?? null,
      shopName: profile?.shopName ?? "시스템 발송",
      alimtalkCount: 0,
      smsCount: 0,
      acceptedCount: 0,
      failCount: 0,
      sendCount: 0,
      cost: 0,
      lastSentAt: null,
    };
    const recipients = g._sum.recipientCount ?? 0;
    if (g.kind === "ALIMTALK") row.alimtalkCount += recipients;
    else row.smsCount += recipients;
    row.acceptedCount += g._sum.acceptedCount ?? 0;
    row.failCount += g._sum.failCount ?? 0;
    row.sendCount += g._count._all;
    row.cost += Number(g._sum.cost ?? 0);
    if (g._max.createdAt && (!row.lastSentAt || g._max.createdAt > row.lastSentAt)) {
      row.lastSentAt = g._max.createdAt;
    }
    rowMap.set(key, row);
  }
  const sellers = Array.from(rowMap.values()).sort(
    (a, b) => (b.lastSentAt?.getTime() ?? 0) - (a.lastSentAt?.getTime() ?? 0),
  );

  // 발송 사유별 집계 (셀러 선택 시)
  const purposeMap = new Map<string, {
    purpose: string;
    alimtalkCount: number;
    smsCount: number;
    acceptedCount: number;
    failCount: number;
    sendCount: number;
    cost: number;
    lastSentAt: Date | null;
  }>();
  for (const g of purposeGrouped) {
    const row = purposeMap.get(g.purpose) ?? {
      purpose: g.purpose,
      alimtalkCount: 0,
      smsCount: 0,
      acceptedCount: 0,
      failCount: 0,
      sendCount: 0,
      cost: 0,
      lastSentAt: null,
    };
    const recipients = g._sum.recipientCount ?? 0;
    if (g.kind === "ALIMTALK") row.alimtalkCount += recipients;
    else row.smsCount += recipients;
    row.acceptedCount += g._sum.acceptedCount ?? 0;
    row.failCount += g._sum.failCount ?? 0;
    row.sendCount += g._count._all;
    row.cost += Number(g._sum.cost ?? 0);
    if (g._max.createdAt && (!row.lastSentAt || g._max.createdAt > row.lastSentAt)) {
      row.lastSentAt = g._max.createdAt;
    }
    purposeMap.set(g.purpose, row);
  }
  const purposeBreakdown = Array.from(purposeMap.values()).sort(
    (a, b) => (b.lastSentAt?.getTime() ?? 0) - (a.lastSentAt?.getTime() ?? 0),
  );

  return NextResponse.json({
    sellers,
    totals: {
      recipientCount: kindTotals._sum.recipientCount ?? 0,
      acceptedCount: kindTotals._sum.acceptedCount ?? 0,
      failCount: kindTotals._sum.failCount ?? 0,
      cost: Number(kindTotals._sum.cost ?? 0),
    },
    purposeBreakdown,
    logs: logs.map((l) => ({
      id: l.id,
      sellerId: l.sellerId,
      sellerName: l.seller?.user.name ?? null,
      shopName: l.seller?.shopName ?? "시스템 발송",
      kind: l.kind,
      purpose: l.purpose,
      templateCode: l.templateCode,
      recipientCount: l.recipientCount,
      acceptedCount: l.acceptedCount,
      failCount: l.failCount,
      cost: l.cost ? Number(l.cost) : null,
      errorMessage: l.errorMessage,
      createdAt: l.createdAt,
    })),
    pagination: {
      page,
      pageSize: LOGS_PAGE_SIZE,
      total: logCount,
      totalPages: Math.max(1, Math.ceil(logCount / LOGS_PAGE_SIZE)),
    },
  });
}
