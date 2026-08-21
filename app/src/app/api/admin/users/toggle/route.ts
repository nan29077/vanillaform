import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Toggle user active status
export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { userId, isActive } = await request.json();
  if (!userId || isActive === undefined) {
    return NextResponse.json({ error: "필수 정보가 누락되었습니다." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  });

  return NextResponse.json({ success: true, user });
}
