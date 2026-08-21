import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
;
import SafeImage from "@/components/shared/SafeImage";
import Link from "next/link";
import PaginatedBrandSellersList from "./PaginatedBrandSellersList";

export const dynamic = "force-dynamic";

export default async function BrandSellersPage() {
  const session = await auth();
  if (session?.user?.role !== "BRAND_ADMIN") redirect("/");

  const brand = await prisma.brandProfile.findUnique({
    where: { userId: session!.user!.id },
  });
  if (!brand) redirect("/");

  // Sellers who carry this brand's products
  const sellerProducts = await prisma.sellerShopProduct.findMany({
    where: { product: { brandId: brand.id } },
    include: {
      seller: {
        include: {
          user: { select: { name: true, email: true, avatar: true, accounts: { select: { provider: true } } } },
          _count: { select: { shopProducts: true, campaigns: true, followers: true } },
        },
      },
    },
  });

  // Campaign sellers
  const campaignSellers = await prisma.groupBuyCampaign.findMany({
    where: { product: { brandId: brand.id } },
    include: {
      seller: {
        include: {
          user: { select: { name: true, email: true, avatar: true, accounts: { select: { provider: true } } } },
          _count: { select: { shopProducts: true, campaigns: true, followers: true } },
        },
      },
    },
    distinct: ["sellerId"],
  });

  // Merge unique sellers
  const sellerMap = new Map<string, any>();
  for (const sp of sellerProducts) {
    if (!sellerMap.has(sp.sellerId)) {
      sellerMap.set(sp.sellerId, { ...sp.seller, productCount: 0, campaignCount: 0 });
    }
    sellerMap.get(sp.sellerId).productCount++;
  }
  for (const cs of campaignSellers) {
    if (!sellerMap.has(cs.sellerId)) {
      sellerMap.set(cs.sellerId, { ...cs.seller, productCount: 0, campaignCount: 0 });
    }
    sellerMap.get(cs.sellerId).campaignCount++;
  }

  // 병합된 셀러 프로필에는 Decimal 필드(commissionRate 등)가 포함돼 있어
  // 클라이언트 컴포넌트로 그대로 넘길 수 없으므로 사용되는 순수 필드만 직렬화한다.
  const sellers = Array.from(sellerMap.values()).map((s: any) => ({
    id: s.id,
    shopName: s.shopName,
    shopLogo: s.shopLogo ?? null,
    slug: s.slug,
    category: s.category ?? null,
    isApproved: s.isApproved,
    totalFans: s.totalFans,
    instagramUrl: s.instagramUrl ?? null,
    user: { name: s.user.name, email: s.user.email },
    authProviders: [...new Set((s.user.accounts ?? []).map((a: any) => a.provider))] as string[],
    productCount: s.productCount,
    campaignCount: s.campaignCount,
  }));

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">라이브 셀러 관리</h1>
          <p className="text-sm text-gray-500">브랜드 상품을 판매하는 라이브 셀러 {sellers.length}명</p>
        </div>
      </div>

      {sellers.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Icon name="Users" size={48} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">아직 상품을 판매하는 라이브 셀러가 없습니다.</p>
          <p className="text-xs text-gray-300 mt-1">라이브 셀러가 브랜드 상품을 샵에 추가하면 자동으로 표시됩니다.</p>
        </div>
      ) : (
        <PaginatedBrandSellersList items={sellers} />
      )}
    </div>
  );
}
