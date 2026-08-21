import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MiddleBrandManagementClient from "@/components/middle/MiddleBrandManagementClient";

export const dynamic = "force-dynamic";

export default async function MiddleBrandsPage() {
  const session = await auth();
  if (session?.user?.role !== "MIDDLE_ADMIN") redirect("/");

  const middleAdminId = session!.user.middleAdminId as string | undefined;
  if (!middleAdminId) redirect("/");

  // 본인 소속 브랜드만 조회
  const brands = await prisma.brandProfile.findMany({
    where: { middleAdminId },
    include: {
      user: { select: { name: true, email: true, isActive: true, createdAt: true } },
      _count: { select: { products: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = brands.map((b) => ({
    id: b.id,
    brandName: b.brandName,
    brandLogo: b.brandLogo,
    description: b.description,
    isApproved: b.isApproved,
    businessRegistrationNo: b.businessRegistrationNo,
    representativeName: b.representativeName,
    businessAddress: b.businessAddress,
    businessType: b.businessType,
    businessCategory: b.businessCategory,
    contactPhone: b.contactPhone,
    contactEmail: b.contactEmail,
    // 마진 정책은 읽기 전용 표시용 (최고관리자 전용 설정)
    marginMethod: b.marginMethod,
    marginRate: Number(b.marginRate),
    userName: b.user.name,
    userEmail: b.user.email,
    userIsActive: b.user.isActive,
    productCount: b._count.products,
    createdAt: b.createdAt.toISOString(),
  }));

  return (
    <div className="animate-fade-in">
      <MiddleBrandManagementClient brands={serialized} />
    </div>
  );
}
