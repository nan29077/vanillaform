import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 셀러가 직접 설정하는 최초의 할인율 — 상한을 서버에서 강제한다 (실수/악용 방지)
const MAX_RATE = 20; // 할인율 상한(%)

// GET: 장바구니 할인 설정 조회 (셀러 본인)
export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    if (session.user.role !== "SELLER") {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
      select: {
        cartDiscountEnabled: true,
        cartDiscountThreshold: true,
        cartDiscountRate: true,
      },
    });
    if (!seller) return NextResponse.json({ error: "셀러 프로필이 없습니다" }, { status: 404 });

    return NextResponse.json({
      enabled: seller.cartDiscountEnabled,
      threshold: Number(seller.cartDiscountThreshold),
      rate: Number(seller.cartDiscountRate),
      maxRate: MAX_RATE,
    });
  } catch (e) {
    console.error("Seller cart-discount GET error:", e);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

// PUT: 장바구니 할인 설정 수정 (스위치 · 기준금액 · 할인율)
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    if (session.user.role !== "SELLER") {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
      select: { id: true },
    });
    if (!seller) return NextResponse.json({ error: "셀러 프로필이 없습니다" }, { status: 404 });

    const body = await req.json();
    const enabled = body.enabled === true;
    const threshold = Number(body.threshold);
    const rate = Number(body.rate);

    if (!Number.isFinite(threshold) || !Number.isInteger(threshold) || threshold < 0) {
      return NextResponse.json({ error: "기준금액은 0 이상의 정수여야 합니다." }, { status: 400 });
    }
    if (!Number.isFinite(rate) || rate < 0 || rate > MAX_RATE) {
      return NextResponse.json(
        { error: `할인율은 0~${MAX_RATE}% 범위로 설정할 수 있습니다.` },
        { status: 400 }
      );
    }
    if (enabled && (threshold <= 0 || rate <= 0)) {
      return NextResponse.json(
        { error: "할인을 켜려면 기준금액과 할인율을 먼저 입력해주세요." },
        { status: 400 }
      );
    }

    await prisma.sellerProfile.update({
      where: { id: seller.id },
      data: {
        cartDiscountEnabled: enabled,
        cartDiscountThreshold: threshold,
        cartDiscountRate: rate,
      },
    });

    return NextResponse.json({ success: true, enabled, threshold, rate });
  } catch (e) {
    console.error("Seller cart-discount PUT error:", e);
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}
