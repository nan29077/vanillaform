import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlatformFees, getRecipientSettlementSummary } from "@/lib/settlement";
import { getMiddleSettleDays } from "@/lib/settings";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return { error: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }) };
  }
  return { ok: true };
}

// GET: 중간관리자별 직접 정산 목록
export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const settlements = await (prisma as any).middleManagerSettlement.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      middleAdmin: { select: { name: true } },
    },
  }).catch(() => []);

  return NextResponse.json({ settlements });
}

// POST: 중간관리자에게 직접 정산 발송
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  try {
    const body = await req.json();
    const { middleAdminId, periodLabel, totalAmount, memo } = body;

    if (!middleAdminId || !periodLabel) {
      return NextResponse.json({ error: "middleAdminId, periodLabel 필수" }, { status: 400 });
    }

    const middleAdmin = await prisma.middleAdminProfile.findUnique({
      where: { id: middleAdminId },
      select: { id: true, name: true },
    });
    if (!middleAdmin) {
      return NextResponse.json({ error: "유효한 중간관리자가 아닙니다." }, { status: 400 });
    }

    // 지급 금액을 서버 정산 로직으로 재검증한다. 이미 지급/예약된 분을 뺀 가용액을
    // 초과하면 거부해 같은 정산금을 반복 지급하는 사고를 막는다.
    // (여기서 다루는 건 '공급 정산'분이며, 영업 커미션(MiddleAdminCommission)은
    //  admin/middle-settlements 의 별도 재원이라 서로 차감하지 않는다)
    const [fees, settleDays] = await Promise.all([getPlatformFees(), getMiddleSettleDays()]);
    const summary = await getRecipientSettlementSummary({
      role: "MIDDLE_ADMIN",
      recipientId: middleAdminId,
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

    const requested = Math.floor(Number(totalAmount));
    const amount = Number.isFinite(requested) && requested > 0 ? requested : maxAmount;
    if (amount > maxAmount) {
      return NextResponse.json(
        {
          error: `지급 가능 금액을 초과했습니다. (요청 ${amount.toLocaleString()}원 > 가용 ${maxAmount.toLocaleString()}원)`,
        },
        { status: 400 },
      );
    }

    const settlement = await (prisma as any).middleManagerSettlement.create({
      data: {
        middleAdminId,
        periodLabel,
        totalAmount: amount,
        memo: memo || null,
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, settlement });
  } catch (error) {
    console.error("MiddleManager settlement create error:", error);
    return NextResponse.json({ error: "정산 생성에 실패했습니다." }, { status: 500 });
  }
}

// PATCH: 정산 상태 변경 (PENDING → PAID)
export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id || !["PENDING", "CONFIRMED", "PAID"].includes(status)) {
      return NextResponse.json({ error: "id, status 필수 (PENDING|CONFIRMED|PAID)" }, { status: 400 });
    }

    const settlement = await (prisma as any).middleManagerSettlement.update({
      where: { id },
      data: {
        status,
        paidAt: status === "PAID" ? new Date() : undefined,
      },
    });

    return NextResponse.json({ success: true, settlement });
  } catch (error) {
    console.error("MiddleManager settlement update error:", error);
    return NextResponse.json({ error: "정산 상태 변경에 실패했습니다." }, { status: 500 });
  }
}
