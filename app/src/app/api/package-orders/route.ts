import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 패키지 상품 주문 생성 (결제 전 주문 생성 단계)
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json();
  const { packageId, quantity, buyerName, buyerPhone, buyerAddress, buyerMemo } = body;

  if (!packageId || !quantity) {
    return NextResponse.json({ error: "필수 정보가 누락됐습니다." }, { status: 400 });
  }

  const pkg = await prisma.packageProduct.findUnique({
    where: { id: packageId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              brand: { select: { id: true, userId: true } },
            },
          },
        },
      },
      creator: { select: { id: true } },
    },
  });

  if (!pkg) {
    return NextResponse.json({ error: "패키지 상품을 찾을 수 없습니다." }, { status: 404 });
  }

  if (pkg.status !== "APPROVED") {
    return NextResponse.json({ error: "승인된 패키지 상품만 구매할 수 있습니다." }, { status: 400 });
  }

  if (pkg.stock < quantity) {
    return NextResponse.json({ error: "재고가 부족합니다." }, { status: 400 });
  }

  // 주문 생성 및 발주서 자동 생성 (트랜잭션)
  const result = await prisma.$transaction(async (tx) => {
    // 1. 패키지 주문 아이템 생성
    const orderItem = await tx.packageOrderItem.create({
      data: {
        orderId: `PKG-${Date.now()}`, // 임시 orderId (실결제 연동 시 교체)
        packageId,
        quantity,
        packagePrice: pkg.packagePrice,
        buyerName,
        buyerPhone,
        buyerAddress,
        buyerMemo,
        status: "PENDING",
      },
    });

    // 2. 재고 차감
    await tx.packageProduct.update({
      where: { id: packageId },
      data: { stock: { decrement: quantity } },
    });

    // 3. 발주서 생성: 각 구성 브랜드에 하나씩
    const purchaseOrderData: {
      packageOrderItemId: string;
      recipientId: string;
      recipientType: string;
      productId: string | null;
      productName: string | null;
      amount: number;
      status: string;
    }[] = [];

    for (const item of pkg.items) {
      if (item.product.brand?.userId) {
        purchaseOrderData.push({
          packageOrderItemId: orderItem.id,
          recipientId: item.product.brand.userId,
          recipientType: "BRAND",
          productId: item.product.id,
          productName: item.product.name,
          amount: Number(item.unitPrice) * quantity,
          status: "PENDING",
        });
      }
    }

    // 4. 패키지 등록자에게도 발주서 (CREATOR) — 패키지 판매가 전체
    purchaseOrderData.push({
      packageOrderItemId: orderItem.id,
      recipientId: pkg.creatorId,
      recipientType: "CREATOR",
      productId: null,
      productName: null,
      amount: Number(pkg.packagePrice) * quantity,
      status: "PENDING",
    });

    if (purchaseOrderData.length > 0) {
      await tx.packagePurchaseOrder.createMany({ data: purchaseOrderData });
    }

    return orderItem;
  });

  return NextResponse.json({
    orderItemId: result.id,
    packagePrice: Number(pkg.packagePrice),
    quantity,
    totalAmount: Number(pkg.packagePrice) * quantity,
  }, { status: 201 });
}
