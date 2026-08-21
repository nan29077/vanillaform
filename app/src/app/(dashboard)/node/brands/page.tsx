import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NodeBrandManagementClient from "@/components/node/NodeBrandManagementClient";

export const dynamic = "force-dynamic";

export default async function NodeBrandsPage() {
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

  // 중간관리자 소속 브랜드 + 직접 노드 배정 브랜드
  const orClauses: any[] = [{ assignedNodeId: nodeUserId }];
  if (middleAdminIds.length > 0) {
    orClauses.push({ middleAdminId: { in: middleAdminIds } });
  }

  const brands = await prisma.brandProfile.findMany({
    where: { OR: orClauses },
    include: {
      user: { select: { name: true, email: true, isActive: true, createdAt: true } },
      middleAdmin: { select: { name: true } },
      _count: { select: { products: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = brands.map((b) => ({
    id: b.id,
    brandName: b.brandName,
    brandLogo: b.brandLogo,
    isApproved: b.isApproved,
    businessRegistrationNo: b.businessRegistrationNo,
    representativeName: b.representativeName,
    contactPhone: b.contactPhone,
    contactEmail: b.contactEmail,
    userName: b.user.name,
    userEmail: b.user.email,
    userIsActive: b.user.isActive,
    middleAdminName: (b as any).middleAdmin?.name ?? null,
    productCount: b._count.products,
    createdAt: b.createdAt.toISOString(),
  }));

  return (
    <div className="animate-fade-in">
      <NodeBrandManagementClient brands={serialized} />
    </div>
  );
}
