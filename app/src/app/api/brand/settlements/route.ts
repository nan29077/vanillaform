import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: 브랜드사 정산 레코드 목록 조회
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "BRAND_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const brand = await prisma.brandProfile.findUnique({
    where: { userId: session!.user!.id },
    select: { id: true },
  });
  if (!brand) return NextResponse.json({ error: "브랜드를 찾을 수 없습니다." }, { status: 404 });

  const settlements = await (prisma as any).brandSettlement.findMany({
    where: { brandId: brand.id },
    orderBy: { createdAt: "desc" },
  });

  const result = settlements.map((s: any) => ({
    id: s.id,
    periodLabel: s.periodLabel,
    totalSupply: Number(s.totalSupply),
    totalSales: Number(s.totalSales),
    orderCount: s.orderCount,
    isPaid: s.isPaid,
    memo: s.memo,
    paidAt: s.paidAt?.toISOString() ?? null,
    invoiceStatus: s.invoiceStatus ?? "NONE",
    invoiceRequestedAt: s.invoiceRequestedAt?.toISOString() ?? null,
    invoiceIssuedAt: s.invoiceIssuedAt?.toISOString() ?? null,
    invoiceNumber: s.invoiceNumber ?? null,
    createdAt: s.createdAt.toISOString(),
  }));

  return NextResponse.json({ settlements: result });
}

// POST: 세금계산서 발급 요청
export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "BRAND_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const brand = await prisma.brandProfile.findUnique({
    where: { userId: session!.user!.id },
    select: { id: true },
  });
  if (!brand) return NextResponse.json({ error: "브랜드를 찾을 수 없습니다." }, { status: 404 });

  const { settlementId } = await request.json();
  if (!settlementId) {
    return NextResponse.json({ error: "settlementId가 필요합니다." }, { status: 400 });
  }

  // 소유권 확인
  const existing = await (prisma as any).brandSettlement.findFirst({
    where: { id: settlementId, brandId: brand.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "정산 레코드를 찾을 수 없습니다." }, { status: 404 });
  }
  if (existing.invoiceStatus !== "NONE") {
    return NextResponse.json({ error: "이미 요청 또는 발급된 세금계산서입니다." }, { status: 400 });
  }

  await (prisma as any).brandSettlement.update({
    where: { id: settlementId },
    data: {
      invoiceStatus: "REQUESTED",
      invoiceRequestedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, message: "세금계산서 발급이 요청되었습니다." });
}
