import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanupStalePendingOrders, VISIBLE_ORDER_FILTER } from "@/lib/orderCleanup";
import { parseSnsAccounts } from "@/lib/utils";
import { buildOrderFeeInfoMap } from "@/lib/orderFee";
import OrderManagementClient from "@/components/shared/OrderManagementClient";

export const dynamic = "force-dynamic";

// 중간관리자 주문: 자신이 등록시킨 셀러의 주문 + 자신이 등록시킨 브랜드사 상품이 포함된 주문.
export default async function MiddleOrdersPage() {
  const session = await auth();
  if (session?.user?.role !== "MIDDLE_ADMIN") redirect("/");

  const middle = await prisma.middleAdminProfile.findUnique({
    where: { userId: session!.user!.id },
    include: {
      sellers: { select: { id: true, shopName: true } },
      brands: { select: { id: true, brandName: true, products: { select: { id: true } } } },
    },
  });
  if (!middle) redirect("/");

  await cleanupStalePendingOrders().catch(() => {});

  const sellerIds = middle.sellers.map((s) => s.id);
  const brandProductIds = middle.brands.flatMap((b) => b.products.map((p) => p.id));

  const orders = await prisma.order.findMany({
    where: {
      ...VISIBLE_ORDER_FILTER,
      OR: [
        ...(sellerIds.length ? [{ sellerId: { in: sellerIds } }] : []),
        ...(brandProductIds.length ? [{ items: { some: { productId: { in: brandProductIds } } } }] : []),
        // 소속 셀러/브랜드가 없으면 아무 주문도 보이지 않도록 빈 결과 보장
        ...(!sellerIds.length && !brandProductIds.length ? [{ id: "__none__" }] : []),
      ],
    },
    include: {
      user: { select: { name: true, email: true } },
      seller: { select: { id: true, shopName: true } },
      items: { include: { variant: { select: { name: true } } } },
      campaign: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // 썸네일 매핑
  const allProductIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId)))];
  const products = await prisma.product.findMany({
    where: { id: { in: allProductIds } },
    select: {
      id: true, thumbnail: true, middleAdminId: true,
      brand: { select: { id: true, brandName: true, middleAdminId: true } },
    },
  });
  const thumbMap = Object.fromEntries(products.map((p) => [p.id, p.thumbnail]));
  const brandMap = Object.fromEntries(products.map((p) => [p.id, p.brand]));
  // 발주서 구분 필터용 상품 공급자 메타
  const productMetaMap = Object.fromEntries(
    products.map((p) => [p.id, {
      productMiddleAdminId: p.middleAdminId ?? null,
      brandId: p.brand?.id ?? null,
      brandMiddleAdminId: p.brand?.middleAdminId ?? null,
    }])
  );

  // 주문별 정산 수수료 안내(중간관리자 공급자 관점) 계산 — 본인 공급 상품만
  const feeMap = await buildOrderFeeInfoMap({
    viewpoint: "SUPPLIER",
    supplierMiddleId: middle.id,
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
        productMiddleAdminId: productMetaMap[i.productId]?.productMiddleAdminId ?? null,
        brandId: productMetaMap[i.productId]?.brandId ?? null,
        brandMiddleAdminId: productMetaMap[i.productId]?.brandMiddleAdminId ?? null,
      })),
      canViewDetail: true,
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
    };
  });

  return (
    <div className="animate-fade-in">
      <OrderManagementClient
        orders={serialized}
        role="SUPER_ADMIN"
        sellers={middle.sellers.map((s) => ({ id: s.id, name: s.shopName }))}
        brands={middle.brands.map((b) => ({ id: b.id, name: b.brandName }))}
        poFilter="middle"
        currentMiddleId={middle.id}
        canManageDelivery={true}
      />
    </div>
  );
}
