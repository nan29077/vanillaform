import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";
import SellerGameDetailClient from "@/components/shared/SellerGameDetailClient";

export const dynamic = "force-dynamic";

export default async function SellerGameDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const session = await auth();
  if (session?.user?.role !== "SELLER") redirect("/");

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session!.user!.id },
  });
  if (!seller) redirect("/");

  const { id } = await Promise.resolve(params);
  const game = await prisma.game.findUnique({ where: { id } });
  if (!game || game.sellerId !== seller.id) notFound();

  const participantCount = await prisma.gameParticipant.count({ where: { gameId: id } });

  let config: Record<string, unknown> | null = null;
  if (game.config) {
    try {
      const v = JSON.parse(game.config);
      config = v && typeof v === "object" ? v : null;
    } catch {
      config = null;
    }
  }

  let result: Record<string, unknown> | null = null;
  if (game.result) {
    try {
      const v = JSON.parse(game.result);
      result = v && typeof v === "object" ? v : null;
    } catch {
      result = null;
    }
  }

  const serialized = {
    id: game.id,
    type: game.type,
    title: game.title,
    items: parseJsonArray(game.items),
    config,
    result,
    status: game.status,
    participantCount,
    createdAt: game.createdAt.toISOString(),
  };

  return (
    <div className="animate-fade-in">
      <SellerGameDetailClient game={serialized} />
    </div>
  );
}
