import { prisma } from "@/lib/prisma";
import { getSettlementBusinessDays } from "@/lib/settings";
import { getSettlementDate, startOfDay } from "@/lib/businessDays";

/**
 * 관리자 화면(/admin/sellers, /admin/users 셀러 탭)에서 공용으로 쓰는 셀러 목록.
 * 두 화면이 같은 AdminSellersClient 를 렌더하므로 데이터도 한 곳에서 만든다.
 */
export async function getAdminSellers() {
  const sellers = await (prisma as any).sellerProfile.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          phone: true,
          createdAt: true,
          mentorId: true,
          mentor: { select: { id: true, name: true } },
        },
      },
      _count: { select: { campaigns: true, shopProducts: true, fans: true, orders: true, followers: true } },
      middleAdmin: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // ── 정산 요약 계산 (주문 기반) ───────────────────────────────────────────────
  const businessDays = await getSettlementBusinessDays();
  const today = startOfDay(new Date());

  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: "COMPLETED",
      status: { notIn: ["CANCELLED", "REFUNDED", "REFUND_REQUESTED"] },
    },
    select: {
      sellerId: true,
      finalAmount: true,
      paidAt: true,
      createdAt: true,
      cancelStatus: true,
      seller: { select: { commissionRate: true } },
    },
  });

  type Summary = { available: number; scheduled: number };
  const orderSettleMap = new Map<string, Summary>(); // sellerId(SellerProfile.id) 기준

  for (const order of orders) {
    const saleDate = order.paidAt ?? order.createdAt;
    const settlementDate = getSettlementDate(saleDate, businessDays);
    const cancelPending = ["REQUESTED", "DEPOSIT_CONFIRMED", "APPROVED"].includes(
      (order as any).cancelStatus ?? "",
    );
    const isAvailable = !cancelPending && settlementDate.getTime() <= today.getTime();
    const commRate = Number((order as any).seller?.commissionRate ?? 5);
    const feeMultiplier = 1 - (commRate * 1.1) / 100;
    const settlementAmount = Math.round(Number(order.finalAmount) * feeMultiplier);
    const cur = orderSettleMap.get(order.sellerId) ?? { available: 0, scheduled: 0 };
    if (isAvailable) cur.available += settlementAmount;
    else cur.scheduled += settlementAmount;
    orderSettleMap.set(order.sellerId, cur);
  }

  // 수기 조정 내역(ManualSettlement, recipientType="SELLER")
  const sellerUserIds = sellers.map((s: any) => s.user.id);
  let adjustments: Array<{ recipientId: string; amount: number }> = [];
  try {
    adjustments = await (prisma as any).manualSettlement.findMany({
      where: { recipientType: "SELLER", recipientId: { in: sellerUserIds } },
      select: { recipientId: true, amount: true },
    });
  } catch { /* ignore */ }

  const adjMap = new Map<string, number>(); // userId 기준
  for (const adj of adjustments) {
    adjMap.set(adj.recipientId, (adjMap.get(adj.recipientId) ?? 0) + adj.amount);
  }

  return sellers.map((s: any) => {
    const orderSummary = orderSettleMap.get(s.id) ?? { available: 0, scheduled: 0 };
    const adj = adjMap.get(s.user.id) ?? 0;
    return {
      id: s.id,
      userId: s.user.id,
      shopName: s.shopName,
      shopLogo: s.shopLogo,
      userName: s.user.name || "",
      userEmail: s.user.email || "",
      userPhone: s.user.phone || null,
      userImage: s.user.avatar,
      userCreatedAt: s.user.createdAt.toISOString(),
      isApproved: s.isApproved,
      isRecommended: s.isRecommended,
      totalFans: s.totalFans,
      followersCount: s._count.followers,
      campaignsCount: s._count.campaigns,
      shopProductsCount: s._count.shopProducts,
      fanCount: s._count.fans,
      ordersCount: s._count.orders,
      commissionRate: s.commissionRate != null ? Number(s.commissionRate) : null,
      middleAdminId: s.middleAdmin?.id || null,
      middleAdminName: s.middleAdmin?.name || null,
      middleAdminMarginRate: 0,
      mentorId: s.user.mentorId || null,
      mentorName: s.user.mentor?.name || null,
      createdAt: s.createdAt.toISOString(),
      settlementAvailable: orderSummary.available + adj,
      settlementScheduled: orderSummary.scheduled,
    };
  });
}
