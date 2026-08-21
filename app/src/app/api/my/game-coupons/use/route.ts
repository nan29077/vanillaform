import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST: 게임 쿠폰 사용 처리 { code, orderId }
// 해당 셀러 샵의 주문에만 사용 가능. 주문 POST 에서 자동 처리되지만,
// 별도 사용 확정이 필요한 흐름을 위해 제공한다.
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    if (!code) return NextResponse.json({ error: "쿠폰 코드를 입력해주세요." }, { status: 400 });

    const coupon = await prisma.userGameCoupon.findUnique({ where: { code } });
    if (!coupon || coupon.userId !== session.user.id) {
      return NextResponse.json({ error: "유효하지 않은 쿠폰입니다." }, { status: 404 });
    }
    if (coupon.usedAt) return NextResponse.json({ error: "이미 사용한 쿠폰입니다." }, { status: 400 });
    if (coupon.expiresAt < new Date()) return NextResponse.json({ error: "만료된 쿠폰입니다." }, { status: 400 });

    // 주문 검증 — 본인 주문 + 쿠폰 발급 셀러 샵과 동일해야 함
    if (orderId) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { userId: true, sellerId: true },
      });
      if (!order || order.userId !== session.user.id) {
        return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
      }
      if (order.sellerId !== coupon.sellerId) {
        return NextResponse.json({ error: "이 셀러 샵에서는 사용할 수 없는 쿠폰입니다." }, { status: 400 });
      }
    }

    await prisma.userGameCoupon.update({
      where: { id: coupon.id },
      data: { usedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Use game coupon error:", error);
    return NextResponse.json({ error: "쿠폰 사용 처리 실패" }, { status: 500 });
  }
}
