import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { usesParticipants } from "@/lib/gameTypes";

export const dynamic = "force-dynamic";

// GET: 해당 라이브 셀러의 현재 RUNNING 참여형 게임 1개 반환 (시청자 참여 버튼용, 인증 불필요)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> | { code: string } },
) {
  try {
    const { code } = await Promise.resolve(params);

    const live = await prisma.liveStream.findUnique({
      where: { shareCode: code },
      select: { sellerId: true },
    });
    if (!live) return NextResponse.json({ game: null });

    const games = await prisma.game.findMany({
      where: { sellerId: live.sellerId, status: "RUNNING" },
      select: { id: true, type: true, title: true },
    });

    const activeGame = games.find((g) => usesParticipants(g.type)) ?? null;
    return NextResponse.json({ game: activeGame });
  } catch {
    return NextResponse.json({ game: null });
  }
}
