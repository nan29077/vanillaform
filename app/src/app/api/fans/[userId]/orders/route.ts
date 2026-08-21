import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VISIBLE_ORDER_FILTER } from "@/lib/orderCleanup";

export const dynamic = "force-dynamic";

// 팬(구매회원)의 구매내역 조회.
// - SUPER_ADMIN: 해당 회원의 모든 주문
// - SELLER: 자기 샵에서 발생한 해당 회원의 주문만 (타 셀러 주문은 비노출)
export async function GET(
  _req: Request,
  { params }: { params: { userId: string } }
) {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "SUPER_ADMIN" && role !== "SELLER")) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const where: any = { ...VISIBLE_ORDER_FILTER, userId: params.userId };

  if (role === "SELLER") {
    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!seller) {
      return NextResponse.json({ error: "라이브 셀러 프로필이 없습니다." }, { status: 403 });
    }
    where.sellerId = seller.id;
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      seller: { select: { shopName: true } },
      items: { include: { variant: { select: { name: true } } } },
      campaign: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // 상품 썸네일 매핑 (OrderItem 에 product relation 이 없어 별도 조회)
  const productIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId)))];
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, thumbnail: true },
      })
    : [];
  const thumbMap = Object.fromEntries(products.map((p) => [p.id, p.thumbnail]));

  const serialized = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    sellerName: o.seller.shopName,
    status: o.status,
    paymentMethod: o.paymentMethod,
    finalAmount: Number(o.finalAmount),
    totalAmount: Number(o.totalAmount),
    shippingFee: Number(o.shippingFee),
    discountAmount: Number(o.discountAmount),
    campaignTitle: o.campaign?.title || null,
    createdAt: o.createdAt.toISOString(),
    paidAt: o.paidAt?.toISOString() || null,
    thumbnail: o.items.length ? thumbMap[o.items[0].productId] || null : null,
    items: o.items.map((i) => ({
      id: i.id,
      productName: i.productName,
      variantName: i.variantName || i.variant?.name || null,
      price: Number(i.price),
      quantity: i.quantity,
      totalPrice: Number(i.totalPrice),
      thumbnail: thumbMap[i.productId] || null,
    })),
  }));

  const summary = {
    orderCount: serialized.length,
    totalSpent: serialized
      .filter((o) => ["PAID", "CONFIRMED", "SHIPPING", "DELIVERED"].includes(o.status))
      .reduce((s, o) => s + o.finalAmount, 0),
  };

  return NextResponse.json({ orders: serialized, summary });
}
