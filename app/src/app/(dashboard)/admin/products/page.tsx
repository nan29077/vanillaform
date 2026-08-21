import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminProductsClient from "@/components/admin/AdminProductsClient";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/");

  const [products, pendingShopProducts, soldSellerProducts, brands, middleAdmins, sellers, shopSellerRows, activeSellerRows, pendingPackages] = await Promise.all([
    prisma.product.findMany({
      include: {
        brand: true,
        category: true,
        registrarSeller: { select: { shopName: true } },
        middleAdmin: { select: { name: true } },
        _count: { select: { reviews: true, campaigns: true, sellerProducts: true, chats: true, wishlists: true } },
        sellerProducts: {
          include: { seller: { select: { id: true, shopName: true, shopLogo: true } } },
          take: 5,
        },
        campaigns: {
          where: { status: { in: ["ACTIVE", "SCHEDULED"] } },
          include: { seller: { select: { id: true, shopName: true } } },
          take: 3,
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    // 셀러 신청 승인 대기 — 최고관리자가 직접 등록한 상품(브랜드·중간관리자·셀러 없음)만.
    // 브랜드/중간관리자 소속 상품 신청은 각 대시보드에서 승인.
    prisma.sellerShopProduct.findMany({
      where: {
        isApproved: false,
        rejectionReason: null,
        product: { brandId: null, middleAdminId: null, sellerId: null },
      },
      include: {
        product: { include: { brand: true, category: true } },
        seller: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // 판매 중인 상품 — 최고관리자가 승인해 셀러가 현재 판매 중(승인+활성)인 상품
    prisma.sellerShopProduct.findMany({
      where: {
        isApproved: true,
        isActive: true,
        product: { brandId: null, middleAdminId: null, sellerId: null },
      },
      include: {
        product: { select: { id: true, name: true, thumbnail: true } },
        seller: { select: { shopName: true, shopLogo: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.brandProfile.findMany({
      orderBy: { brandName: "asc" },
    }),
    // 중간관리자별 필터용 목록
    prisma.middleAdminProfile.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // 셀러별 필터용 목록
    prisma.sellerProfile.findMany({
      select: { id: true, shopName: true },
      orderBy: { shopName: "asc" },
    }),
    // 상품별 셀러 샵 매핑 (셀러별 필터용)
    prisma.sellerShopProduct.findMany({
      select: { productId: true, sellerId: true },
    }),
    // 판매중(승인+활성) 셀러 매핑 — "판매중" 탭 필터용
    prisma.sellerShopProduct.findMany({
      where: { isApproved: true, isActive: true },
      select: {
        productId: true,
        seller: { select: { id: true, shopName: true, shopLogo: true } },
      },
    }),
    // 패키지 승인 대기 목록
    prisma.packageProduct.findMany({
      where: { status: "PENDING" },
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
    }),
  ]);

  // 상품ID → 해당 상품이 담긴 셀러 샵 sellerId 목록
  const shopSellerMap = new Map<string, string[]>();
  for (const row of shopSellerRows) {
    const list = shopSellerMap.get(row.productId) ?? [];
    list.push(row.sellerId);
    shopSellerMap.set(row.productId, list);
  }

  // 상품ID → 판매중(승인+활성) 셀러 목록
  const activeSellerMap = new Map<string, { id: string; shopName: string; shopLogo: string | null }[]>();
  for (const row of activeSellerRows) {
    const list = activeSellerMap.get(row.productId) ?? [];
    list.push({ id: row.seller.id, shopName: row.seller.shopName, shopLogo: row.seller.shopLogo });
    activeSellerMap.set(row.productId, list);
  }

  const serializedProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    basePrice: Number(p.basePrice),
    supplyPrice: p.supplyPrice != null ? Number(p.supplyPrice) : null,
    middleAdminMargin: p.middleAdminMargin != null ? Number(p.middleAdminMargin) : null,
    thumbnail: p.thumbnail,
    isApproved: p.isApproved,
    isActive: p.isActive,
    brandName: p.brand?.brandName || null,
    // 필터용 식별자
    brandId: p.brandId,
    middleAdminId: p.middleAdminId ?? p.brand?.middleAdminId ?? null,
    registrarSellerId: p.sellerId,
    shopSellerIds: shopSellerMap.get(p.id) ?? [],
    categoryName: p.category?.name || null,
    // 등록자 유형: 셀러 > 브랜드 > 중간관리자(본인 등록) > 관리자
    registrarType: (p.sellerId
      ? "SELLER"
      : p.brandId
        ? "BRAND"
        : p.middleAdminId
          ? "MIDDLE_ADMIN"
          : "ADMIN") as "SELLER" | "BRAND" | "MIDDLE_ADMIN" | "ADMIN",
    registeredBy: p.brandId
      ? `브랜드 (${p.brand?.brandName || ""})`
      : p.sellerId
        ? `라이브 셀러 (${p.registrarSeller?.shopName || ""})`
        : p.middleAdminId
          ? `중간관리자 (${p.middleAdmin?.name || ""})`
          : "관리자",
    sellerNames: p.sellerProducts.map(sp => sp.seller.shopName),
    sellerCount: p._count.sellerProducts,
    reviewCount: p._count.reviews,
    campaignCount: p._count.campaigns,
    chatCount: p._count.chats,
    soldCount: p.soldCount,
    wishlistCount: p._count.wishlists,
    createdAt: p.createdAt.toISOString(),
    sellerLogos: p.sellerProducts.map(sp => ({ id: sp.seller.id, shopName: sp.seller.shopName, shopLogo: sp.seller.shopLogo })),
    activeCampaigns: p.campaigns.map(c => ({ id: c.id, sellerName: c.seller.shopName })),
    // 판매중(승인+활성) 셀러 정보
    activeSellers: (activeSellerMap.get(p.id) ?? []).slice(0, 5),
    isSelling: (activeSellerMap.get(p.id) ?? []).length > 0,
  }));

  const serializedPending = pendingShopProducts.map((sp) => ({
    id: sp.id,
    productId: sp.product.id,
    productName: sp.product.name,
    productThumbnail: sp.product.thumbnail,
    brandName: sp.product.brand?.brandName || null,
    sellerName: sp.seller.shopName,
    sellerPrice: sp.sellerPrice != null ? Number(sp.sellerPrice) : null,
    createdAt: sp.createdAt.toISOString(),
  }));

  const serializedSold = soldSellerProducts.map((sp) => ({
    id: sp.id,
    productId: sp.product.id,
    productName: sp.product.name,
    productThumbnail: sp.product.thumbnail,
    sellerName: sp.seller.shopName,
    sellerShopLogo: sp.seller.shopLogo || null,
    sellerPrice: sp.sellerPrice != null ? Number(sp.sellerPrice) : null,
    approvedAt: sp.createdAt.toISOString(),
  }));

  const serializedBrands = brands.map((b) => ({
    id: b.id,
    brandName: b.brandName,
    marginPolicy: b.marginMethod && b.marginBase
      ? { method: b.marginMethod as "PERCENTAGE" | "SUPPLY_BASE", base: b.marginBase as "SUPPLY" | "SALE", rate: Number(b.marginRate) }
      : null,
  }));

  const serializedMiddleAdmins = middleAdmins.map((m) => ({ id: m.id, name: m.name }));
  const serializedSellers = sellers.map((s) => ({ id: s.id, shopName: s.shopName }));

  const serializedPendingPackages = pendingPackages.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    packagePrice: Number(p.packagePrice),
    stock: p.stock,
    status: p.status,
    rejectReason: p.rejectReason,
    creatorId: p.creatorId,
    creatorRole: p.creatorRole,
    createdAt: p.createdAt.toISOString(),
    creator: p.creator,
    items: p.items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      product: {
        ...item.product,
        supplyPrice: item.product.supplyPrice != null ? Number(item.product.supplyPrice) : null,
        basePrice: item.product.basePrice != null ? Number(item.product.basePrice) : null,
      },
    })),
    _count: p._count,
  }));

  return (
    <div className="animate-fade-in">
      <AdminProductsClient
        products={serializedProducts}
        pendingShopProducts={serializedPending}
        soldSellerProducts={serializedSold}
        brands={serializedBrands}
        middleAdmins={serializedMiddleAdmins}
        sellers={serializedSellers}
        pendingPackages={serializedPendingPackages}
      />
    </div>
  );
}
