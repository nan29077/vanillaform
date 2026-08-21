import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: 모든 셀러의 할인율/커미션율 조회
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  if (session.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "최고관리자만 접근 가능" }, { status: 403 });
  }

  const sellers = await prisma.sellerProfile.findMany({
    select: {
      id: true,
      shopName: true,
      shopLogo: true,
      slug: true,
      referralCode: true,
      referralCommissionRate: true,
      referralDiscountRate: true,
      pickDiscountRate: true,
      commissionRate: true,
      totalReferralEarnings: true,
      isApproved: true,
      _count: { select: { referredBuyers: true, followers: true, channelVerifications: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    sellers: sellers.map((s) => ({
      ...s,
      referralCommissionRate: Number(s.referralCommissionRate),
      referralDiscountRate: Number(s.referralDiscountRate),
      pickDiscountRate: Number(s.pickDiscountRate),
      commissionRate: Number(s.commissionRate),
      totalReferralEarnings: Number(s.totalReferralEarnings),
    })),
  });
}

// PATCH: 특정 셀러의 할인율/커미션율 수정
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  if (session.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "최고관리자만 접근 가능" }, { status: 403 });
  }

  const { sellerId, referralCommissionRate, referralDiscountRate, pickDiscountRate } = await req.json();
  if (!sellerId) return NextResponse.json({ error: "sellerId 필수" }, { status: 400 });

  const data: any = {};
  if (referralCommissionRate !== undefined) data.referralCommissionRate = referralCommissionRate;
  if (referralDiscountRate !== undefined) data.referralDiscountRate = referralDiscountRate;
  if (pickDiscountRate !== undefined) data.pickDiscountRate = pickDiscountRate;

  const updated = await prisma.sellerProfile.update({
    where: { id: sellerId },
    data,
    select: {
      id: true,
      shopName: true,
      referralCommissionRate: true,
      referralDiscountRate: true,
      pickDiscountRate: true,
    },
  });

  return NextResponse.json({
    seller: {
      ...updated,
      referralCommissionRate: Number(updated.referralCommissionRate),
      referralDiscountRate: Number(updated.referralDiscountRate),
      pickDiscountRate: Number(updated.pickDiscountRate),
    },
    message: "할인율이 업데이트되었습니다.",
  });
}
