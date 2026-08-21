import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { paymentMethodLabel } from "@/lib/payment";

export const dynamic = "force-dynamic";

// 발주서(구매주문서) 개별 조회 API.
// 역할별 접근 권한 및 열람 가능한 상품 범위를 서버에서 제한한다.
//  - SUPER_ADMIN : 모든 주문의 전체 상품
//  - SELLER      : 자신의 샵에서 발생한 주문의 전체 상품
//  - BRAND_ADMIN : 자신이 등록한 상품(brandId=본인)이 포함된 주문 → 자신 상품만
//  - MIDDLE_ADMIN: 본인이 직접 등록한 상품(middleAdminId=본인) + 하위 브랜드 상품(brand.middleAdminId=본인) → 해당 상품만
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const role = (session.user as any).role as string;
  const userId = session.user.id as string;

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { name: true, email: true } },
      seller: {
        select: {
          id: true,
          shopName: true,
          middleAdminId: true,
          user: { select: { name: true } },
        },
      },
      campaign: { select: { title: true } },
      items: { include: { variant: { select: { name: true } } } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
  }

  // 상품별 공급자(브랜드/중간관리자/셀러직접) 판별용 상품 정보 조회
  const productIds = [...new Set(order.items.map((i) => i.productId))];
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          thumbnail: true,
          brandId: true,
          middleAdminId: true,
          brand: { select: { brandName: true, middleAdminId: true, middleAdmin: { select: { name: true } } } },
          middleAdmin: { select: { name: true } },
        },
      })
    : [];
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  // ── 역할별 접근 권한 및 열람 가능 상품 판별 ──────────────────────────
  let canView = false;
  let visibleProductIds: Set<string> | null = null; // null = 전체 상품

  if (role === "SUPER_ADMIN") {
    canView = true;
  } else if (role === "SELLER") {
    const seller = await prisma.sellerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    canView = !!seller && seller.id === order.sellerId;
  } else if (role === "BRAND_ADMIN") {
    const brand = await prisma.brandProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (brand) {
      const ids = new Set(
        order.items
          .filter((i) => productMap[i.productId]?.brandId === brand.id)
          .map((i) => i.productId)
      );
      canView = ids.size > 0;
      visibleProductIds = ids;
    }
  } else if (role === "MIDDLE_ADMIN") {
    const middle = await prisma.middleAdminProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (middle) {
      // 본인이 직접 등록한 상품(middleAdminId=본인) + 하위 브랜드가 등록한 상품(brand.middleAdminId=본인)만 열람
      const ids = new Set(
        order.items
          .filter((i) => {
            const p = productMap[i.productId];
            return (
              p?.middleAdminId === middle.id ||
              p?.brand?.middleAdminId === middle.id
            );
          })
          .map((i) => i.productId)
      );
      canView = ids.size > 0;
      visibleProductIds = ids;
    }
  }

  if (!canView) {
    return NextResponse.json(
      { error: "발주서 열람 권한이 없습니다." },
      { status: 403 }
    );
  }

  const visibleItems = order.items.filter(
    (i) => visibleProductIds === null || visibleProductIds.has(i.productId)
  );

  const items = visibleItems.map((i) => {
    const p = productMap[i.productId];
    let supplierType = "셀러 직접";
    let supplierName = order.seller.shopName;
    // 브랜드 공급 상품이면 해당 브랜드를 관리하는 중간관리자명을 함께 표기
    let managerName: string | null = null;
    if (p?.brand) {
      supplierType = "브랜드";
      supplierName = p.brand.brandName;
      managerName = p.brand.middleAdmin?.name || null;
    } else if (p?.middleAdmin) {
      supplierType = "중간관리자";
      supplierName = p.middleAdmin.name;
    }
    return {
      id: i.id,
      productName: i.productName,
      variantName: i.variantName || i.variant?.name || null,
      quantity: i.quantity,
      price: Number(i.price),
      totalPrice: Number(i.totalPrice),
      thumbnail: p?.thumbnail || null,
      supplierType,
      supplierName,
      managerName,
    };
  });

  const itemsTotal = items.reduce((s, it) => s + it.totalPrice, 0);

  return NextResponse.json({
    poNumber: `PO-${order.orderNumber}`,
    orderNumber: order.orderNumber,
    orderDate: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() || null,
    status: order.status,
    campaignTitle: order.campaign?.title || null,
    buyer: {
      name: order.user.name || "",
      email: order.user.email || "",
      phone: order.shippingPhone || "",
      address: order.shippingAddress || "",
    },
    seller: {
      shopName: order.seller.shopName,
      sellerName: order.seller.user?.name || "",
    },
    payment: {
      totalAmount: Number(order.totalAmount),
      shippingFee: Number(order.shippingFee),
      discountAmount: Number(order.discountAmount),
      finalAmount: Number(order.finalAmount),
      method: paymentMethodLabel(order.paymentMethod),
      itemsTotal,
      // 브랜드/중간관리자는 일부 상품만 열람하므로 최종결제금액과 상품합계가 다를 수 있음
      partial: visibleProductIds !== null,
    },
    shipping: {
      name: order.shippingName || "",
      phone: order.shippingPhone || "",
      address: order.shippingAddress || "",
      memo: order.shippingMemo || "",
      shippedAt: order.shippedAt?.toISOString() || null,
    },
    items,
  });
}
