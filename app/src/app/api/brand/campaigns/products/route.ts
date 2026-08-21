import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: Get brand's products for campaign creation
export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    if (session.user.role !== "BRAND_ADMIN") {
      return NextResponse.json({ error: "브랜드 관리자 전용" }, { status: 403 });
    }

    const brand = await prisma.brandProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!brand) return NextResponse.json({ error: "브랜드 프로필 없음" }, { status: 400 });

    const products = await prisma.product.findMany({
      where: { brandId: brand.id, isActive: true },
      select: {
        id: true, name: true, thumbnail: true, basePrice: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      products: products.map(p => ({
        ...p,
        basePrice: Number(p.basePrice),
      })),
    });
  } catch (error) {
    console.error("Brand products for campaign error:", error);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
