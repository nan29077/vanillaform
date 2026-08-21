import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { usesParticipants } from "@/lib/gameTypes";

export const dynamic = "force-dynamic";

function parseConfig(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

// BOX_OPEN: 확률(prob) 가중치에 따라 박스 하나를 뽑는다
function pickBox(cfg: Record<string, unknown>) {
  const boxes = Array.isArray(cfg.boxes) ? (cfg.boxes as Record<string, unknown>[]) : [];
  if (boxes.length === 0) return { label: "결과 없음", kind: "MISS", boxIndex: -1 };
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
  } else {
    pickIdx = Math.floor(Math.random() * boxes.length);
  }
  const box = boxes[pickIdx] || { label: "결과 없음", kind: "MISS" };
  return { label: String(box.label ?? ""), kind: String(box.kind ?? "MISS"), boxIndex: pickIdx };
}

// POST: 게임 참여 등록 (비회원도 name 으로 참여 가능, 로그인 시 userId 연결)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const { id } = await Promise.resolve(params);
    const game = await prisma.game.findUnique({
      where: { id },
      select: { id: true, type: true, status: true, config: true },
    });
    if (!game) return NextResponse.json({ error: "게임을 찾을 수 없습니다" }, { status: 404 });

    // 시청자 참여형 게임만 참여 가능
    if (!usesParticipants(game.type)) {
      return NextResponse.json({ error: "시청자 참여가 없는 게임입니다" }, { status: 400 });
    }
    // 셀러가 '참여 열기'(RUNNING)한 동안에만 참여 가능
    if (game.status !== "RUNNING") {
      return NextResponse.json({ error: "현재 참여 가능한 게임이 아닙니다" }, { status: 400 });
    }

    const cfg = parseConfig(game.config);
    const body = await req.json().catch(() => ({}));
    const rawName = typeof body.name === "string" ? body.name.trim() : "";
    const rawEntry = body.entry != null ? String(body.entry).trim() : "";

    // 로그인 세션이 있으면 userId 연결
    const session = await auth().catch(() => null);
    const userId = session?.user?.id ?? null;

    // VOTE 는 익명 허용, 그 외는 이름 필수
    const isVote = game.type === "VOTE";
    if (!isVote && !rawName && !session?.user?.name) {
      return NextResponse.json({ error: "이름(닉네임)을 입력해주세요" }, { status: 400 });
    }
    const name = (rawName || session?.user?.name || "익명").slice(0, 40);

    // ── 타입별 입력 검증 & 저장값 결정 ──
    let entry: string | null = null;
    let result: string | undefined; // 응답에 포함할 즉시 결과 (BOX_OPEN)
    let correct: boolean | undefined; // 정답 여부 (KEYWORD/QUIZ 힌트)

    switch (game.type) {
      case "SEQUENTIAL": {
        // 이름만 저장
        entry = null;
        break;
      }
      case "KEYWORD": {
        if (!rawEntry) return NextResponse.json({ error: "키워드를 입력해주세요" }, { status: 400 });
        entry = rawEntry.slice(0, 100);
        const answer = String(cfg.keyword ?? "").trim().toLowerCase();
        correct = answer !== "" && entry.toLowerCase() === answer;
        break;
      }
      case "NUMBER_GUESS": {
        const num = Number(rawEntry);
        if (rawEntry === "" || !Number.isFinite(num)) {
          return NextResponse.json({ error: "숫자를 입력해주세요" }, { status: 400 });
        }
        const min = Number.isFinite(Number(cfg.min)) ? Number(cfg.min) : -Infinity;
        const max = Number.isFinite(Number(cfg.max)) ? Number(cfg.max) : Infinity;
        if (num < min || num > max) {
          return NextResponse.json(
            { error: `${cfg.min ?? ""} ~ ${cfg.max ?? ""} 범위의 숫자를 입력해주세요` },
            { status: 400 },
          );
        }
        entry = String(num);
        break;
      }
      case "QUIZ":
      case "VOTE": {
        const choices = Array.isArray(cfg.choices) ? (cfg.choices as unknown[]) : [];
        const idx = Number(rawEntry);
        if (!Number.isInteger(idx) || idx < 0 || idx >= choices.length) {
          return NextResponse.json({ error: "선택지를 골라주세요" }, { status: 400 });
        }
        entry = String(idx);
        if (game.type === "QUIZ") {
          correct = idx === Number(cfg.answerIndex);
        }
        break;
      }
      case "BOX_OPEN": {
        // 참여 즉시 확률에 따라 박스 오픈 → 결과 반환 & 저장
        const box = pickBox(cfg);
        entry = JSON.stringify(box);
        result = box.label;
        break;
      }
      default:
        entry = rawEntry ? rawEntry.slice(0, 100) : null;
    }

    // ── 중복 참여 방지: userId 있으면 userId, 없으면 name 기준 ──
    // (VOTE 익명·이름 미입력은 브라우저 localStorage 로만 방지)
    let existing = null as null | { id: string };
    if (userId) {
      existing = await prisma.gameParticipant.findFirst({
        where: { gameId: id, userId },
        select: { id: true },
      });
    } else if (rawName) {
      existing = await prisma.gameParticipant.findFirst({
        where: { gameId: id, userId: null, name },
        select: { id: true },
      });
    }

    if (existing) {
      // BOX_OPEN 은 재오픈 불가 (이미 뽑음)
      if (game.type === "BOX_OPEN") {
        return NextResponse.json({ error: "이미 박스를 열었습니다" }, { status: 400 });
      }
      // 그 외는 입력값 갱신 허용 (재참여)
      await prisma.gameParticipant.update({
        where: { id: existing.id },
        data: { name, entry },
      });
      const count = await prisma.gameParticipant.count({ where: { gameId: id } });
      return NextResponse.json({ success: true, updated: true, count, result, correct });
    }

    await prisma.gameParticipant.create({
      data: { gameId: id, userId, name, entry },
    });
    const count = await prisma.gameParticipant.count({ where: { gameId: id } });
    return NextResponse.json({ success: true, count, result, correct }, { status: 201 });
  } catch (error) {
    console.error("Game participate error:", error);
    return NextResponse.json({ error: "참여에 실패했습니다" }, { status: 500 });
  }
}

// GET: 참여자 목록 (게임 오너 셀러만)
export async function GET(
  _req: NextRequest,
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

    const game = await prisma.game.findUnique({ where: { id }, select: { sellerId: true } });
    if (!game || game.sellerId !== seller.id) {
      return NextResponse.json({ error: "이 게임에 대한 권한이 없습니다" }, { status: 403 });
    }

    const participants = await prisma.gameParticipant.findMany({
      where: { gameId: id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, entry: true, userId: true, createdAt: true },
    });

    return NextResponse.json({
      participants: participants.map((p) => ({
        id: p.id,
        name: p.name,
        entry: p.entry,
        isMember: !!p.userId,
        createdAt: p.createdAt.toISOString(),
      })),
      count: participants.length,
    });
  } catch (error) {
    console.error("Game participants list error:", error);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
