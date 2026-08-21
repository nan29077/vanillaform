import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import HexNumBadge from "@/components/shared/HexNumBadge";
import { BarChart3, Package, TrendingUp, ShoppingBag, Star } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BrandStatsPage() {
  const session = await auth();
  if (session?.user?.role !== "BRAND_ADMIN") redirect("/");

  const brand = await prisma.brandProfile.findUnique({
    where: { userId: session!.user!.id },
    include: {
      products: {
        include: {
          campaigns: true,
          _count: { select: { reviews: true, sellerProducts: true } },
        },
      },
    },
  });

  if (!brand) redirect("/");

  const totalProducts = brand.products.length;
  const totalSold = brand.products.reduce((sum, p) => sum + p.soldCount, 0);
  const totalCampaigns = brand.products.reduce((sum, p) => sum + p.campaigns.length, 0);
  const totalReviews = brand.products.reduce((sum, p) => sum + p._count.reviews, 0);
  const totalSellers = brand.products.reduce((sum, p) => sum + p._count.sellerProducts, 0);
  // 판매가 비노출: 브랜드 매출은 공급가(supplyPrice) 기준으로 산정 (판매가 미사용)
  const totalRevenue = brand.products.reduce(
    (sum, p) => sum + Number(p.supplyPrice ?? 0) * p.soldCount,
    0
  );

  const topProducts = [...brand.products]
    .sort((a, b) => b.soldCount - a.soldCount)
    .slice(0, 5);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">통계</h1>
        <p className="text-sm text-gray-500">{brand.brandName} 성과 현황</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: "전체 상품", value: totalProducts, icon: Package, color: "bg-blue-500" },
          { label: "총 판매량", value: totalSold.toLocaleString(), icon: ShoppingBag, color: "bg-green-500" },
          { label: "총 매출", value: formatPrice(totalRevenue), icon: TrendingUp, color: "bg-emerald-500" },
          { label: "총 캠페인", value: totalCampaigns, icon: BarChart3, color: "bg-purple-500" },
          { label: "총 리뷰", value: totalReviews, icon: Star, color: "bg-yellow-500" },
          { label: "입점 라이브 셀러", value: totalSellers, icon: Package, color: "bg-pink-500" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className={`w-10 h-10 rounded-lg ${kpi.color} flex items-center justify-center mb-2`}>
              <kpi.icon size={20} strokeWidth={1.5} className="text-white" />
            </div>
            <p className="text-base sm:text-xl font-bold text-gray-900 break-all leading-tight">{kpi.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* 인기 상품 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4">인기 상품 TOP 5</h3>
        {topProducts.length === 0 ? (
          <p className="text-sm text-gray-400">상품 데이터가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {topProducts.map((product, idx) => (
              <div key={product.id} className="flex items-center gap-3">
                <HexNumBadge size={24} fontSize={12} className="flex-shrink-0">
                  {idx + 1}
                </HexNumBadge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                  <p className="text-[10px] text-gray-400">
                    {product.supplyPrice != null ? `공급가 ${formatPrice(Number(product.supplyPrice))}` : "공급가 미입력"}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-brand-600">{product.soldCount}</p>
                  <p className="text-[9px] text-gray-400">판매</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
