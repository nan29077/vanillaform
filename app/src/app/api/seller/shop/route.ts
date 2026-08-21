import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session || session.user?.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session.user!.id },
    select: {
      shopName: true, category: true, mood: true, shopDescription: true,
      instagramUrl: true, youtubeUrl: true, tiktokUrl: true, facebookUrl: true, twitterUrl: true, youtubeChannelId: true,
      isManualLive: true,
    },
  });
  if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });
  return NextResponse.json({ seller });
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user?.role !== "SELLER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { shopName, category, mood, shopDescription, instagramUrl, youtubeUrl, tiktokUrl, facebookUrl, twitterUrl, youtubeChannelId, shopLogo, shopBanner } = body;

    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
    });

    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    const updated = await prisma.sellerProfile.update({
      where: { id: seller.id },
      data: {
        ...(shopName !== undefined && { shopName }),
        ...(category !== undefined && { category }),
        ...(mood !== undefined && { mood }),
        ...(shopDescription !== undefined && { shopDescription }),
        ...(instagramUrl !== undefined && { instagramUrl }),
        ...(youtubeUrl !== undefined && { youtubeUrl }),
        ...(tiktokUrl !== undefined && { tiktokUrl }),
        ...(facebookUrl !== undefined && { facebookUrl }),
        ...(twitterUrl !== undefined && { twitterUrl }),
        ...(youtubeChannelId !== undefined && { youtubeChannelId: youtubeChannelId || null }),
        ...(shopLogo !== undefined && { shopLogo: shopLogo || null }),
        ...(shopBanner !== undefined && { shopBanner: shopBanner || null }),
      },
    });

    return NextResponse.json({ success: true, seller: updated });
  } catch (error: any) {
    console.error("Shop update error:", error);
    return NextResponse.json({ error: "Failed to update live settings" }, { status: 500 });
  }
}

// PATCH: 라이브 중 수동 표시 + 외부 라이브 연동 링크 저장
const ALLOWED_PLATFORMS = ["instagram", "youtube", "tiktok", "facebook"];

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user?.role !== "SELLER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!seller) {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    const body = await req.json();
    const { isManualLive, livePlatform, liveLink, manualLiveProductIds } = body;

    const data: { isManualLive?: boolean; livePlatform?: string | null; liveLink?: string | null; manualLiveProductIds?: string | null } = {};
    if (typeof isManualLive === "boolean") data.isManualLive = isManualLive;
    if (livePlatform !== undefined) {
      const p = typeof livePlatform === "string" ? livePlatform.toLowerCase().trim() : "";
      data.livePlatform = ALLOWED_PLATFORMS.includes(p) ? p : null;
    }
    if (liveLink !== undefined) {
      const link = typeof liveLink === "string" ? liveLink.trim() : "";
      data.liveLink = link.length > 0 ? link : null;
    }
    if (manualLiveProductIds !== undefined) {
      if (Array.isArray(manualLiveProductIds)) {
        data.manualLiveProductIds = JSON.stringify(manualLiveProductIds.filter((id: any) => typeof id === "string"));
      } else if (manualLiveProductIds === null) {
        data.manualLiveProductIds = null;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "변경할 내용이 없습니다." }, { status: 400 });
    }

    const updated = await prisma.sellerProfile.update({
      where: { id: seller.id },
      data,
    });

    return NextResponse.json({ success: true, seller: updated });
  } catch (error: any) {
    console.error("Shop PATCH error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
