import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanupStalePendingOrders, VISIBLE_ORDER_FILTER } from "@/lib/orderCleanup";
import { parseSnsAccounts } from "@/lib/utils";
import { buildOrderFeeInfoMap } from "@/lib/orderFee";
import OrderManagementClient from "@/components/shared/OrderManagementClient";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/");

  // 방치된 미결제 주문 정리 (이탈 PENDING 이 목록·DB 에 남지 않도록)
  await cleanupStalePendingOrders().catch(() => {});

  const orders = await prisma.order.findMany({
    // 미결제 PENDING + 결제 전 이탈한 CANCELLED(pgTid 없음) 제외
    where: { ...VISIBLE_ORDER_FILTER },
    include: {
      user: { select: { name: true, email: true } },
      seller: { select: { id: true, shopName: true } },
      items: {
        include: {
          variant: { select: { name: true } },
        },
      },
      campaign: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Get product → brand mapping
  const productIds = [...new Set(orders.flatMap(o => o.items.map(i => i.productId)))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true, thumbnail: true, brandId: true, middleAdminId: true,
      brand: { select: { id: true, brandName: true, middleAdminId: true } },
    },
  });
  const productBrandMap = Object.fromEntries(products.map(p => [p.id, p.brand]));
  const productThumbMap = Object.fromEntries(products.map(p => [p.id, p.thumbnail]));
  // 발주서 구분 필터용 상품 공급자 메타
  const productMetaMap = Object.fromEntries(
    products.map((p) => [p.id, {
      productMiddleAdminId: p.middleAdminId ?? null,
      brandId: p.brand?.id ?? null,
      brandMiddleAdminId: p.brand?.middleAdminId ?? null,
    }])
  );

  // 패키지 주문과 연결된 orderId 목록
  const packageOrderItems = await prisma.packageOrderItem.findMany({
    select: { orderId: true },
  });
  const packageOrderIdSet = new Set(packageOrderItems.map((p) => p.orderId).filter(Boolean));

  // Get all sellers and brands for filters
  const allSellers = await prisma.sellerProfile.findMany({ select: { id: true, shopName: true }, orderBy: { shopName: "asc" } });
  const allBrands = await prisma.brandProfile.findMany({
    select: { id: true, brandName: true, middleAdmin: { select: { name: true } } },
    orderBy: { brandName: "asc" },
  });
  // 발주서 구분 필터용 중간관리자 목록 + 브랜드→관리 중간관리자명 매핑
  const allMiddleAdmins = await prisma.middleAdminProfile.findMany({
    select: { id: true, name: true }, orderBy: { name: "asc" },
  });
  const brandManagerMap: Record<string, string> = {};
  allBrands.forEach((b) => { if (b.middleAdmin?.name) brandManagerMap[b.id] = b.middleAdmin.name; });

  // 주문별 정산 수수료 안내(최고관리자 관점) 계산 — 전체 수익 구조
  const feeMap = await buildOrderFeeInfoMap({
    viewpoint: "ADMIN",
    orders: orders.map((o) => ({
      id: o.id,
      status: o.status,
      paymentStatus: o.paymentStatus,
      items: o.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        totalPrice: Number(i.totalPrice),
        productName: i.productName,
        variantName: i.variantName || i.variant?.name || null,
      })),
    })),
  });

  const serialized = orders.map((o) => {
    // Determine brand from first item
    const firstBrand = o.items.length > 0 ? productBrandMap[o.items[0].productId] : null;
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      userName: o.user.name || "",
      userEmail: o.user.email,
      sellerName: o.seller.shopName,
      sellerId: o.seller.id,
      brandName: firstBrand?.brandName || null,
      brandId: firstBrand?.id || null,
      finalAmount: Number(o.finalAmount),
      totalAmount: Number(o.totalAmount),
      shippingFee: Number(o.shippingFee),
      discountAmount: Number(o.discountAmount),
      discountType: o.discountType,
      status: o.status,
      paymentMethod: o.paymentMethod,
      campaignId: o.campaignId,
      campaignTitle: o.campaign?.title || null,
      shippingName: o.shippingName,
      shippingPhone: o.shippingPhone,
      shippingAddress: o.shippingAddress,
      shippingMemo: o.shippingMemo,
      snsAccounts: parseSnsAccounts((o as any).snsAccounts),
      createdAt: o.createdAt.toISOString(),
      paidAt: o.paidAt?.toISOString() || null,
      shippedAt: o.shippedAt?.toISOString() || null,
      deliveredAt: o.deliveredAt?.toISOString() || null,
      thumbnail: o.items.length ? productThumbMap[o.items[0].productId] || null : null,
      items: o.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.productName,
        variantName: i.variantName || i.variant?.name || null,
        price: Number(i.price),
        quantity: i.quantity,
        totalPrice: Number(i.totalPrice),
        thumbnail: productThumbMap[i.productId] || null,
        productMiddleAdminId: productMetaMap[i.productId]?.productMiddleAdminId ?? null,
        brandId: productMetaMap[i.productId]?.brandId ?? null,
        brandMiddleAdminId: productMetaMap[i.productId]?.brandMiddleAdminId ?? null,
      })),
      feeInfo: feeMap[o.id] ?? null,
      canViewDetail: true,
      isPackageOrder: packageOrderIdSet.has(o.id),
      deliveryStatus: (o as any).deliveryStatus || null,
      deliveryCourier: (o as any).deliveryCourier || null,
      deliveryTracking: (o as any).deliveryTracking || null,
      deliveryUpdatedAt: (o as any).deliveryUpdatedAt?.toISOString() || null,
      paymentStatus: o.paymentStatus,
      cancelStatus: (o as any).cancelStatus || null,
      cancelType: (o as any).cancelType || null,
      cancelAmount: (o as any).cancelAmount != null ? Number((o as any).cancelAmount) : null,
      cancelFromSettlement: (o as any).cancelFromSettlement ?? false,
    };
  });

  const serializedSellers = allSellers.map((s) => ({ id: s.id, name: s.shopName }));
  const serializedBrands = allBrands.map((b) => ({ id: b.id, name: b.brandName }));

  return (
    <div className="animate-fade-in">
      <OrderManagementClient
        orders={serialized}
        sellers={serializedSellers}
        brands={serializedBrands}
        role="SUPER_ADMIN"
        poFilter="admin"
        middleAdmins={allMiddleAdmins.map((m) => ({ id: m.id, name: m.name }))}
        brandManagerMap={brandManagerMap}
        canManageDelivery={true}
      />
    </div>
  );
}
