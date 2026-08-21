import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: 좋아요 상태 조회
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  const contentId = params.id;

  const post = await prisma.contentPost.findUnique({
    where: { id: contentId },
    select: { likeCount: true },
  });

  if (!post) return NextResponse.json({ error: "콘텐츠 없음" }, { status: 404 });

  let isLiked = false;
  if (session?.user?.id) {
    const like = await prisma.contentLike.findUnique({
      where: { userId_contentId: { userId: session.user.id, contentId } },
    });
    isLiked = !!like;
  }

  return NextResponse.json({ isLiked, likeCount: post.likeCount });
}

// POST: 좋아요 토글
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const contentId = params.id;
  const userId = session.user!.id;

  const post = await prisma.contentPost.findUnique({ where: { id: contentId } });
  if (!post) return NextResponse.json({ error: "콘텐츠 없음" }, { status: 404 });

  const existing = await prisma.contentLike.findUnique({
    where: { userId_contentId: { userId, contentId } },
  });

  if (existing) {
    // 좋아요 취소
    await prisma.$transaction([
      prisma.contentLike.delete({ where: { id: existing.id } }),
      prisma.contentPost.update({
        where: { id: contentId },
        data: { likeCount: { decrement: 1 } },
      }),
    ]);
    return NextResponse.json({ isLiked: false, likeCount: post.likeCount - 1 });
  } else {
    // 좋아요
    await prisma.$transaction([
      prisma.contentLike.create({ data: { userId, contentId } }),
      prisma.contentPost.update({
        where: { id: contentId },
        data: { likeCount: { increment: 1 } },
      }),
    ]);
    return NextResponse.json({ isLiked: true, likeCount: post.likeCount + 1 });
  }
}
