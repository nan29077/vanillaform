import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const session = await auth();
  if ((session?.user as any)?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { isActive } = await req.json();

  const updated = await prisma.user.update({
    where: { id: params.userId },
    data: { isActive },
    select: { id: true, name: true, email: true, isActive: true },
  });

  return NextResponse.json(updated);
}
