import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import SettingsClient from "@/components/seller/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SellerSettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") redirect("/");

  return <SettingsClient />;
}
