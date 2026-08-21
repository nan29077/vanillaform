import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { sellerId } = await request.json();
  if (!sellerId) {
    return NextResponse.json({ error: "라이브 셀러 ID가 필요합니다." }, { status: 400 });
  }

  const seller = await prisma.sellerProfile.update({
    where: { id: sellerId },
    data: { isApproved: true },
    select: { id: true, userId: true },
  });

  // 구매자가 셀러 역할로 전환되도록 user.role 도 SELLER 로 변경
  await prisma.user.update({
    where: { id: seller.userId },
    data: { role: "SELLER" },
  });

  return NextResponse.json({ success: true, seller });
}
