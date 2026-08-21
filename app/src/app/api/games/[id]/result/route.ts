import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Participant {
  name: string;
  entry: string | null;
  createdAt: Date;
}

function parseConfig(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomCode(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// 당첨자(로그인 참여자)에게 게임 쿠폰 자동 발급.
// result.winners 의 이름과 참여자(userId 보유)를 대조해 승자를 식별한다.
// 실패해도 결과 처리를 막지 않도록 호출부에서 try/catch 로 감싼다.
async function issueGameCoupons(
  gameId: string,
  sellerId: string,
  result: Record<string, unknown>,
) {
  const winnerNames: string[] = Array.isArray(result.winners) ? (result.winners as unknown[]).map(String) : [];
  if (winnerNames.length === 0) return;

  const coupons = await prisma.gameCoupon.findMany({ where: { gameId } });
  if (coupons.length === 0) return;

  const members = await prisma.gameParticipant.findMany({
    where: { gameId, userId: { not: null } },
    select: { userId: true, name: true },
  });
  if (members.length === 0) return;

  // 승자 이름 매칭 (NUMBER_GUESS 는 "이름 (숫자)" 형태 → 접두 매칭 허용)
  const isWinner = (name: string) =>
    winnerNames.some((w) => w === name || w.startsWith(`${name} (`));
  const winnerUserIds = Array.from(
    new Set(members.filter((m) => isWinner(m.name)).map((m) => m.userId as string)),
  );
  if (winnerUserIds.length === 0) return;

  const now = new Date();
  for (const coupon of coupons) {
    let issued = await prisma.userGameCoupon.count({ where: { gameCouponId: coupon.id } });
    const expiresAt = new Date(now.getTime() + coupon.validDays * 24 * 60 * 60 * 1000);
    for (const userId of winnerUserIds) {
      if (coupon.maxIssueCount != null && issued >= coupon.maxIssueCount) break;
      // 1인 1회 (unique userId+gameCouponId)
      const exists = await prisma.userGameCoupon.findUnique({
        where: { userId_gameCouponId: { userId, gameCouponId: coupon.id } },
      });
      if (exists) continue;
      const base = coupon.code ? coupon.code : "GAME";
      const code = `${base}-${userId.slice(0, 6)}${coupon.id.slice(0, 3)}`.toUpperCase().slice(0, 40);
      try {
        await prisma.userGameCoupon.create({
          data: { userId, gameCouponId: coupon.id, gameId, sellerId, code, expiresAt },
        });
        issued++;
      } catch {
        // 코드 충돌 등 → 랜덤 코드로 1회 재시도
        try {
          await prisma.userGameCoupon.create({
            data: { userId, gameCouponId: coupon.id, gameId, sellerId, code: `GAME-${randomCode()}`, expiresAt },
          });
          issued++;
        } catch {
          /* skip */
        }
      }
    }
  }
}

// SEQUENTIAL: 참여자 풀에서 1등~N등 순위 추첨. 참여자가 없으면 items(셀러 입력) 폴백.
function computeSequential(
  cfg: Record<string, unknown>,
  participants: Participant[],
  items: string[],
) {
  const pool = participants.length > 0 ? participants.map((p) => p.name) : items;
  const rewards = Array.isArray(cfg.rewards) ? (cfg.rewards as unknown[]).map(String) : [];
  const rankCount = Math.max(1, Math.min(Number(cfg.rankCount) || pool.length, pool.length));
  const ranks = shuffle(pool)
    .slice(0, rankCount)
    .map((name, i) => ({ rank: i + 1, name, reward: rewards[i] || "" }));
  return { ranks, winners: ranks.map((r) => r.name) };
}

function computeWinners(type: string, cfg: Record<string, unknown>, participants: Participant[]) {
  switch (type) {
    case "KEYWORD": {
      const keyword = String(cfg.keyword ?? "").trim().toLowerCase();
      const winnerCount = Math.max(1, Number(cfg.winnerCount) || 1);
      const matched = participants
        .filter((p) => (p.entry ?? "").trim().toLowerCase() === keyword && keyword !== "")
        .slice(0, winnerCount);
      return { winners: matched.map((p) => p.name), keyword: cfg.keyword ?? "" };
    }
    case "NUMBER_GUESS": {
      const answer = Number(cfg.answer) || 0;
      const mode = cfg.mode === "exact" ? "exact" : "closest";
      const winnerCount = Math.max(1, Number(cfg.winnerCount) || 1);
      const withNum = participants
        .map((p) => ({ p, num: Number((p.entry ?? "").trim()) }))
        .filter((x) => Number.isFinite(x.num));
      let picked: typeof withNum;
      if (mode === "exact") {
        picked = withNum.filter((x) => x.num === answer).slice(0, winnerCount);
      } else {
        picked = withNum
          .map((x) => ({ ...x, diff: Math.abs(x.num - answer) }))
          .sort((a, b) => a.diff - b.diff || a.p.createdAt.getTime() - b.p.createdAt.getTime())
          .slice(0, winnerCount);
      }
      return { winners: picked.map((x) => `${x.p.name} (${x.num})`), answer, mode };
    }
    case "QUIZ": {
      const answerIndex = Number(cfg.answerIndex) || 0;
      const correct = participants.filter((p) => Number((p.entry ?? "").trim()) === answerIndex);
      return {
        winners: correct.map((p) => p.name),
        correctCount: correct.length,
        answerIndex,
      };
    }
    case "VOTE": {
      const choices = Array.isArray(cfg.choices) ? (cfg.choices as unknown[]).map(String) : [];
      const counts = choices.map(() => 0);
      participants.forEach((p) => {
        const idx = Number((p.entry ?? "").trim());
        if (Number.isInteger(idx) && idx >= 0 && idx < counts.length) counts[idx]++;
      });
      let winnerIndex = 0;
      counts.forEach((c, i) => {
        if (c > counts[winnerIndex]) winnerIndex = i;
      });
      const total = counts.reduce((a, b) => a + b, 0);
      return {
        counts,
        choices,
        winnerIndex: total > 0 ? winnerIndex : -1,
        winnerLabel: total > 0 ? choices[winnerIndex] : "",
        total,
      };
    }
    case "BOX_OPEN": {
      const boxes = Array.isArray(cfg.boxes) ? (cfg.boxes as Record<string, unknown>[]) : [];
      const weights = boxes.map((b) => Math.max(0, Number(b.prob) || 0));
      const totalW = weights.reduce((a, b) => a + b, 0);
      let pickIdx = 0;
      if (totalW > 0) {
        let r = Math.random() * totalW;
        for (let i = 0; i < weights.length; i++) {
          r -= weights[i];
          if (r <= 0) {
            pickIdx = i;
            break;
          }
        }
      } else if (boxes.length > 0) {
        pickIdx = Math.floor(Math.random() * boxes.length);
      }
      const box = boxes[pickIdx] || { label: "결과 없음", kind: "MISS" };
      return { box: { label: String(box.label ?? ""), kind: String(box.kind ?? "MISS") }, boxIndex: pickIdx };
    }
    default:
      return { winners: [] };
  }
}

// POST: 게임 결과 처리 (셀러만) — 당첨자 결정 후 result 저장
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const { id } = await Promise.resolve(params);
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    if (session.user.role !== "SELLER") {
      return NextResponse.json({ error: "라이브 셀러 전용" }, { status: 403 });
    }
    const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user!.id } });
    if (!seller) return NextResponse.json({ error: "라이브 셀러 프로필 없음" }, { status: 400 });

    const game = await prisma.game.findUnique({ where: { id } });
    if (!game || game.sellerId !== seller.id) {
      return NextResponse.json({ error: "이 게임에 대한 권한이 없습니다" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const cfg = parseConfig(game.config);

    let result: Record<string, unknown>;
    if (Array.isArray(body.winners) && body.winners.length > 0) {
      // 셀러가 직접 당첨자 지정
      result = { winners: body.winners.map((w: unknown) => String(w)) };
    } else {
      const participants = await prisma.gameParticipant.findMany({
        where: { gameId: id },
        orderBy: { createdAt: "asc" },
        select: { name: true, entry: true, createdAt: true },
      });
      if (game.type === "SEQUENTIAL") {
        // 참여자 풀에서 순위 추첨 (참여자 없으면 items 폴백)
        const items = parseJsonArray(game.items);
        if (participants.length === 0 && items.length === 0) {
          return NextResponse.json({ error: "추첨할 참여자가 없습니다" }, { status: 400 });
        }
        result = computeSequential(cfg, participants, items);
      } else {
        result = computeWinners(game.type, cfg, participants);
      }
    }

    const updated = await prisma.game.update({
      where: { id },
      data: { status: "FINISHED", result: JSON.stringify(result) },
    });

    // 당첨자에게 게임 쿠폰 자동 발급 (실패해도 결과 처리는 유지)
    let couponsIssued = false;
    try {
      await issueGameCoupons(id, game.sellerId, result);
      couponsIssued = true;
    } catch (e) {
      console.error("Game coupon issue error:", e);
    }

    return NextResponse.json({
      success: true,
      result,
      couponsIssued,
      game: { id: updated.id, status: updated.status },
    });
  } catch (error) {
    console.error("Game result error:", error);
    return NextResponse.json({ error: "결과 처리에 실패했습니다" }, { status: 500 });
  }
}
