import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminMiddleSettlementClient from "@/components/admin/AdminMiddleSettlementClient";

export const dynamic = "force-dynamic";

export default async function AdminMiddleSettlementsPage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/");

  const middleAdmins = await prisma.middleAdminProfile.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  const pendingGrouped = await prisma.middleAdminCommission.groupBy({
    by: ["middleAdminId"],
    where: { status: "PENDING" },
    _sum: { orderAmount: true, marginAmount: true },
    _count: { _all: true },
  });
  const pendingMap = new Map(pendingGrouped.map((g) => [g.middleAdminId, g]));

  const paidGrouped = await prisma.middleAdminCommission.groupBy({
    by: ["middleAdminId"],
    where: { status: "PAID" },
    _sum: { marginAmount: true },
  });
  const paidMap = new Map(paidGrouped.map((g) => [g.middleAdminId, g]));

  let allSettlements: any[] = [];
  try {
    allSettlements = await (prisma as any).middleAdminSettlement.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch {
    // ignore
  }

  const settlementMap = new Map<string, any[]>();
  for (const s of allSettlements) {
    const arr = settlementMap.get(s.middleAdminId) ?? [];
    arr.push(s);
    settlementMap.set(s.middleAdminId, arr);
  }

  const rows = middleAdmins.map((m) => {
    const p = pendingMap.get(m.id);
    const paid = paidMap.get(m.id);
    const settles = (settlementMap.get(m.id) ?? []).map((s: any) => ({
      id: s.id,
      periodStart: s.periodStart.toISOString(),
      periodEnd: s.periodEnd.toISOString(),
      totalSales: Number(s.totalSales),
      marginAmount: Number(s.marginAmount),
      settlementAmount: Number(s.settlementAmount),
      status: s.status,
      paidAt: s.paidAt?.toISOString() ?? null,
      invoiceStatus: s.invoiceStatus ?? "NONE",
      invoiceRequestedAt: s.invoiceRequestedAt?.toISOString() ?? null,
      invoiceIssuedAt: s.invoiceIssuedAt?.toISOString() ?? null,
      invoiceNumber: s.invoiceNumber ?? null,
      createdAt: s.createdAt.toISOString(),
    }));

    return {
      middleAdminId: m.id,
      name: m.name,
      pendingCount: p?._count._all ?? 0,
      pendingOrderAmount: Number(p?._sum.orderAmount ?? 0),
      pendingMarginAmount: Number(p?._sum.marginAmount ?? 0),
      paidMarginAmount: Number(paid?._sum.marginAmount ?? 0),
      settlements: settles,
      managerSettlements: [],
    };
  });

  return (
    <div className="animate-fade-in">
      <AdminMiddleSettlementClient rows={rows} />
    </div>
  );
}