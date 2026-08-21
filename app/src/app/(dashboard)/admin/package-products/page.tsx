import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminPackageProductsClient from "@/components/admin/AdminPackageProductsClient";

export const dynamic = "force-dynamic";

export default async function AdminPackageProductsPage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/");

  const packages = await prisma.packageProduct.findMany({
    include: {
      creator: { select: { id: true, name: true, email: true } },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              thumbnail: true,
              supplyPrice: true,
              basePrice: true,
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
    ...p,
    packagePrice: Number(p.packagePrice),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    items: p.items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      product: {
        ...item.product,
        supplyPrice: item.product.supplyPrice != null ? Number(item.product.supplyPrice) : null,
        basePrice: item.product.basePrice != null ? Number(item.product.basePrice) : null,
      },
    })),
  }));

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">패키지 상품 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          브랜드/셀러가 등록한 패키지 상품을 검토하고 승인/거부합니다.
        </p>
      </div>
      <AdminPackageProductsClient packages={serialized} />
    </div>
  );
}
