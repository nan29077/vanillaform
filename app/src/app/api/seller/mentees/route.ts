import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/seller/mentees
 * 내 멘티 셀러 목록 + 이번달 커미션 정보
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  if ((session.user as any).role !== "SELLER")
    return NextResponse.json({ error: "라이브 셀러만 접근 가능" }, { status: 403 });

  const mentorId = session.user.id;

  // 이번달 시작일
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // 멘티 목록 조회
  const mentees = await (prisma as any).user.findMany({
    where: { mentorId },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      sellerProfile: { select: { shopName: true, isApproved: true, slug: true } },
      // 이 멘티로부터 발생한 커미션
      menteeCommissions: {
        where: { createdAt: { gte: monthStart } },
        select: { commissionAmount: true, baseAmount: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = mentees.map((mentee: any) => {
    const thisMonthCommission = mentee.menteeCommissions.reduce(
      (sum: number, c: any) => sum + Number(c.commissionAmount),
      0
    );
    const thisMonthBase = mentee.menteeCommissions.reduce(
      (sum: number, c: any) => sum + Number(c.baseAmount),
      0
    );
    return {
      id: mentee.id,
      name: mentee.name,
      email: mentee.email,
      createdAt: mentee.createdAt.toISOString(),
      shopName: mentee.sellerProfile?.shopName ?? null,
      isApproved: mentee.sellerProfile?.isApproved ?? false,
      slug: mentee.sellerProfile?.slug ?? null,
      thisMonthCommission,
      thisMonthBase,
    };
  });

  return NextResponse.json({ mentees: result });
}
