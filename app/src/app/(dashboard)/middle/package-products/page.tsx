import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MiddlePackageProductsClient from "@/components/middle/MiddlePackageProductsClient";

export const dynamic = "force-dynamic";

export default async function MiddlePackageProductsPage() {
  const session = await auth();
  if (session?.user?.role !== "MIDDLE_ADMIN") redirect("/");

  const middleAdminId = session!.user.middleAdminId as string | undefined;
  if (!middleAdminId) redirect("/");

  const userId = session!.user!.id as string;

  // 본인 등록 패키지 + 소속(하위) 브랜드가 등록한 패키지
  const packages = await prisma.packageProduct.findMany({
    where: {
      OR: [
        { creatorId: userId },
        { creator: { brandProfile: { middleAdminId } } },
      ],
    },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
          brandProfile: { select: { brandName: true } },
        },
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              thumbnail: true,
              brand: { select: { brandName: true } },
            },
          },
        },
      },
      _count: { select: { packageOrderItems: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = packages.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    packagePrice: Number(p.packagePrice),
    middleAdminMargin:
      (p as any).middleAdminMargin != null ? Number((p as any).middleAdminMargin) : null,
    stock: p.stock,
    status: p.status,
    rejectReason: p.rejectReason,
    isOwn: p.creatorId === userId,
    creatorName: p.creator.brandProfile?.brandName || p.creator.name || p.creator.email,
    orderCount: p._count.packageOrderItems,
    createdAt: p.createdAt.toISOString(),
    items: p.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      productName: item.product.name,
      productThumbnail: item.product.thumbnail,
      brandName: item.product.brand?.brandName || null,
    })),
  }));

  return (
    <div className="animate-fade-in">
      <MiddlePackageProductsClient initialPackages={serialized} />
    </div>
  );
}
