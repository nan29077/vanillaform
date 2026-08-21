import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanupStalePendingOrders, VISIBLE_ORDER_FILTER } from "@/lib/orderCleanup";
import { parseSnsAccounts } from "@/lib/utils";
import { buildOrderFeeInfoMap } from "@/lib/orderFee";
import OrderManagementClient from "@/components/shared/OrderManagementClient";

export const dynamic = "force-dynamic";

export default async function BrandOrdersPage() {
  const session = await auth();
  if (session?.user?.role !== "BRAND_ADMIN") redirect("/");

  const brand = await prisma.brandProfile.findUnique({
    where: { userId: session!.user!.id },
    include: { products: { select: { id: true } } },
  });
  if (!brand) redirect("/");

  // 방치된 미결제 주문 정리 (이탈 PENDING 이 목록·DB 에 남지 않도록)
  await cleanupStalePendingOrders().catch(() => {});

  const productIds = brand.products.map((p) => p.id);
  const orders = await prisma.order.findMany({
    where: {
      // 미결제 PENDING + 결제 전 이탈한 CANCELLED(pgTid 없음) 제외
      ...VISIBLE_ORDER_FILTER,
      items: { some: { productId: { in: productIds } } },
    },
    include: {
      user: { select: { name: true, email: true } },
      seller: { select: { id: true, shopName: true } },
      items: {
        where: { productId: { in: productIds } },
        include: { variant: { select: { name: true } } },
      },
      campaign: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // 상품 썸네일 매핑 (브랜드 상품만)
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, thumbnail: true },
  });
  const productThumbMap = Object.fromEntries(products.map((p) => [p.id, p.thumbnail]));

  // Get sellers who sell this brand's products
  const sellerIds = [...new Set(orders.map(o => o.seller.id))];
  const sellers = await prisma.sellerProfile.findMany({
    where: { id: { in: sellerIds } },
    select: { id: true, shopName: true },
  });

  // 주문별 정산 수수료 안내(브랜드 공급자 관점) 계산 — 본인 공급 상품만
  const feeMap = await buildOrderFeeInfoMap({
    viewpoint: "SUPPLIER",
    supplierBrandId: brand.id,
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

  const serialized = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    userName: o.user.name || "",
    userEmail: o.user.email,
    sellerName: o.seller.shopName,
    sellerId: o.seller.id,
    brandName: brand.brandName,
    brandId: brand.id,
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
    })),
    feeInfo: feeMap[o.id] ?? null,
    deliveryStatus: (o as any).deliveryStatus || null,
    deliveryCourier: (o as any).deliveryCourier || null,
    deliveryTracking: (o as any).deliveryTracking || null,
    deliveryUpdatedAt: (o as any).deliveryUpdatedAt?.toISOString() || null,
    paymentStatus: o.paymentStatus,
    cancelStatus: (o as any).cancelStatus || null,
    cancelType: (o as any).cancelType || null,
    cancelAmount: (o as any).cancelAmount != null ? Number((o as any).cancelAmount) : null,
    cancelFromSettlement: (o as any).cancelFromSettlement ?? false,
  }));

  const serializedSellers = sellers.map((s) => ({ id: s.id, name: s.shopName }));

  return (
    <div className="animate-fade-in">
      <OrderManagementClient
        orders={serialized}
        sellers={serializedSellers}
        brands={[{ id: brand.id, name: brand.brandName }]}
        role="BRAND_ADMIN"
        canManageDelivery={true}
      />
    </div>
  );
}
