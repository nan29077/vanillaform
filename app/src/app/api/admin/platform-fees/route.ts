import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlatformFees } from "@/lib/settlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: 현재 역할별 플랫폼 수수료율 반환 (정산 계산에 사용 — 인증 불필요)
export async function GET() {
  try {
    const fees = await getPlatformFees();
    const row = await (prisma as any).platformFeeSettings.findFirst({ orderBy: { id: "asc" } });
    return NextResponse.json({
      ...fees,
      mentorCommissionRate: Number(row?.mentorCommissionRate ?? 1),
    });
  } catch {
    return NextResponse.json({ error: "수수료 설정을 불러올 수 없습니다" }, { status: 500 });
  }
}

// PUT: 역할별 플랫폼 수수료율 업데이트 (최고관리자 전용)
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const parseRate = (v: any): number | null => {
      const n = typeof v === "string" ? parseFloat(v) : v;
      if (!Number.isFinite(n) || n < 0 || n > 100) return null;
      return Math.round(n * 100) / 100; // 소수 둘째자리까지
    };

    const sellerFeeRate = parseRate(body.sellerFeeRate);
    const middleAdminFeeRate = parseRate(body.middleAdminFeeRate);
    const brandFeeRate = parseRate(body.brandFeeRate);
    const nodeFeeRate = parseRate(body.nodeFeeRate);

    if (sellerFeeRate === null || middleAdminFeeRate === null || brandFeeRate === null || nodeFeeRate === null) {
      return NextResponse.json({ error: "수수료율은 0~100 사이의 숫자여야 합니다" }, { status: 400 });
    }

    const existing = await (prisma as any).platformFeeSettings.findFirst({ orderBy: { id: "asc" } });
    if (existing) {
      await (prisma as any).platformFeeSettings.update({
        where: { id: existing.id },
        data: { sellerFeeRate, middleAdminFeeRate, brandFeeRate, nodeFeeRate },
      });
    } else {
      await (prisma as any).platformFeeSettings.create({
        data: { sellerFeeRate, middleAdminFeeRate, brandFeeRate, nodeFeeRate },
      });
    }

    const fees = await getPlatformFees();
    return NextResponse.json(fees);
  } catch {
    return NextResponse.json({ error: "수수료 설정 저장 실패" }, { status: 500 });
  }
}
