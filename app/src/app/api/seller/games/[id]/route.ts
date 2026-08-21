import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";
import { usesItems, usesParticipants } from "@/lib/gameTypes";

function stripEmoji(str: string): string {
  return str
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E0}-\u{1F1FF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const dynamic = "force-dynamic";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateLadderRungs(n: number) {
  const rows = Math.max(8, n * 3);
  const rungs: { row: number; col: number }[] = [];
  for (let row = 0; row < rows; row++) {
    const indices = Array.from({ length: n - 1 }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const used = new Set<number>();
    for (const col of indices) {
      if (!used.has(col) && !used.has(col - 1) && !used.has(col + 1)) {
        if (Math.random() < 0.5) { rungs.push({ row, col }); used.add(col); }
      }
    }
  }
  return { rungs, rows };
}

function computeLadderResult(items: string[]) {
  const n = items.length;
  const { rungs, rows } = generateLadderRungs(n);
  const order = items.map((_, startCol) => {
    let col = startCol;
    for (let row = 0; row < rows; row++) {
      const goRight = rungs.some(r => r.row === row && r.col === col);
      const goLeft  = rungs.some(r => r.row === row && r.col === col - 1);
      if (goRight) col = Math.min(col + 1, n - 1);
      else if (goLeft) col = Math.max(col - 1, 0);
    }
    return items[col];
  });
  return { rungs, rows, order };
}

function computeResult(type: string, items: string[], selectedIndex?: number, config?: Record<string, unknown>) {
  if (type === "LADDER") {
    const res = computeLadderResult(items);
    return selectedIndex !== undefined ? { ...res, activeIndex: selectedIndex } : res;
  }
  if (type === "SEQUENTIAL") {
    // 연속 룰렛: 항목을 섞어 1등~N등 순위 추첨
    const rankCount = Math.max(1, Math.min(Number(config?.rankCount) || items.length, items.length));
    const rewards = Array.isArray(config?.rewards) ? (config!.rewards as unknown[]).map(String) : [];
    const shuffled = shuffle(items);
    const ranks = shuffled.slice(0, rankCount).map((name, i) => ({
      rank: i + 1,
      name,
      reward: rewards[i] || "",
    }));
    return { ranks, winners: ranks.map((r) => r.name) };
  }
  // ROULETTE / DRAW: 무작위 당첨 1개
  const index = Math.floor(Math.random() * items.length);
  return { winner: items[index], index };
}

async function getOwnedGame(gameId: string, userId: string) {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId } });
  if (!seller) return { error: "라이브 셀러 프로필 없음", status: 400 as const };
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game || game.sellerId !== seller.id) {
    return { error: "이 게임에 대한 권한이 없습니다", status: 403 as const };
  }
  return { game };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    if (session.user.role !== "SELLER") {
      return NextResponse.json({ error: "라이브 셀러 전용" }, { status: 403 });
    }
    const { id } = await Promise.resolve(params);
    const owned = await getOwnedGame(id, session.user!.id);
    if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });
    const game = owned.game;
    const body = await req.json().catch(() => ({}));
    const action: string = body.action;

    if (action === "start") {
      // 항목 기반 게임: 시작과 동시에 결과 계산 후 RUNNING
      if (usesItems(game.type)) {
        const items = parseJsonArray(game.items);
        if (items.length < 2) return NextResponse.json({ error: "항목이 부족합니다" }, { status: 400 });
        const selectedIndex = typeof body.selectedIndex === "number" ? body.selectedIndex : undefined;
        let config: Record<string, unknown> | undefined;
        try {
          config = game.config ? JSON.parse(game.config) : undefined;
        } catch {
          config = undefined;
        }
        const result = computeResult(game.type, items, selectedIndex, config);
        const updated = await prisma.game.update({
          where: { id },
          data: { status: "RUNNING", result: JSON.stringify(result) },
        });
        return NextResponse.json({ success: true, game: updated });
      }
      // 참여형(시청자 QR 참여): 새 회차를 위해 이전 참여자 초기화 후 참여 오픈
      if (usesParticipants(game.type)) {
        await prisma.gameParticipant.deleteMany({ where: { gameId: id } });
      }
      // 참여형/주문형/뽑기형: 결과 없이 참여 오픈(RUNNING)만
      const updated = await prisma.game.update({
        where: { id },
        data: { status: "RUNNING", result: null },
      });
      return NextResponse.json({ success: true, game: updated });
    }

    if (action === "finish") {
      const updated = await prisma.game.update({ where: { id }, data: { status: "FINISHED" } });
      return NextResponse.json({ success: true, game: updated });
    }

    if (action === "reset" || action === "stop") {
      // 참여형 게임은 리셋 시 참여자도 초기화하여 새 회차 준비
      if (usesParticipants(game.type)) {
        await prisma.gameParticipant.deleteMany({ where: { gameId: id } });
      }
      const updated = await prisma.game.update({ where: { id }, data: { status: "IDLE", result: null } });
      return NextResponse.json({ success: true, game: updated });
    }

    if (action === "update") {
      if (game.status === "RUNNING") {
        return NextResponse.json({ error: "진행 중에는 수정할 수 없습니다" }, { status: 400 });
      }
      const data: Record<string, unknown> = {};
      if (typeof body.title === "string" && body.title.trim()) data.title = stripEmoji(body.title);
      if (Array.isArray(body.items)) {
        const cleanItems = body.items.map((i: unknown) => String(i).trim()).filter(Boolean);
        if (usesItems(game.type) && cleanItems.length < 2) {
          return NextResponse.json({ error: "항목을 2개 이상 입력해주세요" }, { status: 400 });
        }
        data.items = JSON.stringify(cleanItems);
        data.result = null;
        data.status = "IDLE";
      }
      if (body.config != null) {
        data.config = JSON.stringify(body.config);
      }
      const updated = await prisma.game.update({ where: { id }, data });
      return NextResponse.json({ success: true, game: updated });
    }

    return NextResponse.json({ error: "알 수 없는 요청" }, { status: 400 });
  } catch (error) {
    console.error("Seller game update error:", error);
    return NextResponse.json({ error: "변경 실패" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    if (session.user.role !== "SELLER") {
      return NextResponse.json({ error: "라이브 셀러 전용" }, { status: 403 });
    }
    const { id } = await Promise.resolve(params);
    const owned = await getOwnedGame(id, session.user!.id);
    if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });
    await prisma.game.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Seller game delete error:", error);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}
