import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminDepositTransferClient from "@/components/admin/AdminDepositTransferClient";

export const dynamic = "force-dynamic";

export default async function AdminDepositTransferPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  if ((session.user as any).role !== "SUPER_ADMIN") redirect("/admin");
  return <AdminDepositTransferClient />;
}
