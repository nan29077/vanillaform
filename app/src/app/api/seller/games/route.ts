import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isGameType, usesItems } from "@/lib/gameTypes";

// 이모지 문자 제거 유틸
function stripEmoji(str: string): string {
  return str
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E0}-\u{1F1FF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const dynamic = "force-dynamic";

// GET: 셀러 게임 목록
export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    if (session.user.role !== "SELLER") {
      return NextResponse.json({ error: "라이브 셀러 전용" }, { status: 403 });
    }

    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!seller) return NextResponse.json({ error: "라이브 셀러 프로필 없음" }, { status: 400 });

    const games = await prisma.game.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ games });
  } catch (error) {
    console.error("Seller games list error:", error);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

// POST: 게임 생성
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    if (session.user.role !== "SELLER") {
      return NextResponse.json({ error: "라이브 셀러 전용" }, { status: 403 });
    }

    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!seller) return NextResponse.json({ error: "라이브 셀러 프로필 없음" }, { status: 400 });

    const body = await req.json();
    const { type, title } = body;
    const items: unknown = body.items;
    const config: unknown = body.config;

    if (!type || !isGameType(type)) {
      return NextResponse.json({ error: "게임 종류가 올바르지 않습니다" }, { status: 400 });
    }
    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "제목을 입력해주세요" }, { status: 400 });
    }
    const cleanItems = Array.isArray(items)
      ? items.map((i) => String(i).trim()).filter(Boolean)
      : [];
    // 항목 기반 게임(룰렛·사다리·제비뽑기·연속룰렛)만 항목 2개 이상 필수
    if (usesItems(type) && cleanItems.length < 2) {
      return NextResponse.json({ error: "항목을 2개 이상 입력해주세요" }, { status: 400 });
    }

    const game = await prisma.game.create({
      data: {
        sellerId: seller.id,
        type,
        title: stripEmoji(title),
        items: JSON.stringify(cleanItems),
        config: config != null ? JSON.stringify(config) : null,
        status: "IDLE",
      },
    });

    return NextResponse.json({ success: true, game }, { status: 201 });
  } catch (error) {
    console.error("Seller game create error:", error);
    return NextResponse.json({ error: "생성 실패" }, { status: 500 });
  }
}
