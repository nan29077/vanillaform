import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { formatProductNameForSeller } from "@/lib/productName";
import {
  Package, Plus, Search, Clock, CheckCircle2, ShoppingBag, Radio,
  EyeOff, Eye, Trash2, Edit3, MoreVertical,
} from "lucide-react";
import SafeImage from "@/components/shared/SafeImage";
import ProductRegisterForm from "@/components/shared/ProductRegisterForm";
import PackageRegisterForm from "@/components/shared/PackageRegisterForm";
import ProductItemActions from "@/components/shared/ProductItemActions";
import SellerProductTabs from "@/components/shared/SellerProductTabs";
import ShopExposeManager from "@/components/shared/ShopExposeManager";
import CartDiscountSettings from "@/components/seller/CartDiscountSettings";

export const dynamic = "force-dynamic";

export default async function SellerProductsPage() {
  const session = await auth();
  if (session?.user?.role !== "SELLER") redirect("/");

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session!.user!.id },
    include: {
      shopProducts: {
        include: {
          product: {
            include: {
              category: true,
              brand: true,
              _count: { select: { reviews: true } },
            },
          },
        },
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  if (!seller) redirect("/");

  // 공동구매 캠페인 상품 조회
  const campaigns = await prisma.groupBuyCampaign.findMany({
    where: { sellerId: seller.id },
    include: {
      product: {
        include: {
          category: true,
          brand: true,
          _count: { select: { reviews: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // 라이브커머스 상품 조회 (라이브 스트림에 연결된 상품)
  const liveStreams = await prisma.liveStream.findMany({
    where: { sellerId: seller.id },
    include: {
      products: {
        include: {
          product: {
            include: {
              category: true,
              brand: true,
              _count: { select: { reviews: true } },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const existingProductIds = seller.shopProducts.map((sp) => sp.productId);

  // 상품 신청 목록은 GET /api/products/request 에서 서버 페이지네이션으로 가져온다.
  // (여기서 전체 목록을 미리 내려주면 상품 수가 늘어날수록 초기 payload만 커지고,
  //  클라이언트 슬라이싱 방식이라 내려준 개수를 넘는 페이지로 이동할 수 없었다)
  // 탭 카운트 표시용: 상품신청 가능 전체 수 + 일반상품 수
  const [availableProductsCount, directProductCount] = await Promise.all([
    prisma.product.count({
      where: {
        isActive: true,
        isApproved: true,
        sellerId: null,
        id: { notIn: existingProductIds },
      },
    }),
    prisma.directProduct.count({ where: { sellerId: seller.id } }),
  ]);

  // 상품신청 브랜드별 필터용 — 등록된 전체 브랜드 목록
  const allBrands = await prisma.brandProfile.findMany({
    select: { id: true, brandName: true },
    orderBy: { brandName: "asc" },
  });

  const activeProducts = seller.shopProducts.filter((sp) => sp.isActive);
  const pausedProducts = seller.shopProducts.filter((sp) => !sp.isActive && sp.isApproved);
  const pendingProducts = seller.shopProducts.filter((sp) => !sp.isActive && !sp.isApproved && !sp.rejectionReason);

  // 셀러 화면: 상품명 포맷 변환 (lib/productName)
  const formatProductName = formatProductNameForSeller;

  // Serialize data for client component
  const tabData: any = {
    currentUserId: session!.user!.id,
    // 셀러 본인이 직접 등록한 상품(Product.sellerId === seller.id) 판별용
    currentSellerId: seller.id,
    shopProducts: seller.shopProducts.map((sp, idx) => ({
      id: sp.id,
      isActive: sp.isActive,
      isApproved: sp.isApproved,
      rejectionReason: sp.rejectionReason || null,
      // 인플루언서 커미션 (더미 데이터 - 추후 DB 연동)
      commissionRate: [10, 12, 8, 15, 10, 7, 13, 9, 11, 14][idx % 10],
      product: {
        id: sp.product.id,
        name: formatProductName(sp.product.name, sp.product.middleAdminId),
        thumbnail: sp.product.thumbnail,
        basePrice: Number(sp.product.basePrice),
        isActive: sp.product.isActive,
        // 셀러 본인 등록 상품이면 등록 셀러 id, 브랜드/관리자 상품이면 null
        sellerId: sp.product.sellerId,
        brand: sp.product.brand ? { brandName: sp.product.brand.brandName } : null,
        category: sp.product.category ? { name: sp.product.category.name } : null,
        reviewCount: sp.product._count.reviews,
      },
    })),
    campaigns: campaigns.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      campaignPrice: Number(c.campaignPrice),
      originalPrice: Number(c.originalPrice),
      participantCount: c.participantCount,
      currentQuantity: c.currentQuantity,
      goalQuantity: c.goalQuantity,
      startDate: new Date(c.startDate).toISOString(),
      endDate: new Date(c.endDate).toISOString(),
      product: {
        id: c.product.id,
        name: formatProductName(c.product.name, c.product.middleAdminId),
        thumbnail: c.product.thumbnail,
        basePrice: Number(c.product.basePrice),
        brand: c.product.brand ? { brandName: c.product.brand.brandName } : null,
        category: c.product.category ? { name: c.product.category.name } : null,
        reviewCount: c.product._count.reviews,
      },
    })),
    liveStreams: liveStreams.map((ls) => ({
      id: ls.id,
      title: ls.title,
      status: ls.status,
      shareCode: ls.shareCode,
      viewerCount: ls.viewerCount,
      startedAt: ls.startedAt ? new Date(ls.startedAt).toISOString() : null,
      endedAt: ls.endedAt ? new Date(ls.endedAt).toISOString() : null,
      products: ls.products.map((lp) => ({
        id: lp.id,
        livePrice: lp.livePrice ? Number(lp.livePrice) : null,
        sortOrder: lp.sortOrder,
        product: {
          id: lp.product.id,
          name: formatProductName(lp.product.name, lp.product.middleAdminId),
          thumbnail: lp.product.thumbnail,
          basePrice: Number(lp.product.basePrice),
          brand: lp.product.brand ? { brandName: lp.product.brand.brandName } : null,
          category: lp.product.category ? { name: lp.product.category.name } : null,
          reviewCount: lp.product._count.reviews,
        },
      })),
    })),
    brands: allBrands.map((b) => ({ id: b.id, brandName: b.brandName })),
    availableProductsCount,
    directProductCount,
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">상품 관리</h1>
        </div>
        <div className="flex items-center gap-2">
          <PackageRegisterForm mode="seller" />
          <ProductRegisterForm brands={[]} mode="seller" />
        </div>
      </div>

      {/* 장바구니 할인 설정 */}
      <CartDiscountSettings />

      <SellerProductTabs data={tabData} />
    </div>
  );
}
