import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// PATCH: 중간관리자 정산 세금계산서 발급 처리
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (session.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "최고관리자만 접근 가능합니다." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { settlementId, invoiceNumber } = body as { settlementId?: string; invoiceNumber?: string };

  if (!settlementId) {
    return NextResponse.json({ error: "settlementId가 필요합니다." }, { status: 400 });
  }

  await (prisma as any).middleAdminSettlement.update({
    where: { id: settlementId },
    data: {
      invoiceStatus: "ISSUED",
      invoiceIssuedAt: new Date(),
      ...(invoiceNumber ? { invoiceNumber } : {}),
    },
  });

  return NextResponse.json({ success: true, message: "세금계산서가 발급 처리되었습니다." });
}

// GET: 중간관리자별 미지급 마진 집계
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (session.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "최고관리자만 접근 가능합니다." }, { status: 403 });
  }

  const middleAdmins = await prisma.middleAdminProfile.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  const grouped = await prisma.middleAdminCommission.groupBy({
    by: ["middleAdminId"],
    where: { status: "PENDING" },
    _sum: { orderAmount: true, marginAmount: true },
    _count: { _all: true },
  });
  const sumMap = new Map(grouped.map((g) => [g.middleAdminId, g]));

  const result = middleAdmins.map((m) => {
    const g = sumMap.get(m.id);
    return {
      middleAdminId: m.id,
      name: m.name,
      pendingCount: g?._count._all ?? 0,
      pendingOrderAmount: Number(g?._sum.orderAmount ?? 0),
      pendingMarginAmount: Number(g?._sum.marginAmount ?? 0),
    };
  });

  return NextResponse.json({ middleAdmins: result });
}

// POST: 특정 중간관리자의 PENDING 마진을 묶어 정산(MiddleAdminSettlement) 생성 + 지급 처리
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (session.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "최고관리자만 접근 가능합니다." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { middleAdminId, periodStart, periodEnd } = body as {
    middleAdminId?: string;
    periodStart?: string;
    periodEnd?: string;
  };

  if (!middleAdminId) {
    return NextResponse.json({ error: "middleAdminId가 필요합니다." }, { status: 400 });
  }

  const where: any = { middleAdminId, status: "PENDING" };
  if (periodStart || periodEnd) {
    where.createdAt = {};
    if (periodStart) where.createdAt.gte = new Date(periodStart);
    if (periodEnd) where.createdAt.lte = new Date(periodEnd);
  }

  const commissions = await prisma.middleAdminCommission.findMany({ where });
  if (commissions.length === 0) {
    return NextResponse.json({ error: "지급 대상 마진이 없습니다." }, { status: 400 });
  }

  const totalSales = commissions.reduce((acc, c) => acc + Number(c.orderAmount), 0);
  const marginAmount = commissions.reduce((acc, c) => acc + Number(c.marginAmount), 0);
  const now = new Date();

  const dates = commissions.map((c) => c.createdAt.getTime());
  const resolvedStart = periodStart ? new Date(periodStart) : new Date(Math.min(...dates));
  const resolvedEnd = periodEnd ? new Date(periodEnd) : new Date(Math.max(...dates));

  const settlement = await (prisma as any).middleAdminSettlement.create({
    data: {
      middleAdminId,
      periodStart: resolvedStart,
      periodEnd: resolvedEnd,
      totalSales,
      marginAmount,
      settlementAmount: marginAmount,
      status: "PAID",
      paidAt: now,
    },
  });

  await prisma.middleAdminCommission.updateMany({
    where: { id: { in: commissions.map((c) => c.id) } },
    data: { status: "PAID" },
  });

  return NextResponse.json({ success: true, settlement });
}
