import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: 중간관리자 정산 레코드 목록 + 하위 브랜드 지급 현황
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "MIDDLE_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const middleAdminId = (session!.user as any).middleAdminId as string | undefined;
  if (!middleAdminId) return NextResponse.json({ error: "중간관리자 정보를 찾을 수 없습니다." }, { status: 404 });

  // 정산 레코드 조회
  const settlements = await (prisma as any).middleAdminSettlement.findMany({
    where: { middleAdminId },
    orderBy: { createdAt: "desc" },
  });

  // 하위 브랜드 지급 현황
  const brands = await prisma.brandProfile.findMany({
    where: { middleAdminId },
    select: { id: true, brandName: true, supplyPrice: true } as any,
  });

  const brandIds = brands.map((b: any) => b.id);
  let brandPayouts: any[] = [];

  if (brandIds.length > 0) {
    const products = await prisma.product.findMany({
      where: { brandId: { in: brandIds }, middleAdminId },
      select: { id: true, brandId: true, supplyPrice: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const items = await prisma.orderItem.findMany({
      where: {
        productId: { in: products.map((p) => p.id) },
        order: {
          paymentStatus: "COMPLETED",
          status: { notIn: ["CANCELLED", "REFUNDED", "REFUND_REQUESTED"] },
        },
      },
      select: {
        productId: true,
        quantity: true,
        order: { select: { status: true } },
      },
    });

    const brandSupplyMap = new Map<string, number>();
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product?.brandId) continue;
      const supply = Number(product.supplyPrice ?? 0) * item.quantity;
      brandSupplyMap.set(product.brandId, (brandSupplyMap.get(product.brandId) ?? 0) + supply);
    }

    brandPayouts = brands.map((b: any) => ({
      brandId: b.id,
      brandName: b.brandName,
      payableAmount: brandSupplyMap.get(b.id) ?? 0,
    }));
  }

  return NextResponse.json({
    settlements: settlements.map((s: any) => ({
      id: s.id,
      periodStart: s.periodStart.toISOString(),
      periodEnd: s.periodEnd.toISOString(),
      totalSales: Number(s.totalSales),
      marginAmount: Number(s.marginAmount),
      settlementAmount: Number(s.settlementAmount),
      status: s.status,
      paidAt: s.paidAt?.toISOString() ?? null,
      invoiceStatus: s.invoiceStatus ?? "NONE",
      invoiceRequestedAt: s.invoiceRequestedAt?.toISOString() ?? null,
      invoiceIssuedAt: s.invoiceIssuedAt?.toISOString() ?? null,
      invoiceNumber: s.invoiceNumber ?? null,
      createdAt: s.createdAt.toISOString(),
    })),
    brandPayouts,
  });
}

// POST: 세금계산서 발급 요청
export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "MIDDLE_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const middleAdminId = (session!.user as any).middleAdminId as string | undefined;
  if (!middleAdminId) return NextResponse.json({ error: "중간관리자 정보를 찾을 수 없습니다." }, { status: 404 });

  const { settlementId } = await request.json();
  if (!settlementId) {
    return NextResponse.json({ error: "settlementId가 필요합니다." }, { status: 400 });
  }

  const existing = await (prisma as any).middleAdminSettlement.findFirst({
    where: { id: settlementId, middleAdminId },
  });
  if (!existing) {
    return NextResponse.json({ error: "정산 레코드를 찾을 수 없습니다." }, { status: 404 });
  }
  if (existing.invoiceStatus !== "NONE") {
    return NextResponse.json({ error: "이미 요청 또는 발급된 세금계산서입니다." }, { status: 400 });
  }

  await (prisma as any).middleAdminSettlement.update({
    where: { id: settlementId },
    data: {
      invoiceStatus: "REQUESTED",
      invoiceRequestedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, message: "세금계산서 발급이 요청되었습니다." });
}
