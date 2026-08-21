import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 셀러 대시보드의 "내 라이브 코드"(= SellerProfile.slug)로 진입했을 때,
// 라이브 방송 여부에 따라 목적지를 서버에서 판단해 리다이렉트한다.
//
// 우선순위:
//   1순위) 라이브 커머스 실제 방송 중(status="LIVE") → 라이브 시청 페이지 /live/[shareCode]
//   2순위) 샵관리 "라이브 표시 설정" ON(isManualLive) + 라이브 연동 링크(liveLink) → 외부 링크
//   방송 중 아님) 최근 라이브 시청 페이지(방송 종료/예정 안내 표시) → 없으면 셀러샵으로 폴백
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const origin = new URL(req.url).origin;
  const code = decodeURIComponent(params.code || "").trim();
  if (!code) return NextResponse.redirect(`${origin}/live`);

  const seller = await prisma.sellerProfile.findUnique({
    where: { slug: code },
    select: {
      slug: true,
      isManualLive: true,
      liveLink: true,
      liveStreams: {
        orderBy: { createdAt: "desc" },
        select: { status: true, shareCode: true },
        take: 30,
      },
    },
  });

  // 셀러를 찾지 못하면 라이브 검색 페이지로 (코드로 재검색 가능)
  if (!seller) {
    return NextResponse.redirect(`${origin}/live?q=${encodeURIComponent(code)}`);
  }

  const streams = seller.liveStreams;
  const activeShareCode = streams.find((s) => s.status === "LIVE")?.shareCode ?? null;

  // 1순위: 라이브 커머스 실제 방송 중 → 라이브 시청 페이지
  if (activeShareCode) {
    return NextResponse.redirect(`${origin}/live/${activeShareCode}`);
  }

  // 2순위: 수동 "라이브 표시" ON + 외부 라이브 연동 링크
  if (seller.isManualLive && seller.liveLink) {
    try {
      const ext = new URL(seller.liveLink);
      if (ext.protocol === "http:" || ext.protocol === "https:") {
        return NextResponse.redirect(ext.toString());
      }
    } catch {
      // 잘못된 링크는 무시하고 아래 폴백으로 진행
    }
  }

  // 방송 중이 아닐 때: 최근 라이브 시청 페이지로 (해당 페이지에서 "방송 중이 아님" 안내 표시)
  const latestShareCode = streams[0]?.shareCode ?? null;
  if (latestShareCode) {
    return NextResponse.redirect(`${origin}/live/${latestShareCode}`);
  }

  // 라이브 이력이 전혀 없으면 셀러샵으로 폴백
  return NextResponse.redirect(`${origin}/shop/${seller.slug}`);
}
