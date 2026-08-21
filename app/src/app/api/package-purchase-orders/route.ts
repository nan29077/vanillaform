import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 역할별 패키지 발주서 목록 조회
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const role = (session.user as any).role as string;
  const userId = session.user.id as string;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let purchaseOrders: any[] = [];

  if (role === "SUPER_ADMIN") {
    // 전체 발주서
    purchaseOrders = await prisma.packagePurchaseOrder.findMany({
      where: status ? { status } : {},
      include: {
        packageOrderItem: {
          include: {
            package: {
              select: { id: true, name: true, packagePrice: true },
            },
          },
        },
        recipient: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } else if (role === "BRAND_ADMIN") {
    // 본인 브랜드 상품이 포함된 발주서
    purchaseOrders = await prisma.packagePurchaseOrder.findMany({
      where: {
        recipientId: userId,
        recipientType: "BRAND",
        ...(status ? { status } : {}),
      },
      include: {
        packageOrderItem: {
          include: {
            package: {
              select: { id: true, name: true, packagePrice: true },
            },
          },
        },
        recipient: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } else if (role === "SELLER" || role === "MIDDLE_ADMIN") {
    // 본인이 등록한 패키지의 발주서 (CREATOR 타입) + 본인 수신 발주서
    purchaseOrders = await prisma.packagePurchaseOrder.findMany({
      where: {
        recipientId: userId,
        ...(status ? { status } : {}),
      },
      include: {
        packageOrderItem: {
          include: {
            package: {
              select: { id: true, name: true, packagePrice: true },
            },
          },
        },
        recipient: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } else {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  return NextResponse.json({
    purchaseOrders: purchaseOrders.map((po) => ({
      ...po,
      amount: Number(po.amount),
      packageOrderItem: {
        ...po.packageOrderItem,
        packagePrice: Number(po.packageOrderItem.packagePrice),
        package: {
          ...po.packageOrderItem.package,
          packagePrice: Number(po.packageOrderItem.package.packagePrice),
        },
      },
    })),
  });
}
