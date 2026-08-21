import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NodeMembersClient from "@/components/node/NodeMembersClient";

export const dynamic = "force-dynamic";

export default async function NodeMembersPage() {
  const session = await auth();
  if ((session?.user as any)?.role !== "NODE") redirect("/");

  const nodeUserId = session!.user!.id;

  // 담당 중간관리자
  const middleAdmins: any[] = await (async () => {
    try {
      return await (prisma as any).middleAdminProfile.findMany({
        where: { assignedNodeId: nodeUserId },
        include: {
          user: { select: { name: true, email: true, isActive: true, createdAt: true, accounts: { select: { provider: true } } } },
          _count: { select: { brands: true, sellers: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch {
      return [];
    }
  })();

  const middleAdminIds = (middleAdmins as any[]).map((m: any) => m.id);

  // 중간관리자 소속 + 직접 배정 브랜드
  const brands = await prisma.brandProfile.findMany({
    where: {
      OR: [
        ...(middleAdminIds.length > 0 ? [{ middleAdminId: { in: middleAdminIds } }] : []),
        { assignedNodeId: nodeUserId } as any,
      ],
    },
    include: {
      user: { select: { name: true, email: true, isActive: true, createdAt: true, accounts: { select: { provider: true } } } },
      middleAdmin: { select: { name: true } },
      _count: { select: { products: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // 중간관리자 소속 셀러
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

  const serializedMiddleAdmins = (middleAdmins as any[]).map((m: any) => ({
    id: m.id,
    name: m.name,
    contactPhone: m.contactPhone,
    isActive: m.isActive,
    isApproved: m.isApproved,
    commissionRate: String(m.commissionRate),
    userName: m.user.name,
    userEmail: m.user.email,
    userIsActive: m.user.isActive,
    authProviders: [...new Set((m.user.accounts ?? []).map((a: any) => a.provider))] as string[],
    brandCount: m._count.brands,
    sellerCount: m._count.sellers,
    createdAt: m.createdAt.toISOString(),
  }));

  const serializedBrands = brands.map((b) => ({
    id: b.id,
    brandName: b.brandName,
    brandLogo: b.brandLogo,
    isApproved: b.isApproved,
    userName: b.user.name,
    userEmail: b.user.email,
    userIsActive: b.user.isActive,
    authProviders: [...new Set(b.user.accounts.map((a) => a.provider))],
    middleAdminName: (b as any).middleAdmin?.name ?? null,
    productCount: b._count.products,
    createdAt: b.createdAt.toISOString(),
  }));

  const serializedSellers = sellers.map((s) => ({
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
      <NodeMembersClient
        middleAdmins={serializedMiddleAdmins}
        brands={serializedBrands}
        sellers={serializedSellers}
      />
    </div>
  );
}
