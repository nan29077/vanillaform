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

    // 소유권 검사 — 셀러라면 누구나 id 만 바꿔서 남의 주문서를 입금확인 처리하고
    // (남의) 상품 재고를 깎을 수 있었다. 삭제(DELETE) 라우트와 동일하게 sellerId 로 묶는다.
    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user.id as string },
      select: { id: true },
    });
    if (!seller) {
      return NextResponse.json({ error: "셀러 정보를 찾을 수 없습니다." }, { status: 403 });
    }

    const order = await prisma.socialOrder.findUnique({
      where: { id: orderId },
      select: { id: true, sellerId: true, productId: true, quantity: true, status: true },
    });

    if (!order) {
      return NextResponse.json({ error: "소셜주문서를 찾을 수 없습니다." }, { status: 404 });
    }

    if (order.sellerId !== seller.id) {
      return NextResponse.json(
        { error: "본인 샵의 주문서만 입금 확인할 수 있습니다." },
        { status: 403 },
      );
    }

    if (order.status === "CONFIRMED") {
      return NextResponse.json({ error: "이미 입금 확인된 주문서입니다." }, { status: 400 });
    }

    const quantity = Number(order.quantity) || 1;

    // 재고 차감 (0 미만 불가) + status 업데이트 트랜잭션.
    // status 전이를 조건부 updateMany 로 **먼저** 수행하고, 전이에 성공한 호출만 재고를 깎는다.
    // (더블클릭·중복 요청으로 같은 주문서의 재고가 두 번 차감되던 문제 방지)
    const applied = await prisma.$transaction(async (tx) => {
      const flipped = await tx.socialOrder.updateMany({
        where: { id: orderId, sellerId: seller.id, status: { not: "CONFIRMED" } },
        data: { status: "CONFIRMED" },
      });
      if (flipped.count !== 1) return false;

      await tx.$executeRawUnsafe(
        `UPDATE products SET totalStock = GREATEST(0, totalStock - ?) WHERE id = ?`,
        quantity,
        String(order.productId)
      );
      return true;
    });

    if (!applied) {
      return NextResponse.json({ error: "이미 입금 확인된 주문서입니다." }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[confirm-payment POST]", e?.message || e);
    return NextResponse.json({ error: "입금 확인 처리에 실패했습니다." }, { status: 500 });
  }
}
