import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminNodeSettlementsClient from "@/components/admin/AdminNodeSettlementsClient";

export const dynamic = "force-dynamic";

export default async function AdminNodeSettlementsPage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/");

  // NODE 역할 사용자 전체
  const nodeUsers = await prisma.user.findMany({
    where: { role: "NODE" },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const nodeUserIds = nodeUsers.map((u) => u.id);

  // 각 노드 담당 중간관리자 수
  const middleAdminCounts = await (prisma as any).middleAdminProfile.groupBy({
    by: ["assignedNodeId"],
    where: { assignedNodeId: { in: nodeUserIds } },
    _count: { _all: true },
  }).catch(() => []);
  const middleAdminCountMap = new Map(
    (middleAdminCounts as any[]).map((r: any) => [r.assignedNodeId, r._count._all])
  );

  // 각 노드 직접 배정 브랜드 수
  const brandCounts = await (prisma as any).brandProfile.groupBy({
    by: ["assignedNodeId"],
    where: { assignedNodeId: { in: nodeUserIds } },
    _count: { _all: true },
  }).catch(() => []);
  const brandCountMap = new Map(
    (brandCounts as any[]).map((r: any) => [r.assignedNodeId, r._count._all])
  );

  // 각 노드 정산 내역
  const allSettlements = await (prisma as any).nodeSettlement.findMany({
    where: { nodeUserId: { in: nodeUserIds } },
    orderBy: { createdAt: "desc" },
  }).catch(() => []);

  const settlementMap = new Map<string, any[]>();
  for (const s of allSettlements as any[]) {
    const arr = settlementMap.get(s.nodeUserId) ?? [];
    arr.push(s);
    settlementMap.set(s.nodeUserId, arr);
  }

  const rows = nodeUsers.map((u) => {
    const settles = (settlementMap.get(u.id) ?? []).map((s: any) => ({
      id: s.id as string,
      periodLabel: s.periodLabel as string,
      totalAmount: Number(s.totalAmount),
      status: s.status as string,
      memo: s.memo as string | null,
      paidAt: s.paidAt ? (s.paidAt as Date).toISOString() : null,
      createdAt: (s.createdAt as Date).toISOString(),
    }));

    const totalPaid = settles
      .filter((s) => s.status === "PAID")
      .reduce((sum, s) => sum + s.totalAmount, 0);
    const totalPending = settles
      .filter((s) => s.status === "PENDING")
      .reduce((sum, s) => sum + s.totalAmount, 0);

    return {
      nodeUserId: u.id,
      name: u.name,
      email: u.email,
      isActive: u.isActive,
      middleAdminCount: middleAdminCountMap.get(u.id) ?? 0,
      brandCount: brandCountMap.get(u.id) ?? 0,
      settlements: settles,
      totalPaid,
      totalPending,
      createdAt: u.createdAt.toISOString(),
    };
  });

  return (
    <div className="animate-fade-in">
      <AdminNodeSettlementsClient rows={rows} />
    </div>
  );
}
