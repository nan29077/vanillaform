import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 패키지 구성용 승인된 상품 목록
// 브랜드/관리자가 등록하고 승인된 상품만 반환 (카테고리·브랜드 필터 지원)
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const role = (session.user as any).role as string;
  if (!["SUPER_ADMIN", "BRAND_ADMIN", "SELLER", "MIDDLE_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId");
  const brandId = searchParams.get("brandId");
  const search = searchParams.get("search");

  const where: any = {
    isApproved: true,
    isActive: true,
    brandId: { not: null }, // 브랜드 상품만 (브랜드 userId가 있어야 발주서 생성 가능)
  };

  // 중간관리자: 소속(하위) 브랜드 상품만 패키지 구성 가능
  const middleAdminId =
    role === "MIDDLE_ADMIN" ? ((session.user as any).middleAdminId as string | undefined) : undefined;
  if (role === "MIDDLE_ADMIN") {
    if (!middleAdminId) {
      return NextResponse.json({ error: "중간관리자 정보를 찾을 수 없습니다." }, { status: 403 });
    }
    where.brand = { middleAdminId };
  }

  if (categoryId) where.categoryId = categoryId;
  if (brandId) where.brandId = brandId;
  if (search) {
    where.name = { contains: search };
  }

  const brandWhere: any = { isApproved: true };
  if (middleAdminId) brandWhere.middleAdminId = middleAdminId;

  const [products, categories, brands] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        thumbnail: true,
        basePrice: true,
        supplyPrice: true,
        categoryId: true,
        category: { select: { id: true, name: true } },
        brandId: true,
        brand: { select: { id: true, brandName: true, userId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.category.findMany({
      where: { isActive: true, parentId: null },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.brandProfile.findMany({
      where: brandWhere,
      select: { id: true, brandName: true },
      orderBy: { brandName: "asc" },
    }),
  ]);

  return NextResponse.json({
    products: products.map((p) => ({
      ...p,
      basePrice: Number(p.basePrice),
      supplyPrice: p.supplyPrice ? Number(p.supplyPrice) : null,
    })),
    categories,
    brands,
  });
}
