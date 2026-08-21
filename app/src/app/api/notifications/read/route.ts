import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 알림 읽음 처리. body.ids 가 있으면 해당 알림만, 없으면 전체 미읽음을 읽음 처리.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  let ids: string[] | undefined;
  try {
    const body = await req.json();
    if (Array.isArray(body?.ids)) ids = body.ids.filter((x: unknown) => typeof x === "string");
  } catch {
    // body 없음 → 전체 읽음
  }

  await prisma.notification.updateMany({
    where: {
      userId: session.user.id,
      isRead: false,
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
    },
    data: { isRead: true },
  });

  return NextResponse.json({ success: true });
}
