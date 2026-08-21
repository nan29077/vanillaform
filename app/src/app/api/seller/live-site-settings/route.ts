import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface LiveSiteSettings {
  siteTitle: string;
  liveIntro: string;
  previewImage: string;
  previewImageLink: string;
  previewBgColor: string;
  themeColor: string;
  buttonColor: string;
}

const DEFAULTS: LiveSiteSettings = {
  siteTitle: "",
  liveIntro: "",
  previewImage: "",
  previewImageLink: "",
  previewBgColor: "#1a0a00",
  themeColor: "#4C8E6B",
  buttonColor: "#4C8E6B",
};

function parseSettings(raw: string | null): LiveSiteSettings {
  if (!raw) return DEFAULTS;
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session.user!.id },
    select: { liveSiteSettings: true },
  });
  if (!seller) return NextResponse.json({ error: "셀러 프로필 없음" }, { status: 404 });

  return NextResponse.json({ settings: parseSettings(seller.liveSiteSettings) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "SELLER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session.user!.id },
    select: { id: true, liveSiteSettings: true },
  });
  if (!seller) return NextResponse.json({ error: "셀러 프로필 없음" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const current = parseSettings(seller.liveSiteSettings);
  const updated: LiveSiteSettings = {
    siteTitle: typeof body.siteTitle === "string" ? body.siteTitle.trim() : current.siteTitle,
    liveIntro: typeof body.liveIntro === "string" ? body.liveIntro : current.liveIntro,
    previewImage: typeof body.previewImage === "string" ? body.previewImage.trim() : current.previewImage,
    previewImageLink: typeof body.previewImageLink === "string" ? body.previewImageLink.trim() : current.previewImageLink,
    previewBgColor: typeof body.previewBgColor === "string" ? body.previewBgColor.trim() : current.previewBgColor,
    themeColor: typeof body.themeColor === "string" ? body.themeColor.trim() : current.themeColor,
    buttonColor: typeof body.buttonColor === "string" ? body.buttonColor.trim() : current.buttonColor,
  };

  await prisma.sellerProfile.update({
    where: { id: seller.id },
    data: { liveSiteSettings: JSON.stringify(updated) },
  });

  return NextResponse.json({ success: true, settings: updated });
}
