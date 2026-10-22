import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CHARGE_DTO_SELECT, expireOverdueCharges, toChargeDTO, walletErrorResponse } from "@/lib/wallet";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

// GET /api/admin/wallet-charges?status=PENDING|COMPLETED|CLOSED|ALL&page=1 — 충전 요청 목록 (최고관리자)
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "PENDING";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);

  const where =
    status === "PENDING"
      ? { status: "PENDING" as const }
      : status === "COMPLETED"
      ? { status: "COMPLETED" as const }
      : status === "CLOSED"
      ? { status: { in: ["CANCELLED", "REJECTED", "EXPIRED"] as ("CANCELLED" | "REJECTED" | "EXPIRED")[] } }
      : {};

  try {
    await expireOverdueCharges();
    const [rows, total, pendingAgg] = await Promise.all([
      prisma.walletCharge.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: { ...CHARGE_DTO_SELECT, user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.walletCharge.count({ where }),
      prisma.walletCharge.aggregate({
        where: { status: "PENDING" },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    return NextResponse.json({
      items: rows.map((r) => ({ ...toChargeDTO(r), user: r.user })),
      total,
      page,
      pageSize: PAGE_SIZE,
      pending: { count: pendingAgg._count._all, amount: pendingAgg._sum.amount ?? 0 },
    });
  } catch (e) {
    return walletErrorResponse(e);
  }
}
