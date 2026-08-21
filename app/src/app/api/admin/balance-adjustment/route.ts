import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST: 정산 가능 금액 +/- 수기 조정 (SELLER / MIDDLE_ADMIN / BRAND_ADMIN)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { recipientType, userId, amount, memo } = body as {
    recipientType?: string;
    userId?: string;
    amount?: number;
    memo?: string;
  };

  if (!recipientType || !userId || amount == null) {
    return NextResponse.json({ error: "recipientType, userId, amount 필수" }, { status: 400 });
  }

  const validTypes = ["SELLER", "MIDDLE_ADMIN", "BRAND_ADMIN"];
  if (!validTypes.includes(recipientType)) {
    return NextResponse.json({ error: "유효하지 않은 recipientType" }, { status: 400 });
  }

  if (!Number.isInteger(Number(amount))) {
    return NextResponse.json({ error: "amount는 정수여야 합니다." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, name: true },
  });

  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const adminId = (session.user as any).id;

  await (prisma as any).manualSettlement.create({
    data: {
      recipientType,
      recipientId: userId,
      amount: Number(amount),
      memo: memo || null,
      status: "PAID",
      adminId,
    },
  });

  return NextResponse.json({ success: true });
}
