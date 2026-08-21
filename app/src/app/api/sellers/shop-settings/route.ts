import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST: Update seller shop settings (theme color, etc.)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "SELLER") {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 401 });
    }

    const body = await req.json();
    const { shopThemeColor, shopName, shopDescription, category, mood, instagramUrl, youtubeUrl } = body;

    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!seller) {
      return NextResponse.json({ error: "라이브 셀러 프로필을 찾을 수 없습니다" }, { status: 404 });
    }

    const updateData: any = {};
    if (shopThemeColor !== undefined) updateData.shopThemeColor = shopThemeColor;
    if (shopName !== undefined) updateData.shopName = shopName;
    if (shopDescription !== undefined) updateData.shopDescription = shopDescription;
    if (category !== undefined) updateData.category = category;
    if (mood !== undefined) updateData.mood = mood;
    if (instagramUrl !== undefined) updateData.instagramUrl = instagramUrl;
    if (youtubeUrl !== undefined) updateData.youtubeUrl = youtubeUrl;

    const updated = await prisma.sellerProfile.update({
      where: { id: seller.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, seller: updated });
  } catch (error) {
    console.error("Shop settings error:", error);
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
