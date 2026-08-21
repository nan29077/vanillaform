import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNodeEnabled } from "@/lib/systemConfig";
import NodeProductsClient from "@/components/node/NodeProductsClient";

export const dynamic = "force-dynamic";

export default async function NodeProductsPage() {
  const session = await auth();
  if (session?.user?.role !== "NODE") redirect("/");

  const nodeEnabled = await getNodeEnabled();
  if (!nodeEnabled) redirect("/");

  const [pending, approved] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, isApproved: false, nodeApprovedAt: null, sellerId: null },
      include: {
        brand: { select: { brandName: true, middleAdminId: true } },
        middleAdmin: { select: { name: true } },
        category: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.product.findMany({
      where: { isActive: true, isApproved: false, nodeApprovedAt: { not: null } },
      include: {
        brand: { select: { brandName: true } },
        category: { select: { name: true } },
      },
      orderBy: { nodeApprovedAt: "desc" },
      take: 300,
    }),
  ]);

  const serialize = (p: any) => ({
    id: p.id,
    name: p.name,
    thumbnail: p.thumbnail,
    brandName: p.brand?.brandName || null,
    middleAdminName: p.middleAdmin?.name || null,
    viaMiddleAdmin: !!(p.middleAdminId || p.brand?.middleAdminId),
    categoryName: p.category?.name || null,
    supplyPrice: p.supplyPrice != null ? Number(p.supplyPrice) : null,
    basePrice: Number(p.basePrice),
    middleAdminMargin: p.middleAdminMargin != null ? Number(p.middleAdminMargin) : null,
    nodeMargin: p.nodeMargin != null ? Number(p.nodeMargin) : null,
    nodeMarginType: p.nodeMarginType || null,
    nodeApprovedAt: p.nodeApprovedAt ? p.nodeApprovedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  });

  return (
    <div className="animate-fade-in">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-gray-900">주문관리</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          노드로 들어온 상품에 마진을 설정하고 최종 등록하면 최고관리자 승인 단계로 넘어갑니다.
        </p>
      </div>
      <NodeProductsClient
        initialPending={pending.map(serialize)}
        initialApproved={approved.map(serialize)}
      />
    </div>
  );
}
