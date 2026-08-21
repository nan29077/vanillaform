import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getSeller() {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "인증 필요" }, { status: 401 }) };
  const role = (session.user as any)?.role;
  if (role !== "SELLER") return { error: NextResponse.json({ error: "셀러만 가능합니다" }, { status: 403 }) };
  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session.user!.id },
    select: { id: true },
  });
  if (!seller) return { error: NextResponse.json({ error: "셀러 프로필 없음" }, { status: 404 }) };
  return { seller };
}

// GET: 내 채널 공지 목록
export async function GET() {
  const { seller, error } = await getSeller();
  if (error) return error;
  const notices = await prisma.liveChannelNotice.findMany({
    where: { sellerId: seller!.id },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ notices });
}

// POST: 공지 등록
export async function POST(req: NextRequest) {
  const { seller, error } = await getSeller();
  if (error) return error;
  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!title || !content) {
    return NextResponse.json({ error: "제목과 내용을 입력해주세요." }, { status: 400 });
  }
  const notice = await prisma.liveChannelNotice.create({
    data: { sellerId: seller!.id, title, content, isPinned: !!body.isPinned },
  });
  return NextResponse.json({ notice });
}

// DELETE: 공지 삭제 (?id=)
export async function DELETE(req: NextRequest) {
  const { seller, error } = await getSeller();
  if (error) return error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });
  const notice = await prisma.liveChannelNotice.findUnique({ where: { id } });
  if (!notice || notice.sellerId !== seller!.id) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }
  await prisma.liveChannelNotice.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
