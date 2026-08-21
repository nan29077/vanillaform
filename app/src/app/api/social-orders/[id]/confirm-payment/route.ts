import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST: 소셜주문서 입금 확인 → status = CONFIRMED, 재고 차감
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    if ((session.user as any).role !== "SELLER") {
      return NextResponse.json({ error: "셀러만 입금 확인을 처리할 수 있습니다." }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(params);
    const orderId = resolvedParams.id;

    const order = await prisma.socialOrder.findUnique({
      where: { id: orderId },
      select: { id: true, productId: true, quantity: true, status: true },
    });

    if (!order) {
      return NextResponse.json({ error: "소셜주문서를 찾을 수 없습니다." }, { status: 404 });
    }

    if (order.status === "CONFIRMED") {
      return NextResponse.json({ error: "이미 입금 확인된 주문서입니다." }, { status: 400 });
    }

    const quantity = Number(order.quantity) || 1;

    // 재고 차감 (0 미만 불가) + status 업데이트 트랜잭션
    await prisma.$transaction(async (tx) => {
      // 재고 차감
      await tx.$executeRawUnsafe(
        `UPDATE products SET totalStock = GREATEST(0, totalStock - ?) WHERE id = ?`,
        quantity,
        String(order.productId)
      );

      await tx.socialOrder.update({
        where: { id: orderId },
        data: { status: "CONFIRMED" },
      });
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[confirm-payment POST]", e?.message || e);
    return NextResponse.json({ error: "입금 확인 처리에 실패했습니다." }, { status: 500 });
  }
}
