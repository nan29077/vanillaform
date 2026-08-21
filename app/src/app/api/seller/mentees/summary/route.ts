import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/seller/mentees/summary?period=day|week|month
 * 멘토 커미션 합계 (기간별)
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  if ((session.user as any).role !== "SELLER")
    return NextResponse.json({ error: "라이브 셀러만 접근 가능" }, { status: 403 });

  const period = req.nextUrl.searchParams.get("period") || "month";
  const mentorId = session.user.id;

  const now = new Date();
  let periodStart: Date;
  if (period === "day") {
    periodStart = new Date(now); periodStart.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    periodStart = new Date(now);
    periodStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    periodStart.setHours(0, 0, 0, 0);
  } else {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const commissions = await (prisma as any).mentorCommission.findMany({
    where: { mentorId, createdAt: { gte: periodStart } },
    select: { commissionAmount: true, baseAmount: true, createdAt: true },
  });

  const total = commissions.reduce(
    (sum: number, c: any) => sum + Number(c.commissionAmount),
    0
  );
  const totalBase = commissions.reduce(
    (sum: number, c: any) => sum + Number(c.baseAmount),
    0
  );

  // 전체 누적
  const allTime = await (prisma as any).mentorCommission.aggregate({
    where: { mentorId },
    _sum: { commissionAmount: true },
  });

  return NextResponse.json({
    period,
    total,
    totalBase,
    count: commissions.length,
    allTimeTotal: Number(allTime._sum.commissionAmount ?? 0),
  });
}
