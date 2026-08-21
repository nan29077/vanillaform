import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: 셀러의 추천인 코드 및 링크 정보 조회
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const role = session.user?.role;
  if (role !== "SELLER") return NextResponse.json({ error: "라이브 셀러만 접근 가능" }, { status: 403 });

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session.user!.id },
    select: {
      id: true,
      slug: true,
      referralCode: true,
      referralCommissionRate: true,
      referralDiscountRate: true,
      pickDiscountRate: true,
      totalReferralEarnings: true,
      _count: {
        select: { referredBuyers: true, referralCommissions: true },
      },
    },
  });

  if (!seller) return NextResponse.json({ error: "라이브 셀러 프로필 없음" }, { status: 404 });

  return NextResponse.json({
    seller: {
      ...seller,
      referralCommissionRate: Number(seller.referralCommissionRate),
      referralDiscountRate: Number(seller.referralDiscountRate),
      pickDiscountRate: Number(seller.pickDiscountRate),
      totalReferralEarnings: Number(seller.totalReferralEarnings),
    },
  });
}

// POST: 추천인 코드 생성/재생성
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const role = session.user?.role;
  if (role !== "SELLER") return NextResponse.json({ error: "라이브 셀러만 접근 가능" }, { status: 403 });

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session.user!.id },
  });
  if (!seller) return NextResponse.json({ error: "라이브 셀러 프로필 없음" }, { status: 404 });

  // 이미 코드가 있으면 기존 코드 반환
  if (seller.referralCode) {
    return NextResponse.json({ referralCode: seller.referralCode });
  }

  // 코드 생성: slug 기반 + 랜덤 (예: "shopname-a3x9")
  const code = `${seller.slug}-${Math.random().toString(36).substring(2, 6)}`.toUpperCase();

  const updated = await prisma.sellerProfile.update({
    where: { id: seller.id },
    data: { referralCode: code },
  });

  return NextResponse.json({ referralCode: updated.referralCode });
}
