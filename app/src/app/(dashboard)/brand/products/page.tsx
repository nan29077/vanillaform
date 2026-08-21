import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
import { NO_IMAGE } from "@/lib/defaults";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import {Plus, ShoppingBag, BarChart3, MessageCircle} from 'lucide-react';
import SafeImage from "@/components/shared/SafeImage";
import ProductRegisterForm from "@/components/shared/ProductRegisterForm";
import PackageRegisterForm from "@/components/shared/PackageRegisterForm";
import ProductItemActions from "@/components/shared/ProductItemActions";
import ProductSalesDetail from "@/components/shared/ProductSalesDetail";
import ProductSellerChatPanel from "@/components/shared/ProductSellerChatPanel";
import PendingSellerApproval from "@/components/shared/PendingSellerApproval";
import ApprovedSellerProducts from "@/components/shared/ApprovedSellerProducts";
import PaginatedBrandProductsList from "./PaginatedBrandProductsList";

export const dynamic = "force-dynamic";

export default async function BrandProductsPage() {
  const session = await auth();
  if (session?.user?.role !== "BRAND_ADMIN") redirect("/");

  const brand = await prisma.brandProfile.findUnique({
    where: { userId: session!.user!.id },
    include: {
      products: {
        include: {
          category: true,
          _count: { select: { reviews: true, campaigns: true, sellerProducts: true, chats: true } },
          sellerProducts: {
            include: {
              seller: { select: { id: true, shopName: true, shopLogo: true, slug: true, isApproved: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!brand) redirect("/");

  // 셀러 신청 승인 대기 목록.
  // 승인 주체가 브랜드사 본인인 경우(= 독립 브랜드)만 노출. 중간관리자 소속 브랜드는 중간관리자가 승인.
  const pendingApplications = brand.middleAdminId
    ? []
    : await prisma.sellerShopProduct.findMany({
        where: {
          isApproved: false,
          rejectionReason: null,
          product: { brandId: brand.id },
        },
        include: {
          product: { select: { id: true, name: true, thumbnail: true } },
          seller: { select: { id: true, shopName: true, shopLogo: true, slug: true } },
        },
        orderBy: { createdAt: "desc" },
      });

  // 판매 중인 상품 — 승인되어 셀러가 현재 판매 중(승인+활성)인 본 브랜드 상품
  const soldProducts = await prisma.sellerShopProduct.findMany({
    where: {
      isApproved: true,
      isActive: true,
      product: { brandId: brand.id },
    },
    include: {
      product: { select: { id: true, name: true, thumbnail: true } },
      seller: { select: { shopName: true, shopLogo: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Unread chat counts per product
  const unreadChats = await prisma.productChat.groupBy({
    by: ["productId"],
    where: {
      product: { brandId: brand.id },
      senderId: { not: session!.user!.id },
      isRead: false,
    },
    _count: { id: true },
  });
  const unreadMap: Record<string, number> = {};
  for (const c of unreadChats) {
    unreadMap[c.productId] = c._count.id;
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">상품 관리</h1>
          <p className="text-sm text-gray-500">{brand.products.length}개의 상품</p>
        </div>
        <div className="flex items-center gap-2">
          <PackageRegisterForm mode="brand" />
          <ProductRegisterForm
            brands={[]}
            mode="brand"
            hideGroupBuy
            marginPolicy={{
              method: brand.marginMethod as "PERCENTAGE" | "SUPPLY_BASE",
              base: brand.marginBase as "SUPPLY" | "SALE",
              rate: Number(brand.marginRate),
            }}
          />
        </div>
      </div>

      {/* Pending Seller Applications */}
      {pendingApplications.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="Warning" size={16} strokeWidth={1.5} className="text-yellow-500" />
            <h2 className="text-sm font-bold text-gray-700">라이브 셀러 신청 대기 ({pendingApplications.length})</h2>
          </div>
          <PendingSellerApproval
            applications={pendingApplications.map((app) => ({
              id: app.id,
              productId: app.product.id,
              productName: app.product.name,
              productThumbnail: app.product.thumbnail,
              sellerShopName: app.seller.shopName,
              sellerShopLogo: app.seller.shopLogo || null,
              sellerPrice: null, // 브랜드사에게는 셀러 판매가 비공개
              createdAt: app.createdAt.toISOString(),
            }))}
            currentUserId={session!.user!.id}
          />
        </div>
      )}

      {/* 판매 중인 상품 */}
      {soldProducts.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="Check" size={16} strokeWidth={1.5} className="text-green-500" />
            <h2 className="text-sm font-bold text-gray-700">판매 중인 상품 ({soldProducts.length})</h2>
          </div>
          <ApprovedSellerProducts
            items={soldProducts.map((sp) => ({
              id: sp.id,
              productId: sp.product.id,
              productName: sp.product.name,
              productThumbnail: sp.product.thumbnail,
              sellerName: sp.seller.shopName,
              sellerShopLogo: sp.seller.shopLogo || null,
              sellerPrice: null, // 브랜드사에게는 셀러 판매가 비공개
              approvedAt: sp.createdAt.toISOString(),
            }))}
          />
        </div>
      )}

      {brand.products.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Icon name="Package" size={48} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">등록된 상품이 없습니다.</p>
          <p className="text-xs text-gray-300 mt-1">상품 등록 버튼을 눌러 첫 상품을 등록하세요.</p>
        </div>
      ) : (
        <PaginatedBrandProductsList
          items={brand.products.map((product) => ({
            id: product.id,
            name: product.name,
            thumbnail: product.thumbnail,
            isActive: product.isActive,
            isApproved: product.isApproved,
            supplyPrice: product.supplyPrice != null ? Number(product.supplyPrice) : null,
            category: product.category ? { name: product.category.name } : null,
            _count: {
              sellerProducts: product._count.sellerProducts,
              campaigns: product._count.campaigns,
              reviews: product._count.reviews,
            },
            sellerProducts: product.sellerProducts.map((sp) => ({
              id: sp.id,
              isActive: sp.isActive,
              isApproved: sp.isApproved,
              seller: {
                id: sp.seller.id,
                shopName: sp.seller.shopName,
                shopLogo: sp.seller.shopLogo || null,
              },
            })),
          }))}
          unreadMap={unreadMap}
          currentUserId={session!.user!.id}
        />
      )}
    </div>
  );
}
