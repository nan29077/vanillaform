import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  setSettings,
  getSocialLinks,
  SOCIAL_INSTAGRAM_ENABLED_KEY,
  SOCIAL_INSTAGRAM_URL_KEY,
  SOCIAL_YOUTUBE_ENABLED_KEY,
  SOCIAL_YOUTUBE_URL_KEY,
  SOCIAL_EMAIL_ENABLED_KEY,
  SOCIAL_EMAIL_URL_KEY,
} from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: 소셜 링크 설정 조회 (최고관리자 전용)
export async function GET() {
  try {
    const session = await auth();
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }
    const socialLinks = await getSocialLinks();
    return NextResponse.json({ socialLinks });
  } catch {
    return NextResponse.json({ error: "설정을 불러올 수 없습니다" }, { status: 500 });
  }
}

// PUT: 소셜 링크 설정 저장 (최고관리자 전용)
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    const body = await req.json();
    const entries: Record<string, string> = {
      [SOCIAL_INSTAGRAM_ENABLED_KEY]: body.instagramEnabled ? "true" : "false",
      [SOCIAL_INSTAGRAM_URL_KEY]: String(body.instagramUrl ?? ""),
      [SOCIAL_YOUTUBE_ENABLED_KEY]: body.youtubeEnabled ? "true" : "false",
      [SOCIAL_YOUTUBE_URL_KEY]: String(body.youtubeUrl ?? ""),
      [SOCIAL_EMAIL_ENABLED_KEY]: body.emailEnabled ? "true" : "false",
      [SOCIAL_EMAIL_URL_KEY]: String(body.emailUrl ?? ""),
    };

    await setSettings(entries);
    const socialLinks = await getSocialLinks();
    return NextResponse.json({ socialLinks });
  } catch {
    return NextResponse.json({ error: "설정 저장 실패" }, { status: 500 });
  }
}
