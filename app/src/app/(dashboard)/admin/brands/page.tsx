import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BrandManagementClient from "@/components/admin/BrandManagementClient";
import { getBrandSettleDays } from "@/lib/settings";
import { getSettlementDate, startOfDay } from "@/lib/businessDays";

export const dynamic = "force-dynamic";

export default async function AdminBrandsPage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/");

  const [brands, middleAdmins] = await Promise.all([
    prisma.brandProfile.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, isActive: true, createdAt: true } },
        _count: { select: { products: true } },
        middleAdmin: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.middleAdminProfile.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // ── 브랜드 정산 요약 (공급가 기반) ──────────────────────────────────────────
  const settleDays = await getBrandSettleDays();
  const today = startOfDay(new Date());

  const products = await prisma.product.findMany({
    select: { id: true, brandId: true, supplyPrice: true },
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
      order: { select: { paidAt: true, createdAt: true } },
    },
  });

  type BrandSummary = { available: number; scheduled: number };
  const brandSummaryMap = new Map<string, BrandSummary>();

  for (const item of orderItems) {
    const product = productMap.get(item.productId);
    if (!product?.brandId) continue;
    const saleDate = (item as any).order.paidAt ?? (item as any).order.createdAt;
    const settlementDate = getSettlementDate(saleDate, settleDays);
    const isAvailable = settlementDate.getTime() <= today.getTime();
    const supplyAmount = Number(product.supplyPrice ?? 0) * item.quantity;
    const cur = brandSummaryMap.get(product.brandId) ?? { available: 0, scheduled: 0 };
    if (isAvailable) cur.available += supplyAmount;
    else cur.scheduled += supplyAmount;
    brandSummaryMap.set(product.brandId, cur);
  }

  // 수기 조정 (ManualSettlement, recipientType="BRAND_ADMIN")
  const brandUserIds = brands.map((b) => b.user.id);
  let brandAdjs: Array<{ recipientId: string; amount: number }> = [];
  try {
    brandAdjs = await (prisma as any).manualSettlement.findMany({
      where: { recipientType: "BRAND_ADMIN", recipientId: { in: brandUserIds } },
      select: { recipientId: true, amount: true },
    });
  } catch { /* ignore */ }

  const userIdToBrandId = new Map(brands.map((b) => [b.user.id, b.id]));
  const brandAdjMap = new Map<string, number>(); // brandId 기준
  for (const adj of brandAdjs) {
    const brandId = userIdToBrandId.get(adj.recipientId);
    if (!brandId) continue;
    brandAdjMap.set(brandId, (brandAdjMap.get(brandId) ?? 0) + adj.amount);
  }

  const serialized = brands.map((b) => {
    const summary = brandSummaryMap.get(b.id) ?? { available: 0, scheduled: 0 };
    const adj = brandAdjMap.get(b.id) ?? 0;
    return {
      id: b.id,
      userId: b.user.id,
      brandName: b.brandName,
      brandLogo: b.brandLogo,
      description: b.description,
      isApproved: b.isApproved,
      businessRegistrationNo: b.businessRegistrationNo,
      representativeName: b.representativeName,
      businessAddress: b.businessAddress,
      businessType: b.businessType,
      businessCategory: b.businessCategory,
      contactPhone: b.contactPhone,
      contactEmail: b.contactEmail,
      userName: b.user.name,
      userEmail: b.user.email,
      userPhone: (b.user as any).phone || null,
      userIsActive: b.user.isActive,
      userCreatedAt: b.user.createdAt.toISOString(),
      productCount: b._count.products,
      middleAdminId: b.middleAdmin?.id || null,
      middleAdminName: b.middleAdmin?.name || null,
      marginMethod: b.marginMethod,
      marginBase: b.marginBase,
      marginRate: Number(b.marginRate),
      createdAt: b.createdAt.toISOString(),
      settlementAvailable: summary.available + adj,
      settlementScheduled: summary.scheduled,
    };
  });

  const serializedMiddleAdmins = middleAdmins.map((m) => ({
    id: m.id,
    name: m.name,
  }));

  return (
    <div className="animate-fade-in">
      <BrandManagementClient brands={serialized} middleAdmins={serializedMiddleAdmins} />
    </div>
  );
}
