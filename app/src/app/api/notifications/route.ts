import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 현재 로그인 사용자의 알림 목록 + 미읽음 개수 조회
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ items: [], unreadCount: 0 });
  }

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({
      where: { userId: session.user.id, isRead: false },
    }),
  ]);

  return NextResponse.json({
    items: items.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      isRead: n.isRead,
      linkUrl: n.linkUrl,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  });
}
