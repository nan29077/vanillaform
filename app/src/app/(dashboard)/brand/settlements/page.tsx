import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRecipientSettlementSummary, getPlatformFees } from "@/lib/settlement";
import { getBrandSettleDays } from "@/lib/settings";
import SupplierSettlementTable from "@/components/settlement/SupplierSettlementTable";
import SellerSettlementClient from "@/components/seller/SellerSettlementClient";
import BrandSettlementSection from "@/components/brand/BrandSettlementSection";

export const dynamic = "force-dynamic";

export default async function BrandSettlementsPage() {
  const session = await auth();
  if (session?.user?.role !== "BRAND_ADMIN") redirect("/");

  const brand = await prisma.brandProfile.findUnique({
    where: { userId: session!.user!.id },
    select: { id: true, brandName: true, commissionRate: true },
  });
  if (!brand) redirect("/");

  const [settleDays, fees] = await Promise.all([getBrandSettleDays(), getPlatformFees()]);
  const summary = await getRecipientSettlementSummary({
    role: "BRAND",
    recipientId: brand.id,
    fees,
    settleDays,
  });

  let settlements: any[] = [];
  try {
    settlements = await (prisma as any).brandSettlement.findMany({
      where: { brandId: brand.id },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    // ignore
  }

  const serializedSettlements = settlements.map((s: any) => ({
    id: s.id,
    periodLabel: s.periodLabel,
    totalSupply: Number(s.totalSupply),
    totalSales: Number(s.totalSales),
    orderCount: s.orderCount,
    isPaid: s.isPaid,
    paidAt: s.paidAt?.toISOString() ?? null,
    invoiceStatus: s.invoiceStatus ?? "NONE",
    invoiceRequestedAt: s.invoiceRequestedAt?.toISOString() ?? null,
    invoiceIssuedAt: s.invoiceIssuedAt?.toISOString() ?? null,
    invoiceNumber: s.invoiceNumber ?? null,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <div className="animate-fade-in space-y-6">
      <SellerSettlementClient
        summary={summary}
        shopName={brand.brandName}
        defaultAccountHolder={brand.brandName}
        defaultIsBusiness={true}
        readOnly
        title="브랜드 정산 내역"
      />
      <SupplierSettlementTable
        orders={summary.orders}
        feeRate={summary.commissionRate}
        supplyLabel="공급가"
      />
      <BrandSettlementSection settlements={serializedSettlements} />
    </div>
  );
}
