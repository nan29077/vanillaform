import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBrandSettleDays } from "@/lib/settings";
import { getSettlementDate, startOfDay, toYmd } from "@/lib/businessDays";
import AdminBrandSettlementsClient from "@/components/admin/AdminBrandSettlementsClient";

export const dynamic = "force-dynamic";

export default async function AdminBrandSettlementsPage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/");

  const settleDays = await getBrandSettleDays();
  const today = startOfDay(new Date());

  const brands = await prisma.brandProfile.findMany({
    include: {
      user: { select: { name: true, email: true } },
      middleAdmin: { select: { id: true, name: true } },
    },
    orderBy: { brandName: "asc" },
  });

  const products = await prisma.product.findMany({
    select: { id: true, brandId: true, supplyPrice: true, basePrice: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: {
        paymentStatus: "COMPLETED",
        status: { notIn: ["CANCELLED", "REFUNDED", "REFUND_REQUESTED"] },
      },
    },
    select: {
      productId: true,
      quantity: true,
      totalPrice: true,
      order: {
        select: {
          id: true,
          status: true,
          paidAt: true,
          createdAt: true,
          paymentStatus: true,
        },
      },
    },
  });

  type BrandData = {
    availableAmount: number;
    scheduledAmount: number;
    todayAvailableAmount: number;
    totalSales: number;
    orderCount: number;
  };
  const brandDataMap = new Map<string, BrandData>();
  const todayYmd = toYmd(today);

  for (const item of orderItems) {
    const product = productMap.get(item.productId);
    if (!product?.brandId) continue;

    const brandId = product.brandId;
    const cur = brandDataMap.get(brandId) ?? {
      availableAmount: 0,
      scheduledAmount: 0,
      todayAvailableAmount: 0,
      totalSales: 0,
      orderCount: 0,
    };

    const supplyAmount = Number(product.supplyPrice ?? 0) * item.quantity;
    const saleDate = item.order.paidAt ?? item.order.createdAt;
    const settlementDate = getSettlementDate(saleDate, settleDays);
    const isAvailable = settlementDate.getTime() <= today.getTime();
    const settleYmd = toYmd(settlementDate);

    if (isAvailable) {
      cur.availableAmount += supplyAmount;
      if (settleYmd === todayYmd) cur.todayAvailableAmount += supplyAmount;
    } else {
      cur.scheduledAmount += supplyAmount;
    }

    cur.totalSales += Number(item.totalPrice);
    cur.orderCount += 1;
    brandDataMap.set(brandId, cur);
  }

  let allSettlements: any[] = [];
  try {
    allSettlements = await (prisma as any).brandSettlement.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch {
    // ignore
  }

  const settlementMap = new Map<string, any[]>();
  for (const s of allSettlements) {
    const arr = settlementMap.get(s.brandId) ?? [];
    arr.push(s);
    settlementMap.set(s.brandId, arr);
  }

  const totalPending = allSettlements
    .filter((s) => !s.isPaid)
    .reduce((acc: number, s: any) => acc + Number(s.totalSupply), 0);
  const totalPaid = allSettlements
    .filter((s) => s.isPaid)
    .reduce((acc: number, s: any) => acc + Number(s.totalSupply), 0);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayPaid = allSettlements
    .filter((s: any) => s.isPaid && s.paidAt && new Date(s.paidAt) >= todayStart)
    .reduce((acc: number, s: any) => acc + Number(s.totalSupply), 0);

  const serialized = brands.map((b) => {
    const data = brandDataMap.get(b.id);
    const brandSettles = (settlementMap.get(b.id) ?? []).map((s: any) => ({
      id: s.id,
      periodLabel: s.periodLabel,
      totalSupply: Number(s.totalSupply),
      totalSales: Number(s.totalSales),
      orderCount: s.orderCount,
      isPaid: s.isPaid,
      memo: s.memo,
      paidAt: s.paidAt?.toISOString() ?? null,
      invoiceStatus: s.invoiceStatus ?? "NONE",
      invoiceRequestedAt: s.invoiceRequestedAt?.toISOString() ?? null,
      invoiceIssuedAt: s.invoiceIssuedAt?.toISOString() ?? null,
      invoiceNumber: s.invoiceNumber ?? null,
      createdAt: s.createdAt.toISOString(),
    }));

    const paidSettles = brandSettles.filter((s: any) => s.isPaid);
    const todayPaidBrand = brandSettles
      .filter((s: any) => s.isPaid && s.paidAt && new Date(s.paidAt) >= todayStart)
      .reduce((acc: number, s: any) => acc + s.totalSupply, 0);

    return {
      id: b.id,
      brandName: b.brandName,
      userName: b.user.name,
      userEmail: b.user.email,
      isApproved: b.isApproved,
      middleAdminId: b.middleAdminId,
      middleAdminName: b.middleAdmin?.name ?? null,
      commissionRate: Number(b.commissionRate),
      bankName: (b as any).bankName ?? null,
      accountNumber: (b as any).accountNumber ?? null,
      accountHolder: (b as any).accountHolder ?? null,
      availableAmount: data?.availableAmount ?? 0,
      scheduledAmount: data?.scheduledAmount ?? 0,
      todayAvailableAmount: data?.todayAvailableAmount ?? 0,
      totalSales: data?.totalSales ?? 0,
      orderCount: data?.orderCount ?? 0,
      settlements: brandSettles,
      cumulativePaidAmount: paidSettles.reduce((acc: number, s: any) => acc + s.totalSupply, 0),
      todayPaidAmount: todayPaidBrand,
    };
  });

  return (
    <div className="animate-fade-in">
      <AdminBrandSettlementsClient
        brands={serialized}
        summary={{ totalPending, totalPaid, todayPaid, settleDays }}
      />
    </div>
  );
}
