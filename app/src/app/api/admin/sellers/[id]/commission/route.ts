import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/admin/sellers/[id]/commission
// 셀러 판매 수수료율 수정 (SUPER_ADMIN 전용)
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { commissionRate } = body;

    if (commissionRate === undefined || commissionRate === null) {
      return NextResponse.json(
        { error: "수수료율을 입력하세요." },
        { status: 400 }
      );
    }

    const rate = Number(commissionRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      return NextResponse.json(
        { error: "수수료율은 0~100 사이 숫자여야 합니다." },
        { status: 400 }
      );
    }

    const seller = await prisma.sellerProfile.update({
      where: { id: params.id },
      data: { commissionRate: rate },
    });

    return NextResponse.json({ success: true, commissionRate: Number(seller.commissionRate) });
  } catch (error) {
    console.error("Commission update error:", error);
    return NextResponse.json(
      { error: "수수료율 수정에 실패했습니다." },
      { status: 500 }
    );
  }
}
