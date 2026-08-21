import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ─── 공통: 중간관리자 인증 헬퍼 ───────────────────────
async function requireMiddleAdmin() {
  const session = await auth();
  if (session?.user?.role !== "MIDDLE_ADMIN")
    return { error: "권한이 없습니다.", status: 403 } as const;
  const middleAdminId = (session!.user as any).middleAdminId as string | undefined;
  if (!middleAdminId)
    return { error: "중간관리자 정보를 찾을 수 없습니다.", status: 404 } as const;
  return { middleAdminId } as const;
}

// ─── GET: 하위 브랜드별 정산 내역 + 미정산 주문 집계 ────
export async function GET() {
  const auth_result = await requireMiddleAdmin();
  if ("error" in auth_result)
    return NextResponse.json({ error: auth_result.error }, { status: auth_result.status });
  const { middleAdminId } = auth_result;

  // 소속 브랜드 목록
  const brands = await prisma.brandProfile.findMany({
    where: { middleAdminId },
    select: {
      id: true,
      brandName: true,
      bankName: true,
      accountNumber: true,
      accountHolder: true,
    },
  });
  const brandIds = brands.map((b) => b.id);

  // 브랜드별 누적 주문 공급가 집계
  const brandSupplyMap = new Map<string, { totalSales: number; orderCount: number; totalSupply: number }>();
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
      select: { productId: true, quantity: true, price: true },
    });
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product?.brandId) continue;
      const cur = brandSupplyMap.get(product.brandId) ?? { totalSales: 0, orderCount: 0, totalSupply: 0 };
      cur.totalSales += Number(item.price) * item.quantity;
      cur.totalSupply += Number(product.supplyPrice ?? 0) * item.quantity;
      cur.orderCount += item.quantity;
      brandSupplyMap.set(product.brandId, cur);
    }
  }

  // 기존 정산 내역 — raw SQL (Prisma 클라이언트가 middleAdminId 미인식)
  let rawSettlements: any[] = [];
  try {
    rawSettlements = await prisma.$queryRaw<any[]>`
      SELECT bs.id, bs.brandId, bs.periodLabel,
             bs.totalSupply, bs.totalSales, bs.orderCount,
             bs.isPaid, bs.memo, bs.paidAt,
             bs.invoiceStatus, bs.invoiceRequestedAt, bs.invoiceIssuedAt, bs.invoiceNumber,
             bs.createdAt,
             bp.brandName
      FROM brand_settlements bs
      JOIN brand_profiles bp ON bs.brandId = bp.id
      WHERE bs.middleAdminId = ${middleAdminId}
      ORDER BY bs.createdAt DESC
    `;
  } catch {
    rawSettlements = [];
  }

  // 브랜드별 이미 정산된 금액 합산
  const paidMap = new Map<string, number>();
  for (const s of rawSettlements) {
    if (s.isPaid) {
      paidMap.set(s.brandId, (paidMap.get(s.brandId) ?? 0) + Number(s.totalSupply));
    }
  }

  const brandPayouts = brands.map((b) => {
    const agg = brandSupplyMap.get(b.id) ?? { totalSales: 0, orderCount: 0, totalSupply: 0 };
    const paid = paidMap.get(b.id) ?? 0;
    return {
      ...b,
      totalSales: agg.totalSales,
      totalSupply: agg.totalSupply,
      orderCount: agg.orderCount,
      unpaidAmount: Math.max(0, agg.totalSupply - paid),
      paidAmount: paid,
    };
  });

  return NextResponse.json({
    brandPayouts,
    settlements: rawSettlements.map((s: any) => ({
      id: s.id,
      brandId: s.brandId,
      brandName: s.brandName ?? "",
      periodLabel: s.periodLabel,
      totalSupply: Number(s.totalSupply),
      totalSales: Number(s.totalSales),
      orderCount: Number(s.orderCount),
      isPaid: Boolean(s.isPaid),
      memo: s.memo ?? null,
      paidAt: s.paidAt ? new Date(s.paidAt).toISOString() : null,
      invoiceStatus: s.invoiceStatus ?? "NONE",
      invoiceRequestedAt: s.invoiceRequestedAt ? new Date(s.invoiceRequestedAt).toISOString() : null,
      invoiceIssuedAt: s.invoiceIssuedAt ? new Date(s.invoiceIssuedAt).toISOString() : null,
      invoiceNumber: s.invoiceNumber ?? null,
      createdAt: new Date(s.createdAt).toISOString(),
    })),
  });
}

