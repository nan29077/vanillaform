import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireNode() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "NODE" || !session?.user?.id) {
    return { error: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }) };
  }
  return { nodeUserId: session.user.id };
}

// GET: 이 노드가 받은 정산 목록
export async function GET() {
  const guard = await requireNode();
  if ("error" in guard) return guard.error;

  const settlements = await (prisma as any).nodeSettlement.findMany({
    where: { nodeUserId: guard.nodeUserId },
    orderBy: { createdAt: "desc" },
  }).catch(() => []);

  return NextResponse.json({ settlements });
}
