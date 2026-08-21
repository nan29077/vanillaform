import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MiddleSellerManagementClient from "@/components/middle/MiddleSellerManagementClient";

export const dynamic = "force-dynamic";

export default async function MiddleSellersPage() {
  const session = await auth();
  if (session?.user?.role !== "MIDDLE_ADMIN") redirect("/");

  const middleAdminId = session!.user.middleAdminId as string | undefined;
  if (!middleAdminId) redirect("/");

  // 본인 소속 셀러만 조회
  const sellers = await prisma.sellerProfile.findMany({
    where: { middleAdminId },
    include: {
      user: { select: { name: true, email: true, isActive: true, createdAt: true, accounts: { select: { provider: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = sellers.map((s) => ({
    id: s.id,
    slug: s.slug,
    shopName: s.shopName,
    isApproved: s.isApproved,
    // 마진율은 읽기 전용 표시용 (최고관리자 전용 설정)
    middleAdminMarginRate: Number(s.middleAdminMarginRate),
    userName: s.user.name,
    userEmail: s.user.email,
    userIsActive: s.user.isActive,
    authProviders: [...new Set(s.user.accounts.map((a) => a.provider))],
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <div className="animate-fade-in">
      <MiddleSellerManagementClient sellers={serialized} />
    </div>
  );
}
