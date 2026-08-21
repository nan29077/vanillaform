import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 해당 라이브가 요청 셀러의 소유인지 검증 후 셀러 프로필/라이브 반환
async function resolveOwnedLive(liveId: string) {
  const session = await auth();
  if (!session || session.user?.role !== "SELLER") {
    return { error: NextResponse.json({ error: "라이브 셀러만 가능" }, { status: 403 }) };
  }
  const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user!.id } });
  if (!seller) {
    return { error: NextResponse.json({ error: "라이브 셀러 프로필 없음" }, { status: 404 }) };
  }
  const live = await prisma.liveStream.findUnique({ where: { id: liveId } });
  if (!live || live.sellerId !== seller.id) {
    return { error: NextResponse.json({ error: "권한 없음" }, { status: 403 }) };
  }
  return { seller, live };
}

function generateCouponCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// GET /api/seller/live/[id]/coupon — 해당 라이브의 쿠폰 목록
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveOwnedLive(params.id);
  if ("error" in resolved) return resolved.error;

  const coupons = await prisma.liveCoupon.findMany({
    where: { liveStreamId: params.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    coupons: coupons.map(c => ({
      ...c,
      discountValue: Number(c.discountValue),
      minOrderAmount: c.minOrderAmount ? Number(c.minOrderAmount) : null,
    })),
  });
}

// POST /api/seller/live/[id]/coupon — 쿠폰 생성
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveOwnedLive(params.id);
  if ("error" in resolved) return resolved.error;

  const body = await req.json();

  const discountType = body.discountType === "AMOUNT" ? "AMOUNT" : "PERCENT";
  const discountValue = parseFloat(body.discountValue);
  if (!discountValue || discountValue <= 0) {
    return NextResponse.json({ error: "할인 값을 입력하세요." }, { status: 400 });
  }
  if (discountType === "PERCENT" && discountValue > 100) {
    return NextResponse.json({ error: "정률 할인은 100%를 초과할 수 없습니다." }, { status: 400 });
  }

  // 쿠폰 코드: 수동 입력 없으면 자동 생성. 중복 시 재생성.
  let code = typeof body.code === "string" && body.code.trim().length > 0
    ? body.code.trim().toUpperCase()
    : generateCouponCode();
  const manualCode = typeof body.code === "string" && body.code.trim().length > 0;
  let guard = 0;
  while (await prisma.liveCoupon.findUnique({ where: { code } })) {
    if (manualCode) {
      return NextResponse.json({ error: "이미 사용 중인 쿠폰 코드입니다." }, { status: 409 });
    }
    code = generateCouponCode();
    if (++guard > 10) break;
  }

  const coupon = await prisma.liveCoupon.create({
    data: {
      liveStreamId: params.id,
      code,
      discountType,
      discountValue,
      validDays: body.validDays != null && parseInt(body.validDays) > 0 ? parseInt(body.validDays) : 7,
      maxCount: body.maxCount != null && parseInt(body.maxCount) > 0 ? parseInt(body.maxCount) : null,
      minOrderAmount: body.minOrderAmount != null && parseFloat(body.minOrderAmount) > 0 ? parseFloat(body.minOrderAmount) : null,
    },
  });

  return NextResponse.json({
    coupon: {
      ...coupon,
      discountValue: Number(coupon.discountValue),
      minOrderAmount: coupon.minOrderAmount ? Number(coupon.minOrderAmount) : null,
    },
  });
}
