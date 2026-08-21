import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/utils";
import { getSellerVisibleTypes } from "@/lib/gameSettings";
import SellerGamesClient from "@/components/shared/SellerGamesClient";

export const dynamic = "force-dynamic";

function safeParse(raw: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

export default async function SellerGamesPage() {
  const session = await auth();
  if (session?.user?.role !== "SELLER") redirect("/");

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session!.user!.id },
  });
  if (!seller) redirect("/");

  const games = await prisma.game.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
  });

  // 최고관리자가 "셀러 노출"을 켠 게임 타입만 생성 가능
  const visibleTypes = await getSellerVisibleTypes();

  const serialized = games.map((g) => ({
    id: g.id,
    type: g.type,
    title: g.title,
    items: parseJsonArray(g.items),
    config: g.config ? safeParse(g.config) : null,
    status: g.status,
    createdAt: g.createdAt.toISOString(),
  }));

  return (
    <div className="animate-fade-in">
      <SellerGamesClient games={serialized} visibleTypes={visibleTypes} />
    </div>
  );
}
