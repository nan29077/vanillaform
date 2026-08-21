import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildYoutubeAuthUrl } from "@/lib/youtubeOAuth";
import { absoluteUrl } from "@/lib/appUrl";

// GET /api/auth/youtube/connect — Google OAuth 동의 화면으로 리다이렉트 (셀러 전용)
// state 값을 쿠키에 저장해 callback 에서 CSRF 검증

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "SELLER") {
    return NextResponse.redirect(absoluteUrl("/auth/login"));
  }

  const state = crypto.randomUUID();
  const authUrl = buildYoutubeAuthUrl(state);
  if (!authUrl) {
    // GOOGLE_CLIENT_ID 미설정
    return NextResponse.redirect(absoluteUrl("/seller/live?youtube=env_missing"));
  }

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("yt_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10분
    path: "/",
  });
  return res;
}
