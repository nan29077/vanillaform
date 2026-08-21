import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanupStalePendingOrders, VISIBLE_ORDER_FILTER } from "@/lib/orderCleanup";
import { parseSnsAccounts } from "@/lib/utils";
import { buildOrderFeeInfoMap } from "@/lib/orderFee";
import SellerOrdersTabs from "@/components/shared/SellerOrdersTabs";

export const dynamic = "force-dynamic";

export default async function SellerOrdersPage() {
  const session = await auth();
  if (session?.user?.role !== "SELLER") redirect("/");

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session!.user!.id },
  });
  if (!seller) redirect("/");

  // 방치된 미결제 주문 정리 (이탈 PENDING 이 목록·DB 에 남지 않도록)
  await cleanupStalePendingOrders().catch(() => {});

  const orders = await prisma.order.findMany({
    // 미결제 PENDING + 결제 전 이탈한 CANCELLED(pgTid 없음) 제외 — 실제 결제 흔적 있는 건만 노출
    where: { ...VISIBLE_ORDER_FILTER, sellerId: seller.id },
    include: {
      user: { select: { name: true, email: true } },
      items: { include: { variant: { select: { name: true } } } },
      campaign: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // 장바구니: 이 셀러의 상품을 담아둔(아직 구매 전) 항목
  const cartItems = await prisma.cartItem.findMany({
    where: { sellerId: seller.id },
    include: {
      user: { select: { name: true, email: true } },
      variant: { select: { name: true, price: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // 상품 썸네일/이름 매핑 (OrderItem·CartItem 에 product relation 이 없어 별도 조회)
  const productIds = [
    ...new Set([
      ...orders.flatMap((o) => o.items.map((i) => i.productId)),
      ...cartItems.map((c) => c.productId),
    ]),
  ];
  const products = productIds.length
    ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, thumbnail: true, basePrice: true } })
    : [];
  const productThumbMap = Object.fromEntries(products.map((p) => [p.id, p.thumbnail]));
  const productNameMap = Object.fromEntries(products.map((p) => [p.id, p.name]));
  const productPriceMap = Object.fromEntries(products.map((p) => [p.id, Number(p.basePrice)]));

  // 주문별 정산 수수료 안내(셀러 관점) 계산
  const feeMap = await buildOrderFeeInfoMap({
    viewpoint: "SELLER",
    contextSellerId: seller.id,
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

  const serializedCart = cartItems.map((c) => ({
    id: c.id,
    userId: c.userId,
    userName: c.user.name || "",
    userEmail: c.user.email,
    productName: productNameMap[c.productId] || "(삭제된 상품)",
    variantName: c.variant?.name || null,
    quantity: c.quantity,
    price: c.variant?.price != null ? Number(c.variant.price) : (productPriceMap[c.productId] ?? 0),
    thumbnail: productThumbMap[c.productId] || null,
    createdAt: c.createdAt.toISOString(),
  }));

  const serialized = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    userName: o.user.name || "",
    userEmail: o.user.email,
    sellerName: seller.shopName,
    sellerId: seller.id,
    brandName: null as string | null,
    brandId: null as string | null,
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
    thumbnail: null as string | null,
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      variantName: i.variantName || i.variant?.name || null,
      price: Number(i.price),
      quantity: i.quantity,
      totalPrice: Number(i.totalPrice),
      thumbnail: null as string | null,
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

  return (
    <div className="animate-fade-in">
      <SellerOrdersTabs
        orders={serialized}
        sellerId={seller.id}
        sellerName={seller.shopName}
        cartItems={serializedCart}
      />
    </div>
  );
}