// ─── POST: 브랜드 정산 레코드 생성 ─────────────────────
export async function POST(req: Request) {
  const auth_result = await requireMiddleAdmin();
  if ("error" in auth_result)
    return NextResponse.json({ error: auth_result.error }, { status: auth_result.status });
  const { middleAdminId } = auth_result;

  const { brandId, periodLabel, totalSupply, totalSales, orderCount, memo } = await req.json();
  if (!brandId || !periodLabel)
    return NextResponse.json({ error: "brandId, periodLabel이 필요합니다." }, { status: 400 });

  // 해당 브랜드가 이 중간관리자 소속인지 확인
  const brand = await prisma.brandProfile.findFirst({
    where: { id: brandId, middleAdminId },
    select: { id: true },
  });
  if (!brand) return NextResponse.json({ error: "브랜드를 찾을 수 없습니다." }, { status: 404 });

  // 1) 기본 레코드 생성 (Prisma 클라이언트가 아는 필드만)
  const settlement = await prisma.brandSettlement.create({
    data: {
      brandId,
      periodLabel,
      totalSupply: totalSupply ?? 0,
      totalSales: totalSales ?? 0,
      orderCount: orderCount ?? 0,
      memo: memo || null,
      isPaid: false,
    },
  });

  // 2) middleAdminId raw UPDATE (Prisma 클라이언트가 모르는 컬럼)
  await prisma.$executeRaw`
    UPDATE brand_settlements SET middleAdminId = ${middleAdminId} WHERE id = ${settlement.id}
  `;

  return NextResponse.json({ success: true, id: settlement.id, message: "정산이 생성되었습니다." });
}

// ─── PATCH: 정산 상태 변경 (지급완료 처리 / 세금계산서 요청) ─
export async function PATCH(req: Request) {
  const auth_result = await requireMiddleAdmin();
  if ("error" in auth_result)
    return NextResponse.json({ error: auth_result.error }, { status: auth_result.status });
  const { middleAdminId } = auth_result;

  const { id, action, memo } = await req.json();
  if (!id || !action)
    return NextResponse.json({ error: "id, action이 필요합니다." }, { status: 400 });

  // 소유권 검증 — raw SQL (middleAdminId 컬럼 직접 접근)
  const rows = await prisma.$queryRaw<any[]>`
    SELECT id, isPaid, invoiceStatus, memo FROM brand_settlements
    WHERE id = ${id} AND middleAdminId = ${middleAdminId}
    LIMIT 1
  `;
  const existing = rows[0];
  if (!existing) return NextResponse.json({ error: "정산을 찾을 수 없습니다." }, { status: 404 });

  if (action === "markPaid") {
    await prisma.brandSettlement.update({
      where: { id },
      data: { isPaid: true, paidAt: new Date(), memo: memo || existing.memo },
    });
    return NextResponse.json({ success: true, message: "지급완료로 변경되었습니다." });
  }

  if (action === "requestInvoice") {
    if (existing.invoiceStatus !== "NONE")
      return NextResponse.json({ error: "이미 요청 또는 발급된 세금계산서입니다." }, { status: 400 });
    await prisma.brandSettlement.update({
      where: { id },
      data: { invoiceStatus: "REQUESTED", invoiceRequestedAt: new Date() },
    });
    return NextResponse.json({ success: true, message: "세금계산서 발급이 요청되었습니다." });
  }

  return NextResponse.json({ error: "알 수 없는 action입니다." }, { status: 400 });
}

// ─── DELETE: 정산 레코드 삭제 (미지급 상태만) ───