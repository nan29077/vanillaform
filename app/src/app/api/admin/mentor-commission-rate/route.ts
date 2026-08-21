import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET  /api/admin/mentor-commission-rate  — 현재 멘토 커미션율 조회
 * PATCH /api/admin/mentor-commission-rate — 멘토 커미션율 변경 (SUPER_ADMIN)
 */
export async function GET() {
  try {
    const row = await (prisma as any).platformFeeSettings.findFirst({ orderBy: { id: "asc" } });
    return NextResponse.json({ mentorCommissionRate: Number(row?.mentorCommissionRate ?? 1) });
  } catch {
    return NextResponse.json({ mentorCommissionRate: 1 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const { mentorCommissionRate } = await req.json();
  const rate = Number(mentorCommissionRate);
  if (isNaN(rate) || rate < 0 || rate > 100)
    return NextResponse.json({ error: "유효하지 않은 커미션율입니다 (0~100)" }, { status: 400 });

  const existing = await (prisma as any).platformFeeSettings.findFirst({ orderBy: { id: "asc" } });
  let updated;
  if (existing) {
    updated = await (prisma as any).platformFeeSettings.update({
      where: { id: existing.id },
      data: { mentorCommissionRate: rate },
    });
  } else {
    updated = await (prisma as any).platformFeeSettings.create({
      data: { mentorCommissionRate: rate },
    });
  }

  return NextResponse.json({ mentorCommissionRate: Number(updated.mentorCommissionRate) });
}
