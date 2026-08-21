import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateUniqueSellerReferralCode } from "@/lib/mentorReferral";

/**
 * GET /api/seller/mentee-referral
 * 셀러의 가입 추천인코드 및 추천인링크 조회.
 * 없으면 자동 발급.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  if ((session.user as any).role !== "SELLER")
    return NextResponse.json({ error: "라이브 셀러만 접근 가능" }, { status: 403 });

  const user = await (prisma as any).user.findUnique({
    where: { id: session.user.id },
    select: { id: true, sellerReferralCode: true },
  });
  if (!user) return NextResponse.json({ error: "사용자 없음" }, { status: 404 });

  let code: string = user.sellerReferralCode;

  // 코드가 없으면 자동 발급
  if (!code) {
    code = await generateUniqueSellerReferralCode(prisma);
    await (prisma as any).user.update({
      where: { id: user.id },
      data: { sellerReferralCode: code },
    });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "";
  const referralLink = `${siteUrl}/auth/register?role=SELLER&sellerRef=${code}`;

  return NextResponse.json({ code, referralLink });
}
