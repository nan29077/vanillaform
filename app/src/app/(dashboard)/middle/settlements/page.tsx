import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRecipientSettlementSummary, getPlatformFees } from "@/lib/settlement";
import { getMiddleSettleDays } from "@/lib/settings";
import SellerSettlementClient from "@/components/seller/SellerSettlementClient";
import MiddleSettlementSection from "@/components/middle/MiddleSettlementSection";
import SupplierSettlementTable from "@/components/settlement/SupplierSettlementTable";

export const dynamic = "force-dynamic";

export default async function MiddleSettlementsPage() {
  let session;
  try {
    session = await auth();
  } catch {
    redirect("/auth/login");
  }
  if (session?.user?.role !== "MIDDLE_ADMIN") redirect("/");

  const middleAdminId = (session!.user as any).middleAdminId as string | undefined;
  if (!middleAdminId) redirect("/");

  const middle = await prisma.middleAdminProfile.findUnique({
    where: { id: middleAdminId },
    select: { name: true, commissionRate: true },
  });
  if (!middle) redirect("/");

  const [settleDays, fees] = await Promise.all([getMiddleSettleDays(), getPlatformFees()]);
  const summary = await getRecipientSettlementSummary({
    role: "MIDDLE_ADMIN",
    recipientId: middleAdminId,
    fees,
    settleDays,
  });

  let settlements: any[] = [];
  try {
    settlements = await (prisma as any).middleAdminSettlement.findMany({
      where: { middleAdminId },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    // ignore
  }

  const serializedSettlements = settlements.map((s: any) => ({
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

  const brands = await prisma.brandProfile.findMany({
    where: { middleAdminId },
    select: { id: true, brandName: true },
  });
  const brandIds = brands.map((b) => b.id);
  let brandPayouts: { brandId: string; brandName: string; payableAmount: number }[] = [];

  if (brandIds.length > 0) {
    const products = await prisma.product.findMany({
      where: { brandId: { in: brandIds }, middleAdminId },
      select: { id: true, brandId: true, supplyPrice: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    const items = await prisma.orderItem.findMany({
      where: {
        productId: { in: products.map((p) => p.id) },
        order: {
          paymentStatus: "COMPLETED",
          status: { notIn: ["CANCELLED", "REFUNDED", "REFUND_REQUESTED"] },
        },
      },
      select: { productId: true, quantity: true },
    });
    const brandSupplyMap = new Map<string, number>();
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product?.brandId) continue;
      const supply = Number(product.supplyPrice ?? 0) * item.quantity;
      brandSupplyMap.set(product.brandId, (brandSupplyMap.get(product.brandId) ?? 0) + supply);
    }
    brandPayouts = brands.map((b) => ({
      brandId: b.id,
      brandName: b.brandName,
      payableAmount: brandSupplyMap.get(b.id) ?? 0,
    }));
  }

  return (
    <div className="animate-fade-in space-y-6">
      <SellerSettlementClient
        summary={summary}
        shopName={middle.name}
        defaultAccountHolder={middle.name}
        defaultIsBusiness={true}
        readOnly
        title="정산 관리"
      />
      <SupplierSettlementTable
        orders={summary.orders}
        feeRate={summary.commissionRate}
        supplyLabel="공급가"
      />
      <MiddleSettlementSection
        settlements={serializedSettlements}
        brandPayouts={brandPayouts}
      />
    </div>
  );
}
