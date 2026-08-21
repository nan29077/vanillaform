import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: 댓글 목록 조회
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const contentId = params.id;

  const comments = await prisma.contentComment.findMany({
    where: { contentId, parentId: null },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
      replies: {
        include: {
          user: { select: { id: true, name: true, avatar: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const serialized = comments.map((c) => ({
    id: c.id,
    text: c.text,
    createdAt: c.createdAt.toISOString(),
    user: c.user,
    replies: c.replies.map((r) => ({
      id: r.id,
      text: r.text,
      createdAt: r.createdAt.toISOString(),
      user: r.user,
    })),
  }));

  const totalCount = await prisma.contentComment.count({ where: { contentId } });

  return NextResponse.json({ comments: serialized, totalCount });
}

// POST: 댓글 작성
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const contentId = params.id;
  const { text, parentId } = await req.json();

  if (!text?.trim()) {
    return NextResponse.json({ error: "댓글 내용을 입력해주세요" }, { status: 400 });
  }

  const post = await prisma.contentPost.findUnique({ where: { id: contentId } });
  if (!post) return NextResponse.json({ error: "콘텐츠 없음" }, { status: 404 });

  // parentId가 있으면 대댓글 확인
  if (parentId) {
    const parent = await prisma.contentComment.findUnique({ where: { id: parentId } });
    if (!parent || parent.contentId !== contentId) {
      return NextResponse.json({ error: "원댓글을 찾을 수 없습니다" }, { status: 400 });
    }
  }

  const comment = await prisma.contentComment.create({
    data: {
      userId: session.user!.id,
      contentId,
      text: text.trim(),
      parentId: parentId || null,
    },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
    },
  });

  return NextResponse.json({
    comment: {
      id: comment.id,
      text: comment.text,
      createdAt: comment.createdAt.toISOString(),
      user: comment.user,
      replies: [],
    },
  });
}

// DELETE: 댓글 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const commentId = searchParams.get("commentId");
  if (!commentId) return NextResponse.json({ error: "댓글 ID 필요" }, { status: 400 });

  const comment = await prisma.contentComment.findUnique({ where: { id: commentId } });
  if (!comment) return NextResponse.json({ error: "댓글 없음" }, { status: 404 });

  const role = session.user.role;
  if (comment.userId !== session.user!.id && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  await prisma.contentComment.delete({ where: { id: commentId } });
  return NextResponse.json({ message: "삭제되었습니다" });
}
