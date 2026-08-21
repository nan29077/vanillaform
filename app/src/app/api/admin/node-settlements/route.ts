import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return { error: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }) };
  }
  return { ok: true };
}

// GET: 전체 노드 정산 목록
export async function GET() {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  const settlements = await (prisma as any).nodeSettlement.findMany({
    where: { nodeUser: { isActive: true } },
    orderBy: { createdAt: "desc" },
    include: {
      nodeUser: { select: { name: true, email: true, isActive: true } },
    },
  }).catch(() => []);

  return NextResponse.json({ settlements });
}

// POST: 노드에게 정산 발송
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  try {
    const body = await req.json();
    const { nodeUserId, periodLabel, totalAmount, memo } = body;

    if (!nodeUserId || !periodLabel || totalAmount == null) {
      return NextResponse.json({ error: "nodeUserId, periodLabel, totalAmount 필수" }, { status: 400 });
    }

    // 노드 계정 확인
    const nodeUser = await prisma.user.findUnique({
      where: { id: nodeUserId },
      select: { id: true, role: true, name: true, isActive: true },
    });
    if (!nodeUser || nodeUser.role !== "NODE") {
      return NextResponse.json({ error: "유효한 노드 계정이 아닙니다." }, { status: 400 });
    }
    if (!nodeUser.isActive) {
      return NextResponse.json({ error: "비활성화된 노드 계정입니다. 정산을 생성할 수 없습니다." }, { status: 400 });
    }

    const settlement = await (prisma as any).nodeSettlement.create({
      data: {
        nodeUserId,
        periodLabel,
        totalAmount: Number(totalAmount),
        memo: memo || null,
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, settlement });
  } catch (error) {
    console.error("Node settlement create error:", error);
    return NextResponse.json({ error: "정산 생성에 실패했습니다." }, { status: 500 });
  }
}

// PATCH: 정산 상태 변경 (CONFIRMED / PAID)
export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;

  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id || !["PENDING", "CONFIRMED", "PAID"].includes(status)) {
      return NextResponse.json({ error: "id, status 필수 (PENDING|CONFIRMED|PAID)" }, { status: 400 });
    }

    const settlement = await (prisma as any).nodeSettlement.update({
      where: { id },
      data: {
        status,
        paidAt: status === "PAID" ? new Date() : undefined,
      },
    });

    return NextResponse.json({ success: true, settlement });
  } catch (error) {
    console.error("Node settlement update error:", error);
    return NextResponse.json({ error: "정산 상태 변경에 실패했습니다." }, { status: 500 });
  }
}
