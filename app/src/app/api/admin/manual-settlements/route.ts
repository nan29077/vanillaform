import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session || (session.user as any).role !== "SUPER_ADMIN") {
    return { error: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }) };
  }
  return { session, ok: true as const };
}

// GET: 수기 정산 내역 조회 (?recipientType=NODE|MIDDLE_ADMIN|BRAND_ADMIN)
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const { searchParams } = new URL(req.url);
  const recipientType = searchParams.get("recipientType");

  const where = recipientType ? { recipientType } : {};

  const settlements = await (prisma as any).manualSettlement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      admin: { select: { name: true, email: true } },
    },
  }).catch(() => []);

  // recipientId 로 사용자 정보 일괄 조회
  const recipientIds: string[] = [...new Set((settlements as any[]).map((s: any) => s.recipientId))];
  const recipients = recipientIds.length
    ? await prisma.user.findMany({
        where: { id: { in: recipientIds } },
        select: { id: true, name: true, email: true, role: true },
      })
    : [];
  const recipientMap = new Map(recipients.map((u) => [u.id, u]));

  const result = (settlements as any[]).map((s: any) => ({
    id: s.id as string,
    recipientType: s.recipientType as string,
    recipientId: s.recipientId as string,
    recipientName: recipientMap.get(s.recipientId)?.name ?? "-",
    recipientEmail: recipientMap.get(s.recipientId)?.email ?? "-",
    amount: s.amount as number,
    memo: s.memo as string | null,
    status: s.status as string,
    paidAt: (s.paidAt as Date).toISOString(),
    adminName: s.admin?.name ?? "-",
    createdAt: (s.createdAt as Date).toISOString(),
  }));

  return NextResponse.json({ settlements: result });
}

// POST: 수기 정산 생성
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  try {
    const body = await req.json();
    const { recipientType, recipientId, amount, memo } = body;

    if (!recipientType || !recipientId || amount == null) {
      return NextResponse.json(
        { error: "recipientType, recipientId, amount 는 필수입니다." },
        { status: 400 }
      );
    }

    const validTypes = ["NODE", "MIDDLE_ADMIN", "BRAND_ADMIN"];
    if (!validTypes.includes(recipientType)) {
      return NextResponse.json(
        { error: "recipientType 은 NODE | MIDDLE_ADMIN | BRAND_ADMIN 이어야 합니다." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: "amount 는 양의 정수여야 합니다." }, { status: 400 });
    }

    // 수취인 확인
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true, role: true, name: true },
    });
    if (!recipient || recipient.role !== recipientType) {
      return NextResponse.json(
        { error: "해당 역할의 사용자를 찾을 수 없습니다." },
        { status: 400 }
      );
    }

    const adminId = (guard as any).session.user.id;

    const settlement = await (prisma as any).manualSettlement.create({
      data: {
        recipientType,
        recipientId,
        amount: Number(amount),
        memo: memo || null,
        status: "PAID",
        adminId,
      },
    });

    return NextResponse.json({ success: true, settlement });
  } catch (error) {
    console.error("Manual settlement create error:", error);
    return NextResponse.json({ error: "수기 정산 생성에 실패했습니다." }, { status: 500 });
  }
}
