import { NextResponse } from "next/server";
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

// GET: 이 노드 담당 전체 회원 (중간관리자 + 브랜드 + 셀러)
export async function GET() {
  const guard = await requireNode();
  if ("error" in guard) return guard.error;

  const { nodeUserId } = guard;

  // 1) 담당 중간관리자
  const middleAdmins = await (prisma as any).middleAdminProfile.findMany({
    where: { assignedNodeId: nodeUserId },
    include: {
      user: { select: { name: true, email: true, isActive: true, createdAt: true } },
      _count: { select: { brands: true, sellers: true } },
    },
    orderBy: { createdAt: "desc" },
  }).catch(() => []);

  // 2) 담당 중간관리자 ID 목록
  const middleAdminIds = middleAdmins.map((m: any) => m.id);

  // 3) 중간관리자 소속 브랜드 + 직접 노드 배정 브랜드
  const brands = await prisma.brandProfile.findMany({
    where: {
      OR: [
        ...(middleAdminIds.length > 0 ? [{ middleAdminId: { in: middleAdminIds } }] : []),
        { assignedNodeId: nodeUserId } as any,
      ],
    },
    include: {
      user: { select: { name: true, email: true, isActive: true, createdAt: true } },
      _count: { select: { products: true } },
    },
    orderBy: { createdAt: "desc" },
  }).catch(() => []);

  // 4) 중간관리자 소속 셀러
  const sellers = await prisma.sellerProfile.findMany({
    where: middleAdminIds.length > 0
      ? { middleAdminId: { in: middleAdminIds } }
      : { id: "__none__" }, // 중간관리자 없으면 셀러도 없음
    include: {
      user: { select: { name: true, email: true, isActive: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  }).catch(() => []);

  return NextResponse.json({ middleAdmins, brands, sellers });
}
