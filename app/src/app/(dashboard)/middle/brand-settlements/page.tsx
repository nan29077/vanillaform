import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MiddleBrandSettlementClient from "@/components/middle/MiddleBrandSettlementClient";

export const dynamic = "force-dynamic";

export default async function MiddleBrandSettlementsPage() {
  let session;
  try {
    session = await auth();
  } catch {
    redirect("/auth/login");
  }
  if (session?.user?.role !== "MIDDLE_ADMIN") redirect("/");

  const middleAdminId = (session!.user as any).middleAdminId as string | undefined;
  if (!middleAdminId) redirect("/");

  // 소속 브랜드 목록
  const brands = await prisma.brandProfile.findMany({
    where: { middleAdminId },
    select: {
      id: true,
      brandName: true,
      bankName: true,
      accountNumber: true,
      accountHolder: true,
    },
    orderBy: { brandName: "asc" },
  });
  const brandIds = brands.map((b) => b.id);

  // 브랜드별 주문 집계
  const brandSupplyMap = new Map<string, { totalSales: number; orderCount: number; totalSupply: number }>();
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
      select: { productId: true, quantity: true, price: true },
    });
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product?.brandId) continue;
      const cur = brandSupplyMap.get(product.brandId) ?? { totalSales: 0, orderCount: 0, totalSupply: 0 };
      cur.totalSales += Number(item.price) * item.quantity;
      cur.totalSupply += Number(product.supplyPrice ?? 0) * item.quantity;
      cur.orderCount += item.quantity;
      brandSupplyMap.set(product.brandId, cur);
    }
  }

  // 이 중간관리자가 생성한 정산 내역 (raw SQL - Prisma 클라이언트가 middleAdminId 미인식)
  let rawSettlements: any[] = [];
  try {
    rawSettlements = await prisma.$queryRawUnsafe(
      `SELECT bs.id, bs.brandId, bs.periodLabel,
              bs.totalSupply, bs.totalSales, bs.orderCount,
              bs.isPaid, bs.memo, bs.paidAt,
              bs.invoiceStatus, bs.invoiceRequestedAt, bs.invoiceIssuedAt, bs.invoiceNumber,
              bs.createdAt, bp.brandName
       FROM brand_settlements bs
       JOIN brand_profiles bp ON bs.brandId = bp.id
       WHERE bs.middleAdminId = ?
       ORDER BY bs.createdAt DESC`,
      middleAdminId
    );
  } catch {
    // ignore
  }

  // 브랜드별 기지급액 합산
  const paidMap = new Map<string, number>();
  for (const s of rawSettlements) {
    if (s.isPaid) {
      paidMap.set(s.brandId, (paidMap.get(s.brandId) ?? 0) + Number(s.totalSupply));
    }
  }

  const brandPayouts = brands.map((b) => {
    const agg = brandSupplyMap.get(b.id) ?? { totalSales: 0, orderCount: 0, totalSupply: 0 };
    const paid = paidMap.get(b.id) ?? 0;
    return {
      id: b.id,
      brandName: b.brandName,
      bankName: b.bankName ?? null,
      accountNumber: b.accountNumber ?? null,
      accountHolder: b.accountHolder ?? null,
      totalSales: agg.totalSales,
      totalSupply: agg.totalSupply,
      orderCount: agg.orderCount,
      unpaidAmount: Math.max(0, agg.totalSupply - paid),
      paidAmount: paid,
    };
  });

  const settlements = rawSettlements.map((s: any) => ({
    id: s.id as string,
    brandId: s.brandId as string,
    brandName: s.brandName as string,
    periodLabel: s.periodLabel as string,
    totalSupply: Number(s.totalSupply),
    totalSales: Number(s.totalSales),
    orderCount: Number(s.orderCount),
    isPaid: Boolean(s.isPaid),
    memo: s.memo as string | null,
    paidAt: s.paidAt ? new Date(s.paidAt).toISOString() : null,
    invoiceStatus: (s.invoiceStatus as string) ?? "NONE",
    invoiceRequestedAt: s.invoiceRequestedAt ? new Date(s.invoiceRequestedAt).toISOString() : null,
    invoiceIssuedAt: s.invoiceIssuedAt ? new Date(s.invoiceIssuedAt).toISOString() : null,
    invoiceNumber: s.invoiceNumber as string | null,
    createdAt: new Date(s.createdAt).toISOString(),
  }));

  return (
    <div className="animate-fade-in space-y-2">
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-gray-900">브랜드사 정산</h1>
        <p className="text-sm text-gray-400 mt-1">
          소속 브랜드사에 공급가 기준으로 정산을 생성하고 지급을 관리합니다.
        </p>
      </div>
      <MiddleBrandSettlementClient
        initialBrandPayouts={brandPayouts}
        initialSettlements={settlements}
      />
    </div>
  );
}
