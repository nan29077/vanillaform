import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/coupons/validate?code=XXX&totalAmount=NNN
// 라이브 쿠폰 유효성 검사 — 로그인 사용자가 결제 전 쿠폰 코드를 확인할 때 호출
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ valid: false, error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.trim().toUpperCase();
  const totalAmount = parseFloat(searchParams.get("totalAmount") || "0");
  const sellerId = searchParams.get("sellerId")?.trim() || null;

  if (!code) {
    return NextResponse.json({ valid: false, error: "쿠폰 코드를 입력해주세요." });
  }

  const coupon = await prisma.liveCoupon.findUnique({
    where: { code },
    include: { liveStream: { select: { endedAt: true, status: true } } },
  });

  if (!coupon) {
    // 라이브 쿠폰이 아니면 게임 당첨 쿠폰인지 확인
    const gameUserCoupon = await prisma.userGameCoupon.findUnique({
      where: { code },
      include: { gameCoupon: { select: { discountType: true, discountValue: true, minOrderAmount: true } } },
    });
    if (gameUserCoupon && gameUserCoupon.userId === session.user!.id) {
      if (gameUserCoupon.usedAt) {
        return NextResponse.json({ valid: false, error: "이미 사용한 쿠폰입니다." });
      }
      if (gameUserCoupon.expiresAt < new Date()) {
        return NextResponse.json({ valid: false, error: "만료된 쿠폰입니다." });
      }
      if (sellerId && gameUserCoupon.sellerId !== sellerId) {
        return NextResponse.json({ valid: false, error: "이 셀러 샵에서는 사용할 수 없는 쿠폰입니다." });
      }
      const gc = gameUserCoupon.gameCoupon;
      const minOrder = Number(gc?.minOrderAmount ?? 0);
      if (minOrder > 0 && totalAmount < minOrder) {
        return NextResponse.json({
          valid: false,
          error: `최소 주문금액 ${minOrder.toLocaleString()}원 이상 주문 시 사용 가능합니다.`,
        });
      }
      let gDiscount = 0;
      if (gc?.discountType === "PERCENT") {
        gDiscount = Math.round((totalAmount * Number(gc.discountValue)) / 100);
      } else {
        gDiscount = Math.min(Number(gc?.discountValue ?? 0), totalAmount);
      }
      return NextResponse.json({
        valid: true,
        source: "game",
        coupon: {
          code: gameUserCoupon.code,
          discountType: gc?.discountType ?? "PERCENT",
          discountValue: Number(gc?.discountValue ?? 0),
          minOrderAmount: minOrder || null,
        },
        discountAmount: gDiscount,
      });
    }
    return NextResponse.json({ valid: false, error: "유효하지 않은 쿠폰 코드입니다." });
  }

  // 만료 여부: 라이브 종료 후 validDays 일 경과 시 만료
  if (coupon.liveStream.endedAt) {
    const expiry = new Date(coupon.liveStream.endedAt);
    expiry.setDate(expiry.getDate() + coupon.validDays);
    if (expiry < new Date()) {
      return NextResponse.json({ valid: false, error: "만료된 쿠폰입니다." });
    }
  }

  // 이미 사용 여부
  const userCoupon = await prisma.userCoupon.findUnique({
    where: { liveCouponId_userId: { liveCouponId: coupon.id, userId: session.user!.id } },
  });

  if (userCoupon?.usedAt) {
    return NextResponse.json({ valid: false, error: "이미 사용한 쿠폰입니다." });
  }

  // 수량 체크 (이미 수령한 경우 수량 제한 무시)
  if (!userCoupon && coupon.maxCount !== null && coupon.issuedCount >= coupon.maxCount) {
    return NextResponse.json({ valid: false, error: "쿠폰 수량이 소진되었습니다." });
  }

  // 최소 주문금액 체크
  if (coupon.minOrderAmount !== null && totalAmount < Number(coupon.minOrderAmount)) {
    return NextResponse.json({
      valid: false,
      error: `최소 주문금액 ${Number(coupon.minOrderAmount).toLocaleString()}원 이상 주문 시 사용 가능합니다.`,
    });
  }

  // 할인 금액 계산
  let discountAmount = 0;
  if (coupon.discountType === "PERCENT") {
    discountAmount = Math.round(totalAmount * Number(coupon.discountValue) / 100);
  } else {
    discountAmount = Math.min(Number(coupon.discountValue), totalAmount);
  }

  return NextResponse.json({
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      minOrderAmount: coupon.minOrderAmount ? Number(coupon.minOrderAmount) : null,
      validDays: coupon.validDays,
    },
    discountAmount,
  });
}
