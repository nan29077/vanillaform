import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSellerLive, sellerProfileImage } from "@/lib/sellerLive";

export const dynamic = "force-dynamic";

// 라이브 코드(shareCode) 또는 셀러명/슬러그로 셀러를 검색해 셀러 카드 정보를 반환.
// (지난 방송 결과는 노출하지 않고, 셀러의 "현재 라이브 여부"만 함께 내려준다.)
export async function GET(req: NextRequest) {
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ sellers: [] });

  // 1) 셀러명/슬러그 매칭
  const byName = await prisma.sellerProfile.findMany({
    where: {
      isApproved: true,
      OR: [{ shopName: { contains: q } }, { slug: { contains: q } }],
    },
    select: {
      id: true, slug: true, shopName: true, shopLogo: true, mood: true, isManualLive: true,
      liveLink: true,
      user: { select: { avatar: true } },
      liveStreams: { where: { status: "LIVE" }, select: { shareCode: true }, take: 1 },
    },
    take: 20,
  });

  // 2) 라이브 코드(shareCode) 정확 매칭 → 해당 셀러
  const byCode = await prisma.liveStream.findMany({
    where: { shareCode: q },
    select: {
      status: true, shareCode: true,
      seller: {
        select: {
          id: true, slug: true, shopName: true, shopLogo: true, mood: true, isManualLive: true,
          liveLink: true,
          user: { select: { avatar: true } },
          liveStreams: { where: { status: "LIVE" }, select: { shareCode: true }, take: 1 },
        },
      },
    },
    take: 5,
  });

  // 라이브 여부: 수동 표시(isManualLive) 또는 실제 LIVE 방송 — 단골픽/내픽과 동일 기준.
  const toCard = (s: any) => ({
    id: s.id,
    slug: s.slug,
    shopName: s.shopName,
    profileImage: sellerProfileImage(s),
    mood: s.mood,
    isLive: isSellerLive(s),
    liveShareCode: s.liveStreams[0]?.shareCode || null,
    liveLink: s.liveLink || null,
  });

  const map = new Map<string, any>();
  for (const s of byName) map.set(s.id, toCard(s));
  for (const l of byCode) {
    const s = l.seller;
    if (!map.has(s.id)) map.set(s.id, toCard(s));
  }

  return NextResponse.json({ sellers: [...map.values()] });
}
