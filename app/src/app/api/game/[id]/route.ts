import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";
import { usesParticipants } from "@/lib/gameTypes";

export const dynamic = "force-dynamic";

// GET: 공개 게임 상태 (OBS 오버레이 폴링용, 인증 불필요)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const { id } = await Promise.resolve(params);
    const game = await prisma.game.findUnique({
      where: { id },
      select: {
        id: true,
        sellerId: true,
        type: true,
        title: true,
        items: true,
        config: true,
        status: true,
        result: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!game) return NextResponse.json({ error: "게임을 찾을 수 없습니다" }, { status: 404 });

    let result: unknown = null;
    if (game.result) {
      try {
        result = JSON.parse(game.result);
      } catch {
        result = null;
      }
    }

    let config: Record<string, unknown> | null = null;
    if (game.config) {
      try {
        config = JSON.parse(game.config);
      } catch {
        config = null;
      }
    }

    // 참여형 게임: 참여자 수 + 선택지/정답 집계 실시간 산출
    let participantCount = 0;
    let voteCounts: number[] | undefined; // VOTE 선택지별 표수
    let quizCounts: number[] | undefined; // QUIZ 선택지별 응답수 (정답 비공개)
    let keywordCorrect: number | undefined; // KEYWORD 정답 입력자 수
    if (usesParticipants(game.type)) {
      const participants = await prisma.gameParticipant.findMany({
        where: { gameId: id },
        select: { entry: true },
      });
      participantCount = participants.length;
      const choices = Array.isArray(config?.choices) ? (config!.choices as unknown[]) : [];
      if (game.type === "VOTE" || game.type === "QUIZ") {
        const counts = choices.map(() => 0);
        participants.forEach((p) => {
          const idx = Number((p.entry ?? "").trim());
          if (Number.isInteger(idx) && idx >= 0 && idx < counts.length) counts[idx]++;
        });
        if (game.type === "VOTE") voteCounts = counts;
        else quizCounts = counts;
      }
      if (game.type === "KEYWORD") {
        const answer = String(config?.keyword ?? "").trim().toLowerCase();
        keywordCorrect =
          answer === ""
            ? 0
            : participants.filter((p) => (p.entry ?? "").trim().toLowerCase() === answer).length;
      }
    }

    // 공동 목표 게이지: 게임 생성 이후 셀러의 결제 완료 주문 수를 실시간 집계
    let goalCurrent: number | undefined;
    if (game.type === "GOAL_GAUGE") {
      goalCurrent = await prisma.order.count({
        where: {
          sellerId: game.sellerId,
          paymentStatus: "COMPLETED",
          createdAt: { gte: game.createdAt },
        },
      });
    }

    return NextResponse.json({
      id: game.id,
      type: game.type,
      title: game.title,
      items: parseJsonArray(game.items),
      config,
      status: game.status,
      result,
      participantCount,
      voteCounts,
      quizCounts,
      keywordCorrect,
      goalCurrent,
      updatedAt: game.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Public game state error:", error);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
