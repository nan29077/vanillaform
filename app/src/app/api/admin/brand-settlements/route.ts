import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getPlatformFees,
  getRecipientSettlementSummary,
  feeMultiplier,
} from "@/lib/settlement";
import { getBrandSettleDays } from "@/lib/settings";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  try {
    const brands = await prisma.brandProfile.findMany({
      include: {
        user: { select: { name: true, email: true } },
        middleAdmin: { select: { id: true, name: true } },
      },
      orderBy: { brandName: "asc" },
    });
    const orderItems = await prisma.orderItem.findMany({
      include: {
        order: { select: { status: true, paidAt: true, finalAmount: true } },
        variant: { select: { price: true } },
      },
    });
    const products = await prisma.product.findMany({
      select: { id: true, brandId: true, supplyPrice: true, basePrice: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    const brandSalesMap = new Map<string, { supplyTotal: number; salesTotal: number; orderCount: number }>();
    for (const item of orderItems) {
      const status = item.order.status;
      if (!["PAID", "CONFIRMED", "SHIPPING", "DELIVERED"].includes(status)) continue;
      const product = productMap.get(item.productId);
      if (!product?.brandId) continue;
      const brandId = product.brandId;
      const cur = brandSalesMap.get(brandId) ?? { supplyTotal: 0, salesTotal: 0, orderCount: 0 };
      cur.supplyTotal += Number(product.supplyPrice ?? 0) * item.quantity;
      cur.salesTotal += Number(item.totalPrice);
      cur.orderCount += 1;
      brandSalesMap.set(brandId, cur);
    }
    const settlements = await (prisma as any).brandSettlement.findMany({ orderBy: { createdAt: "desc" } });
    const settlementMap = new Map<string, any[]>();
    for (const s of settlements) {
      const arr = settlementMap.get(s.brandId) ?? [];
      arr.push(s);
      settlementMap.set(s.brandId, arr);
    }
    const result = brands.map((b) => {
      const sales = brandSalesMap.get(b.id);
      return {
        id: b.id,
        brandName: b.brandName,
        userName: b.user.name,
        userEmail: b.user.email,
        isApproved: b.isApproved,
        middleAdminId: b.middleAdminId,
        middleAdminName: b.middleAdmin?.name ?? null,
        commissionRate: Number(b.commissionRate),
        bankName: b.bankName ?? null,
        accountNumber: b.accountNumber ?? null,
        accountHolder: b.accountHolder ?? null,
        totalSupply: sales?.supplyTotal ?? 0,
        totalSales: sales?.salesTotal ?? 0,
        orderCount: sales?.orderCount ?? 0,
        settlements: (settlementMap.get(b.id) ?? []).map((s: any) => ({
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
        })),
      };
    });
    return NextResponse.json({ brands: result });
  } catch (error) {
    console.error("Brand settlements GET error:", error);
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { brandId, periodLabel, totalSales, orderCount, memo } = body;
    if (!brandId || !periodLabel) {
      return NextResponse.json({ error: "브랜드와 정산기간을 입력하세요." }, { status: 400 });
    }

    // 지급 금액은 서버가 정산 로직으로 재계산한다(요청 body의 금액은 신뢰하지 않음).
    // 이미 지급/예약된 정산분을 뺀 가용액을 초과하면 거부해 이중 지급을 막는다.
    const [fees, settleDays] = await Promise.all([getPlatformFees(), getBrandSettleDays()]);
    const summary = await getRecipientSettlementSummary({
      role: "BRAND",
      recipientId: brandId,
      fees,
      settleDays,
    });
    const maxAmount = summary.withdrawableAmount;
    if (maxAmount <= 0) {
      return NextResponse.json(
        { error: "지급 가능한 정산 금액이 없습니다. (이미 전액 지급되었거나 정산일 미도래)" },
        { status: 400 },
      );
    }

    // 부분 지급 허용 — 금액 미지정 시 가용액 전액.
    const requested = Math.floor(Number(body.settlementAmount));
    const settlementAmount =
      Number.isFinite(requested) && requested > 0 ? requested : maxAmount;
    if (settlementAmount > maxAmount) {
      return NextResponse.json(
        {
          error: `지급 가능 금액을 초과했습니다. (요청 ${settlementAmount.toLocaleString()}원 > 가용 ${maxAmount.toLocaleString()}원)`,
        },
        { status: 400 },
      );
    }

    // 표시용 공급가 = 수수료 차감 전 환산액 (settlementAmount 와 단위를 맞춘다)
    const grossEquivalent = Math.round(settlementAmount / feeMultiplier(fees.brandFeeRate));

    const settlement = await (prisma as any).brandSettlement.create({
      data: {
        brandId,
        periodLabel,
        totalSupply: grossEquivalent,
        totalSales: Number(totalSales) || 0,
        orderCount: Number(orderCount) || 0,
        settlementAmount,
        memo: memo || null,
        isPaid: false,
      },
    });
    return NextResponse.json({ success: true, settlement });
  } catch (error) {
    console.error("Brand settlement POST error:", error);
    return NextResponse.json({ error: "정산 생성에 실패했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { settlementId, isPaid, memo, action, invoiceNumber } = body;
    if (!settlementId) {
      return NextResponse.json({ error: "settlementId가 필요합니다." }, { status: 400 });
    }
    const data: any = {};
    if (action === "invoice_issue") {
      data.invoiceStatus = "ISSUED";
      data.invoiceIssuedAt = new Date();
      if (invoiceNumber) data.invoiceNumber = invoiceNumber;
    } else {
      if (isPaid !== undefined) {
        data.isPaid = isPaid;
        data.paidAt = isPaid ? new Date() : null;
      }
      if (memo !== undefined) data.memo = memo;
    }
    const settlement = await (prisma as any).brandSettlement.update({
      where: { id: settlementId },
      data,
    });
    return NextResponse.json({ success: true, settlement });
  } catch (error) {
    console.error("Brand settlement PATCH error:", error);
    return NextResponse.json({ error: "정산 수정에 실패했습니다." }, { status: 500 });
  }
}
