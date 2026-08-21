import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
;
import CategoryManager from "@/components/shared/CategoryManager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const session = await auth();
  if (!session || session.user.role !== "SUPER_ADMIN") redirect("/");

  const topCategories = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { products: true } },
      children: {
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { products: true } } },
      },
    },
  });

  const serialized = topCategories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    image: c.image,
    description: c.description,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    productCount: c._count.products,
    children: c.children.map((sub) => ({
      id: sub.id,
      name: sub.name,
      slug: sub.slug,
      icon: sub.icon,
      image: sub.image,
      description: sub.description,
      sortOrder: sub.sortOrder,
      isActive: sub.isActive,
      productCount: sub._count.products,
      parentId: sub.parentId,
    })),
  }));

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
            <Icon name="Category" size={22} className="text-brand-500" />
            카테고리 관리
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">상단 카테고리와 하단 카테고리를 분리하여 관리합니다</p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-brand-50 to-purple-50 rounded-xl border border-brand-100 p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
            <Icon name="Package" size={16} className="text-brand-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">카테고리 구조</p>
            <p className="text-xs text-gray-500 mt-0.5">
              <strong>상단 카테고리</strong> (예: 여성, 남성, 스트릿) — 메인 페이지 상단 메뉴에 노출<br/>
              <strong>하단 카테고리</strong> (예: 패션, 뷰티, 스킨케어) — 각 상단 카테고리 아래의 세부 분류
            </p>
          </div>
        </div>
      </div>

      <CategoryManager initialCategories={serialized} />
    </div>
  );
}
