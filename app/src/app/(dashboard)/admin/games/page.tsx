import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { readGameSettings } from "@/lib/gameSettings";
import { GAME_TYPES, GAME_TYPE_META } from "@/lib/gameTypes";
import AdminGamesClient, { type GameTypeRow } from "@/components/admin/AdminGamesClient";

export const dynamic = "force-dynamic";

export default async function AdminGamesPage() {
  const session = await auth();
  if ((session?.user as any)?.role !== "SUPER_ADMIN") redirect("/");

  const settings = await readGameSettings();

  const rows: GameTypeRow[] = GAME_TYPES.map((t) => ({
    type: t,
    label: GAME_TYPE_META[t].label,
    desc: GAME_TYPE_META[t].desc,
    sellerVisible: settings.gameTypes[t]?.sellerVisible !== false,
    overlayStyle: settings.gameTypes[t]?.overlayStyle === "card" ? "card" : "classic",
  }));

  return (
    <div className="animate-fade-in">
      <AdminGamesClient rows={rows} />
    </div>
  );
}
