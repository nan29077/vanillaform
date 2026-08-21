import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MiddleAdminManagementClient from "@/components/admin/MiddleAdminManagementClient";
import { getMiddleSettleDays } from "@/lib/settings";
import { getSettlementDate, startOfDay } from "@/lib/businessDays";

export const dynamic = "force-dynamic";

export default async function AdminMiddleAdminsPage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/");

  const middleAdmins = await prisma.middleAdminProfile.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, isActive: true, createdAt: true, avatar: true, image: true } },
      _count: { select: { brands: true, sellers: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // ── 중간관리자 정산 요약 (마진 커미션 기반) ─────────────────────────────────
  const settleDays = await getMiddleSettleDays();
  const today = startOfDay(new Date());

  const commissions = await prisma.middleAdminCommission.findMany({
    where: { status: "PENDING" },
    select: {
      middleAdminId: true,
      marginAmount: true,
      order: { select: { paidAt: true, createdAt: true, cancelStatus: true } },
    },
  });

  type MASummary = { available: number; scheduled: number };
  const maSummaryMap = new Map<string, MASummary>();

  for (const c of commissions) {
    const saleDate = c.order.paidAt ?? c.order.createdAt;
    const settlementDate = getSettlementDate(saleDate, settleDays);
    const cancelPending = ["REQUESTED", "DEPOSIT_CONFIRMED", "APPROVED"].includes(
      (c.order as any).cancelStatus ?? "",
    );
    const isAvailable = !cancelPending && settlementDate.getTime() <= today.getTime();
    const amount = Number(c.marginAmount);
    const cur = maSummaryMap.get(c.middleAdminId) ?? { available: 0, scheduled: 0 };
    if (isAvailable) cur.available += amount;
    else cur.scheduled += amount;
    maSummaryMap.set(c.middleAdminId, cur);
  }

  // 수기 조정 (ManualSettlement, recipientType="MIDDLE_ADMIN")
  const maUserIds = middleAdmins.map((m) => m.user.id);
  let maAdjs: Array<{ recipientId: string; amount: number }> = [];
  try {
    maAdjs = await (prisma as any).manualSettlement.findMany({
      where: { recipientType: "MIDDLE_ADMIN", recipientId: { in: maUserIds } },
      select: { recipientId: true, amount: true },
    });
  } catch { /* ignore */ }

  const userIdToMAId = new Map(middleAdmins.map((m) => [m.user.id, m.id]));
  const maAdjMap = new Map<string, number>(); // middleAdminId 기준
  for (const adj of maAdjs) {
    const maId = userIdToMAId.get(adj.recipientId);
    if (!maId) continue;
    maAdjMap.set(maId, (maAdjMap.get(maId) ?? 0) + adj.amount);
  }

  const serialized = middleAdmins.map((m) => {
    const summary = maSummaryMap.get(m.id) ?? { available: 0, scheduled: 0 };
    const adj = maAdjMap.get(m.id) ?? 0;
    return {
      id: m.id,
      userId: m.user.id,
      name: m.name,
      contactPhone: m.contactPhone,
      isActive: m.isActive,
      isApproved: m.isApproved,
      userName: m.user.name || "",
      userEmail: m.user.email || "",
      userPhone: (m.user as any).phone || null,
      userIsActive: m.user.isActive,
      userAvatar: m.user.avatar || m.user.image || null,
      userCreatedAt: m.user.createdAt.toISOString(),
      brandCount: m._count.brands,
      sellerCount: m._count.sellers,
      createdAt: m.createdAt.toISOString(),
      settlementAvailable: summary.available + adj,
      settlementScheduled: summary.scheduled,
    };
  });

  return (
    <div className="animate-fade-in">
      <MiddleAdminManagementClient middleAdmins={serialized} />
    </div>
  );
}
