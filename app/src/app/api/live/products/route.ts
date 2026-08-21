import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: 라이브커머스용 상품 목록 (브랜드/관리자/셀러)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const role = session.user?.role;
  
  let products: any[] = [];

  if (role === "SELLER") {
    const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user!.id } });
    if (!seller) return NextResponse.json({ error: "라이브 셀러 프로필 없음" }, { status: 404 });

    // 셀러가 상품관리에서 자기 샵에 추가한 상품만 노출
    // - 셀러가 직접 등록한 상품(브랜드 없음) → 내 상품 탭
    // - 브랜드/관리자 상품을 샵에 추가한 것(브랜드 있음) → 바닐라폼 상품 탭
    const shopProducts = await prisma.sellerShopProduct.findMany({
      where: { sellerId: seller.id, isActive: true },
      include: { product: { include: { brand: true, category: true } } },
      orderBy: { createdAt: "desc" },
    });

    products = shopProducts.map(sp => ({
      id: sp.product.id,
      name: sp.product.name,
      thumbnail: sp.product.thumbnail,
      basePrice: Number(sp.product.basePrice),
      comparePrice: sp.product.comparePrice ? Number(sp.product.comparePrice) : null,
      brandName: sp.product.brand?.brandName || null,
      categoryName: sp.product.category?.name || null,
      badges: sp.product.badges,
      allowLiveCommerce: (sp.product as any).allowLiveCommerce ?? false,
      isOwn: !sp.product.brandId,
    }));
  } else if (role === "BRAND_ADMIN") {
    const brand = await prisma.brandProfile.findUnique({ where: { userId: session.user!.id } });
    if (!brand) return NextResponse.json({ error: "브랜드 프로필 없음" }, { status: 404 });

    const brandProducts = await prisma.product.findMany({
      where: { brandId: brand.id, isActive: true },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });

    products = brandProducts.map(p => ({
      id: p.id,
      name: p.name,
      thumbnail: p.thumbnail,
      basePrice: Number(p.basePrice),
      comparePrice: p.comparePrice ? Number(p.comparePrice) : null,
      brandName: brand.brandName,
      categoryName: p.category?.name || null,
      badges: p.badges,
      allowLiveCommerce: (p as any).allowLiveCommerce ?? false,
      isOwn: true,
    }));
  } else if (role === "SUPER_ADMIN") {
    const allProducts = await prisma.product.findMany({
      where: { isActive: true },
      include: { brand: true, category: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    products = allProducts.map(p => ({
      id: p.id,
      name: p.name,
      thumbnail: p.thumbnail,
      basePrice: Number(p.basePrice),
      comparePrice: p.comparePrice ? Number(p.comparePrice) : null,
      brandName: p.brand?.brandName || null,
      categoryName: p.category?.name || null,
      badges: p.badges,
      allowLiveCommerce: (p as any).allowLiveCommerce ?? false,
      isOwn: true,
    }));
  }

  return NextResponse.json({ products });
}

// POST: 라이브커머스 상품 관리 (활성/비활성 토글)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const role = session.user?.role;
  if (!["BRAND_ADMIN", "SUPER_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const body = await req.json();
  const { action, productId } = body;

  if (action === "toggle_live") {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return NextResponse.json({ error: "상품 없음" }, { status: 404 });

    // 라이브커머스 허용 토글 (allowLiveCommerce 필드 사용)
    await prisma.product.update({
      where: { id: productId },
      data: { allowLiveCommerce: !(product as any).allowLiveCommerce },
    });

    return NextResponse.json({ success: true, allowLiveCommerce: !(product as any).allowLiveCommerce });
  }

  if (action === "enable_live") {
    await prisma.product.update({
      where: { id: productId },
      data: { allowLiveCommerce: true },
    });
    return NextResponse.json({ success: true });
  }

  if (action === "disable_live") {
    await prisma.product.update({
      where: { id: productId },
      data: { allowLiveCommerce: false },
    });
    return NextResponse.json({ success: true });
  }

  // 라이브 방송에서 상품 표시/숨기기 (라이브 스트림 상품 isActive 토글)
  if (action === "toggle_display") {
    const { liveProductId } = body;
    if (!liveProductId) return NextResponse.json({ error: "liveProductId 필요" }, { status: 400 });
    
    const liveProduct = await prisma.liveStreamProduct.findUnique({ where: { id: liveProductId } });
    if (!liveProduct) return NextResponse.json({ error: "라이브 상품 없음" }, { status: 404 });

    await prisma.liveStreamProduct.update({
      where: { id: liveProductId },
      data: { isActive: !liveProduct.isActive },
    });
    return NextResponse.json({ success: true, isActive: !liveProduct.isActive });
  }

  return NextResponse.json({ error: "알 수 없는 액션" }, { status: 400 });
}
