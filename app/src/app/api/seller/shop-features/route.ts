import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  if (session.user?.role !== "SELLER") return NextResponse.json({ error: "라이브 셀러만 접근 가능" }, { status: 403 });

  const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user!.id } });
  if (!seller) return NextResponse.json({ error: "라이브 셀러 프로필 없음" }, { status: 404 });

  const body = await req.json();
  const { groupBuy, content, liveCommerce } = body;

  await prisma.sellerProfile.update({
    where: { id: seller.id },
    data: {
      featureGroupBuy: Boolean(groupBuy),
      featureContent: Boolean(content),
      featureLiveCommerce: Boolean(liveCommerce),
    },
  });

  return NextResponse.json({ success: true });
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  if (session.user?.role !== "SELLER") return NextResponse.json({ error: "라이브 셀러만 접근 가능" }, { status: 403 });

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session.user!.id },
    select: { featureGroupBuy: true, featureContent: true, featureLiveCommerce: true },
  });

  return NextResponse.json({
    groupBuy: seller?.featureGroupBuy ?? true,
    content: seller?.featureContent ?? true,
    liveCommerce: seller?.featureLiveCommerce ?? false,
  });
}
