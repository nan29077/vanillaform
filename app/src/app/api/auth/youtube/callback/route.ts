import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangeYoutubeCode, fetchMyYoutubeChannel } from "@/lib/youtubeOAuth";
import { absoluteUrl } from "@/lib/appUrl";

// GET /api/auth/youtube/callback — Google OAuth 콜백
// code → 토큰 교환 → 채널 정보 조회 → SellerProfile 저장 → 라이브 관리 페이지로 복귀
//
// 리다이렉트 주소는 req.url 이 아니라 공개 URL(NEXTAUTH_URL) 기준으로 만든다.
// nginx 뒤에서는 req.url 의 호스트가 내부 주소(localhost:3026)로 잡혀
// 사용자가 접근할 수 없는 주소로 돌아가게 된다.

function redirectWith(param: string) {
  return NextResponse.redirect(absoluteUrl(`/seller/live?youtube=${param}`));
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "SELLER") {
    return NextResponse.redirect(absoluteUrl("/auth/login"));
  }
  const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user!.id } });
  if (!seller) return redirectWith("error");

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = req.cookies.get("yt_oauth_state")?.value;

  // 사용자가 동의 취소 or state 불일치(CSRF)
  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectWith("cancelled");
  }

  const token = await exchangeYoutubeCode(code);
  if (!token?.access_token) return redirectWith("error");

  // 채널 정보 조회 (연결된 채널명 표시용)
  const channel = await fetchMyYoutubeChannel(token.access_token);

  await prisma.sellerProfile.update({
    where: { id: seller.id },
    data: {
      youtubeAccessToken: token.access_token,
      // refresh_token 은 최초 동의 시에만 내려올 수 있음 — 없으면 기존 값 유지
      ...(token.refresh_token ? { youtubeRefreshToken: token.refresh_token } : {}),
      youtubeTokenExpiry: new Date(Date.now() + (token.expires_in ?? 3600) * 1000),
      ...(channel ? { youtubeChannelId: channel.channelId, youtubeChannelTitle: channel.title } : {}),
    },
  });

  const res = redirectWith("connected");
  res.cookies.delete("yt_oauth_state");
  return res;
}
