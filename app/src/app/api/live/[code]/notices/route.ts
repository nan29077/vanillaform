import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: 채널 공지사항 목록
export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const live = await prisma.liveStream.findUnique({
      where: { shareCode: params.code },
      select: { sellerId: true },
    });
    if (!live) {
      return NextResponse.json({ error: "라이브 채널을 찾을 수 없습니다." }, { status: 404 });
    }

    const notices = await prisma.liveChannelNotice.findMany({
      where: { sellerId: live.sellerId },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: 30,
    });

    return NextResponse.json({ notices });
  } catch (error) {
    console.error("공지사항 조회 오류:", error);
    return NextResponse.json({ error: "공지사항을 불러올 수 없습니다." }, { status: 500 });
  }
}
