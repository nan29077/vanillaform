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

  const seller = await prisma.sellerProfile.findUnique({ where: { id: sellerId } });
  if (!seller) {
    return NextResponse.json({ error: "라이브 셀러를 찾을 수 없습니다." }, { status: 404 });
  }

  const updated = await prisma.sellerProfile.update({
    where: { id: sellerId },
    data: { isRecommended: !seller.isRecommended },
  });

  return NextResponse.json({ success: true, isRecommended: updated.isRecommended });
}
