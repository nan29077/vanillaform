import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT: 셀러 마진 정책 수정 (소속 중간관리자 + 판매가 마진율)
export async function PUT(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { sellerId, middleAdminId, middleAdminMarginRate, commissionRate } = body;

    if (!sellerId) {
      return NextResponse.json({ error: "라이브 셀러 ID가 필요합니다." }, { status: 400 });
    }

    // 값이 넘어온 필드만 부분 업데이트
    const data: Record<string, unknown> = {};
    if (middleAdminId !== undefined) {
      data.middleAdminId = middleAdminId || null;
    }
    if (middleAdminMarginRate !== undefined) {
      data.middleAdminMarginRate = Number(middleAdminMarginRate) || 0;
    }
    if (commissionRate !== undefined) {
      const c = Number(commissionRate);
      data.commissionRate = Number.isFinite(c) && c >= 0 && c <= 100 ? c : 0;
    }

    const seller = await prisma.sellerProfile.update({
      where: { id: sellerId },
      data,
    });

    return NextResponse.json({ success: true, seller });
  } catch (error) {
    console.error("Seller margin update error:", error);
    return NextResponse.json(
      { error: "라이브 셀러 수정에 실패했습니다." },
      { status: 500 }
    );
  }
}
