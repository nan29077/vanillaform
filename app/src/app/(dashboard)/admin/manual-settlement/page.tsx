import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminManualSettlementClient from "@/components/admin/AdminManualSettlementClient";

export const dynamic = "force-dynamic";

export default async function AdminManualSettlementPage() {
  const session = await auth();
  if ((session?.user as any)?.role !== "SUPER_ADMIN") redirect("/");

  // NODE 사용자 목록
  const nodeUsers = await prisma.user.findMany({
    where: { role: "NODE", isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  // MIDDLE_ADMIN 사용자 목록
  const middleAdminUsers = await prisma.user.findMany({
    where: { role: "MIDDLE_ADMIN", isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  // BRAND_ADMIN 사용자 목록
  const brandAdminUsers = await prisma.user.findMany({
    where: { role: "BRAND_ADMIN", isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  // 기존 수기 정산 내역 전체
  let settlements: any[] = [];
  try {
    const raw = await (prisma as any).manualSettlement.findMany({
      orderBy: { createdAt: "desc" },
      include: { admin: { select: { name: true } } },
    });

    // 수취인 정보 일괄 조회
    const recipientIds: string[] = [...new Set<string>(raw.map((s: any) => s.recipientId as string))];
    const recipients = recipientIds.length
      ? await prisma.user.findMany({
          where: { id: { in: recipientIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const rMap = new Map(recipients.map((u) => [u.id, u]));

    settlements = raw.map((s: any) => ({
      id: s.id as string,
      recipientType: s.recipientType as string,
      recipientId: s.recipientId as string,
      recipientName: rMap.get(s.recipientId)?.name ?? "-",
      recipientEmail: rMap.get(s.recipientId)?.email ?? "-",
      amount: s.amount as number,
      memo: s.memo as string | null,
      status: s.status as string,
      paidAt: (s.paidAt as Date).toISOString(),
      adminName: s.admin?.name ?? "-",
      createdAt: (s.createdAt as Date).toISOString(),
    }));
  } catch {
    // ignore — table may not exist in dev
  }

  return (
    <div className="animate-fade-in">
      <AdminManualSettlementClient
        nodeUsers={nodeUsers}
        middleAdminUsers={middleAdminUsers}
        brandAdminUsers={brandAdminUsers}
        settlements={settlements}
      />
    </div>
  );
}

