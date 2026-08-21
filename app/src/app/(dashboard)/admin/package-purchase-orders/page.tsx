import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PackagePurchaseOrdersClient from "@/components/shared/PackagePurchaseOrdersClient";

export const dynamic = "force-dynamic";

export default async function AdminPackagePurchaseOrdersPage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/");

  const purchaseOrders = await prisma.packagePurchaseOrder.findMany({
    include: {
      packageOrderItem: {
        include: {
          package: {
            select: { id: true, name: true, packagePrice: true },
          },
        },
      },
      recipient: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = purchaseOrders.map((po) => ({
    ...po,
    amount: Number(po.amount),
    createdAt: po.createdAt.toISOString(),
    updatedAt: po.updatedAt.toISOString(),
    packageOrderItem: {
      ...po.packageOrderItem,
      packagePrice: Number(po.packageOrderItem.packagePrice),
      paidAt: po.packageOrderItem.paidAt?.toISOString() || null,
      createdAt: po.packageOrderItem.createdAt.toISOString(),
      updatedAt: po.packageOrderItem.updatedAt.toISOString(),
      package: {
        ...po.packageOrderItem.package,
        packagePrice: Number(po.packageOrderItem.package.packagePrice),
      },
    },
  }));

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">패키지 발주서 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          패키지 상품 구매 시 생성된 발주서 전체 목록입니다.
        </p>
      </div>
      <PackagePurchaseOrdersClient purchaseOrders={serialized} role="SUPER_ADMIN" />
    </div>
  );
}
