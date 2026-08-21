import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NodeSellerManagementClient from "@/components/node/NodeSellerManagementClient";

export const dynamic = "force-dynamic";

export default async function NodeSellersPage() {
  const session = await auth();
  if ((session?.user as any)?.role !== "NODE") redirect("/");

  const nodeUserId = session!.user!.id;

  // 이 노드 담당 중간관리자 ID 목록
  const myMiddleAdmins: any[] = await (async () => {
    try {
      return await (prisma as any).middleAdminProfile.findMany({
        where: { assignedNodeId: nodeUserId },
        select: { id: true },
      });
    } catch {
      return [];
    }
  })();

  const middleAdminIds = (myMiddleAdmins as any[]).map((m: any) => m.id);

  // 중간관리자 소속 셀러만 조회 (중간관리자 없으면 빈 결과 반환)
  const sellers = await prisma.sellerProfile.findMany({
    where: middleAdminIds.length > 0
      ? { middleAdminId: { in: middleAdminIds } }
      : { id: "__none__" },
    include: {
      user: { select: { name: true, email: true, isActive: true, createdAt: true, accounts: { select: { provider: true } } } },
      middleAdmin: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = sellers.map((s) => ({
    id: s.id,
    slug: s.slug,
    shopName: s.shopName,
    isApproved: s.isApproved,
    userName: s.user.name,
    userEmail: s.user.email,
    userIsActive: s.user.isActive,
    authProviders: [...new Set(s.user.accounts.map((a) => a.provider))],
    middleAdminName: (s as any).middleAdmin?.name ?? null,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <div className="animate-fade-in">
      <NodeSellerManagementClient sellers={serialized} />
    </div>
  );
}
