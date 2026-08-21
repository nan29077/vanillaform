import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOverlayStyle } from "@/lib/gameSettings";
import GameOverlayClient from "@/components/shared/GameOverlayClient";

export const dynamic = "force-dynamic";

// OBS/프리즘 브라우저 소스용 게임 오버레이 (투명 배경, 독립 렌더링)
export default async function GameOverlayPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const { id } = await Promise.resolve(params);
  const game = await prisma.game.findUnique({ where: { id }, select: { id: true, type: true } });
  if (!game) notFound();

  // 최고관리자가 설정한 게임 타입별 오버레이 스타일 (기본 classic)
  const overlayStyle = await getOverlayStyle(game.type);

  return <GameOverlayClient gameId={id} overlayStyle={overlayStyle} />;
}
