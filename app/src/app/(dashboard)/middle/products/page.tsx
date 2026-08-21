import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
;
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MiddleProductManagementClient from "@/components/middle/MiddleProductManagementClient";
import PendingSellerApproval from "@/components/shared/PendingSellerApproval";
import ApprovedSellerProducts from "@/components/shared/ApprovedSellerProducts";

export const dynamic = "force-dynamic";

export default async function MiddleProductsPage() {
  const session = await auth();
  if (session?.user?.role !== "MIDDLE_ADMIN") redirect("/");

  const middleAdminId = session!.user.middleAdminId as string | undefined;
  if (!middleAdminId) redirect("/");

  const [products, brands, pendingApplications, soldProducts] = await Promise.all([
    prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          // 소속 브랜드가 등록한 상품
          { brand: { middleAdminId } },
          // 중간관리자 본인이 직접 등록한 상품 (브랜드 없음)
          { middleAdminId, brandId: null, sellerId: null },
        ],
      },
      include: {
        brand: { select: { brandName: true } },
        category: { select: { name: true } },
        sellerProducts: {
          where: { isApproved: true, isActive: true },
          select: {
            id: true,
            seller: { select: { id: true, shopName: true } },
          },
          take: 5,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    // 소속 브랜드 목록 (브랜드별 필터용)
    prisma.brandProfile.findMany({
      where: { middleAdminId },
      select: { id: true, brandName: true },
      orderBy: { brandName: "asc" },
    }),
    // 셀러 신청 승인 대기 목록 — 중간관리자 관할 상품(자체 등록 + 소속 브랜드 상품)
    prisma.sellerShopProduct.findMany({
      where: {
        isApproved: false,
        rejectionReason: null,
        OR: [
          { product: { middleAdminId } },
          { product: { brand: { middleAdminId } } },
        ],
      },
      include: {
        product: { select: { id: true, name: true, thumbnail: true, brand: { select: { brandName: true } } } },
        seller: { select: { shopName: true, shopLogo: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // 판매 중인 상품 — 중간관리자 관할 상품 중 셀러가 현재 판매 중(승인+활성)
    prisma.sellerShopProduct.findMany({
      where: {
        isApproved: true,
        isActive: true,
        OR: [
          { product: { middleAdminId } },
          { product: { brand: { middleAdminId } } },
        ],
      },
      include: {
        product: { select: { id: true, name: true, thumbnail: true, brand: { select: { brandName: true } } } },
        seller: { select: { shopName: true, shopLogo: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const initialProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    thumbnail: p.thumbnail,
    brandId: p.brandId,
    brandName: p.brand?.brandName || null,
    categoryName: p.category?.name || null,
    supplyPrice: p.supplyPrice != null ? Number(p.supplyPrice) : null,
    basePrice: Number(p.basePrice),
    middleAdminMargin: p.middleAdminMargin != null ? Number(p.middleAdminMargin) : null,
    isApproved: p.isApproved,
    // 중간관리자 본인이 직접 등록한 상품 여부 (브랜드 없음) → 최고관리자 승인 대상
    isOwn: !p.brandId,
    // 판매중(승인+활성) 셀러 목록
    activeSellers: p.sellerProducts.map((sp) => ({ id: sp.seller.id, shopName: sp.seller.shopName })),
  }));

  const serializedBrands = brands.map((b) => ({ id: b.id, brandName: b.brandName }));

  const serializedSold = soldProducts.map((sp) => ({
    id: sp.id,
    productId: sp.product.id,
    productName: sp.product.name,
    productThumbnail: sp.product.thumbnail,
    sellerName: sp.seller.shopName,
    sellerShopLogo: sp.seller.shopLogo || null,
    sellerPrice: sp.sellerPrice != null ? Number(sp.sellerPrice) : null,
    brandName: sp.product.brand?.brandName || null,
    approvedAt: sp.createdAt.toISOString(),
  }));

  const serializedApplications = pendingApplications.map((app) => ({
    id: app.id,
    productId: app.product.id,
    productName: app.product.name,
    productThumbnail: app.product.thumbnail,
    sellerShopName: app.seller.shopName,
    sellerShopLogo: app.seller.shopLogo || null,
    sellerPrice: app.sellerPrice != null ? Number(app.sellerPrice) : null,
    brandName: app.product.brand?.brandName || null,
    createdAt: app.createdAt.toISOString(),
  }));

  return (
    <div className="animate-fade-in space-y-6">
      {serializedApplications.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Icon name="Warning" size={16} strokeWidth={1.5} className="text-yellow-500" />
            <h2 className="text-sm font-bold text-gray-700">셀러 신청 승인 대기 ({serializedApplications.length})</h2>
          </div>
          <PendingSellerApproval applications={serializedApplications} currentUserId={session!.user!.id} />
        </div>
      )}
      {serializedSold.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
                      <Icon name="Check" size={16} strokeWidth={1.5} className="text-green-500" />
            <h2 className="text-sm font-bold text-gray-700">판매 중인 상품 ({serializedSold.length})</h2>
          </div>
          <ApprovedSellerProducts items={serializedSold} />
        </div>
      )}
      <MiddleProductManagementClient initialProducts={initialProducts} brands={serializedBrands} />
    </div>
  );
}
