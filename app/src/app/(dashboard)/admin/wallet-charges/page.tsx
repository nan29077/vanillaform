import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminWalletChargesClient from "@/components/admin/AdminWalletChargesClient";

export const dynamic = "force-dynamic";

// 충전 관리 (목업) — 가상계좌 입금 확인 / 상품권 검증 승인
export default async function AdminWalletChargesPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/admin");
  return <AdminWalletChargesClient />;
}
