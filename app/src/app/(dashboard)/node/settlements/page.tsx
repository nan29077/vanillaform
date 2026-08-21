import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NodeSettlementsClient from "@/components/node/NodeSettlementsClient";

export const dynamic = "force-dynamic";

export default async function NodeSettlementsPage() {
  const session = await auth();
  if ((session?.user as any)?.role !== "NODE") redirect("/");

  const nodeUserId = session!.user!.id;

  // 이 노드가 받은 정산 내역
  // nodeSettlement 모델이 생성 클라이언트에 없을 수 있으므로 try/catch로 안전하게 처리
  const nodeSettlements: any[] = await (async () => {
    try {
      return await (prisma as any).nodeSettlement.findMany({
        where: { nodeUserId },
        orderBy: { createdAt: "desc" },
      });
    } catch {
      return [];
    }
  })();

  // 담당 중간관리자 목록
  const middleAdmins: any[] = await (async () => {
    try {
      return await (prisma as any).middleAdminProfile.findMany({
        where: { assignedNodeId: nodeUserId },
        include: {
          user: { select: { name: true, email: true } },
          settlements: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch {
      return [];
    }
  })();

  // 직접 배정 브랜드 정산 현황
  const directBrands: any[] = await (async () => {
    try {
      return await prisma.brandProfile.findMany({
        where: { assignedNodeId: nodeUserId } as any,
        include: {
          user: { select: { name: true, email: true } },
          settlements: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch {
      return [];
    }
  })();

  const totalReceived = (nodeSettlements as any[])
    .filter((s: any) => s.status === "PAID")
    .reduce((sum: number, s: any) => sum + Number(s.totalAmount), 0);
  const totalPending = (nodeSettlements as any[])
    .filter((s: any) => s.status === "PENDING")
    .reduce((sum: number, s: any) => sum + Number(s.totalAmount), 0);

  const serializedSettlements = (nodeSettlements as any[]).map((s: any) => ({
    id: s.id,
    periodLabel: s.periodLabel,
    totalAmount: Number(s.totalAmount),
    status: s.status as string,
    memo: s.memo as string | null,
    paidAt: s.paidAt ? (s.paidAt as Date).toISOString() : null,
    createdAt: (s.createdAt as Date).toISOString(),
  }));

  const serializedMiddleAdmins = (middleAdmins as any[]).map((m: any) => ({
    id: m.id,
    name: m.name as string,
    userEmail: m.user.email as string,
    commissionRate: Number(m.commissionRate),
    recentSettlements: ((m.settlements || []) as any[]).map((s: any) => ({
      id: s.id as string,
      periodLabel: s.periodLabel as string,
      settlementAmount: Number(s.settlementAmount),
      status: s.status as string,
      createdAt: (s.createdAt as Date).toISOString(),
    })),
  }));

  const serializedDirectBrands = (directBrands as any[]).map((b: any) => ({
    id: b.id as string,
    brandName: b.brandName as string,
    userEmail: b.user.email as string,
    recentSettlements: ((b.settlements || []) as any[]).map((s: any) => ({
      id: s.id as string,
      periodLabel: s.periodLabel as string,
      isPaid: s.isPaid as boolean,
      totalSales: Number(s.totalSales),
      createdAt: (s.createdAt as Date).toISOString(),
    })),
  }));

  return (
    <div className="animate-fade-in">
      <NodeSettlementsClient
        settlements={serializedSettlements}
        middleAdmins={serializedMiddleAdmins}
        directBrands={serializedDirectBrands}
        totalReceived={totalReceived}
        totalPending={totalPending}
      />
    </div>
  );
}
