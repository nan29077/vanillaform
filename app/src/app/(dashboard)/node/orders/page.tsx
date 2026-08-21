import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanupStalePendingOrders, VISIBLE_ORDER_FILTER } from "@/lib/orderCleanup";
import { parseSnsAccounts } from "@/lib/utils";
import OrderManagementClient from "@/components/shared/OrderManagementClient";

export const dynamic = "force-dynamic";

export default async function NodeOrdersPage() {
  const session = await auth();
  if ((session?.user as any)?.role !== "NODE") redirect("/");

  await cleanupStalePendingOrders().catch(() => {});

  const orders = await prisma.order.findMany({
    where: { ...VISIBLE_ORDER_FILTER },
    include: {
      user: { select: { name: true, email: true } },
      seller: { select: { id: true, shopName: true } },
      items: { include: { variant: { select: { name: true } } } },
      campaign: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const allProductIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId)))];
  const products = await prisma.product.findMany({
    where: { id: { in: allProductIds } },
    select: {
      id: true, thumbnail: true,
      brand: { select: { id: true, brandName: true } },
    },
  });
  const thumbMap = Object.fromEntries(products.map((p) => [p.id, p.thumbnail]));
  const brandMap = Object.fromEntries(products.map((p) => [p.id, p.brand]));

  const sellers = await prisma.sellerProfile.findMany({
    select: { id: true, shopName: true },
    orderBy: { shopName: "asc" },
  });
  const brands = await prisma.brandProfile.findMany({
    select: { id: true, brandName: true },
    orderBy: { brandName: "asc" },
  });

  const serialized = orders.map((o) => {
    const firstBrand = o.items.map((i) => brandMap[i.productId]).find(Boolean) || null;
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
      thumbnail: o.items.length ? thumbMap[o.items[0].productId] || null : null,
      items: o.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.productName,
        variantName: i.variantName || i.variant?.name || null,
        price: Number(i.price),
        quantity: i.quantity,
        totalPrice: Number(i.totalPrice),
        thumbnail: thumbMap[i.productId] || null,
        productMiddleAdminId: null,
        brandId: brandMap[i.productId]?.id ?? null,
        brandMiddleAdminId: null,
      })),
      canViewDetail: true,
      feeInfo: null,
      deliveryStatus: (o as any).deliveryStatus || null,
      deliveryCourier: (o as any).deliveryCourier || null,
      deliveryTracking: (o as any).deliveryTracking || null,
      deliveryUpdatedAt: (o as any).deliveryUpdatedAt?.toISOString() || null,
    };
  });

  return (
    <div className="animate-fade-in">
      <OrderManagementClient
        orders={serialized}
        role="SUPER_ADMIN"
        sellers={sellers.map((s) => ({ id: s.id, name: s.shopName }))}
        brands={brands.map((b) => ({ id: b.id, name: b.brandName }))}
        canManageDelivery={true}
      />
    </div>
  );
}
