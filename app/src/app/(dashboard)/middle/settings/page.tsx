import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import MiddleSettingsClient from "@/components/middle/MiddleSettingsClient";

export const dynamic = "force-dynamic";

export default async function MiddleSettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "MIDDLE_ADMIN") redirect("/");

  return <MiddleSettingsClient />;
}
