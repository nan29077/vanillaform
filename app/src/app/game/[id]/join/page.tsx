import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import GameJoinClient from "@/components/shared/GameJoinClient";

export const dynamic = "force-dynamic";

// QR/모바일 참여 페이지 — 시청자가 게임에 참여
export default async function GameJoinPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const { id } = await Promise.resolve(params);
  const game = await prisma.game.findUnique({
    where: { id },
    select: { id: true, type: true, title: true, status: true, config: true, updatedAt: true },
  });
  if (!game) notFound();

  let config: Record<string, unknown> | null = null;
  if (game.config) {
    try {
      const v = JSON.parse(game.config);
      config = v && typeof v === "object" ? v : null;
    } catch {
      config = null;
    }
  }

  const session = await auth().catch(() => null);

  return (
    <GameJoinClient
      game={{ id: game.id, type: game.type, title: game.title, status: game.status, updatedAt: game.updatedAt.toISOString(), config }}
      defaultName={session?.user?.name ?? ""}
      isMember={!!session?.user?.id}
    />
  );
}
