import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BrandDashboard() {
  const session = await auth();
  if (session?.user?.role !== "BRAND_ADMIN") redirect("/");

  const brand = await prisma.brandProfile.findUnique({
    where: { userId: session!.user!.id },
    include: {
      products: {
        include: {
          campaigns: { where: { status: "ACTIVE" }, include: { seller: true } },
          _count: { select: { reviews: true, sellerProducts: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!brand) redirect("/");

  const totalProducts = brand.products.length;
  const activeProducts = brand.products.filter((p) => p.isActive).length;
  const activeCampaigns = brand.products.reduce((acc, p) => acc + p.campaigns.length, 0);
  const totalSold = brand.products.reduce((acc, p) => acc + p.soldCount, 0);
  const totalReviews = brand.products.reduce((acc, p) => acc + p._count.reviews, 0);
  const totalSellers = brand.products.reduce((acc, p) => acc + p._count.sellerProducts, 0);
  // 판매가 비노출: 브랜드 매출은 공급가(supplyPrice) 기준으로 산정 (판매가 미사용)
  const totalRevenue = brand.products.reduce((acc, p) => acc + Number(p.supplyPrice ?? 0) * p.soldCount, 0);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">브랜드 대시보드</h1>
          <p className="text-xs text-gray-400 mt-0.5">{brand.brandName} · {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</p>
        </div>
        <Link href="/brand/products" className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors flex-shrink-0">
          <Icon name="Plus" size={14} strokeWidth={2} />
          <span className="hidden sm:inline">상품 등록</span><span className="sm:hidden">등록</span>
        </Link>
      </div>

      {!brand.isApproved && (
        <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 flex items-center gap-2">
          <Icon name="Clock" size={14} />
          브랜드 승인 대기 중입니다. 관리자 승인 후 상품이 노출됩니다.
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-amber-400 rounded-xl p-3 sm:p-4 text-black">
          <p className="text-black/60 text-[9px] sm:text-[10px] font-medium mb-1">총 판매량</p>
          <p className="text-xl sm:text-2xl font-bold">{totalSold.toLocaleString()}</p>
          <p className="text-black/50 text-[9px] sm:text-[10px] mt-1">누적 판매</p>
        </div>
        <div className="bg-amber-400 rounded-xl p-3 sm:p-4 text-black">
          <p className="text-black/60 text-[9px] sm:text-[10px] font-medium mb-1">예상 매출</p>
          <p className="text-[13px] sm:text-xl font-bold leading-tight break-all">{formatPrice(totalRevenue)}</p>
          <p className="text-black/50 text-[9px] sm:text-[10px] mt-1">공급가 기반</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-3 sm:p-4 text-white">
          <p className="text-gray-300 text-[9px] sm:text-[10px] font-medium mb-1">연결 라이브 셀러</p>
          <p className="text-xl sm:text-2xl font-bold">{totalSellers}</p>
          <p className="text-gray-400 text-[9px] sm:text-[10px] mt-1">진행 캠페인 {activeCampaigns}</p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: "전체 상품", value: totalProducts, icon: "Package", color: "text-blue-500" },
          { label: "활성 상품", value: activeProducts, icon: "Store", color: "text-green-500" },
          { label: "진행중 캠페인", value: activeCampaigns, icon: "Event", color: "text-purple-500" },
          { label: "총 리뷰", value: totalReviews, icon: "Star", color: "text-amber-500" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl p-3 sm:p-4 border border-gray-100">
            <Icon name={kpi.icon} size={16} className={`${kpi.color} mb-1.5 sm:mb-2`} />
            <p className="text-base sm:text-lg font-bold text-gray-900">{kpi.value.toLocaleString()}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Two-Column: Campaigns + Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active Campaigns */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              진행중인 캠페인
            </h2>
            <Link href="/brand/campaigns" className="text-[11px] text-gray-400 hover:text-gray-600">전체보기 →</Link>
          </div>
          {brand.products.some(p => p.campaigns.length > 0) ? (
            <div className="divide-y divide-gray-50">
              {brand.products
                .filter(p => p.campaigns.length > 0)
                .flatMap(p => p.campaigns.map(c => ({ ...c, productName: p.name, thumbnail: p.thumbnail })))
                .slice(0, 5)
                .map((campaign) => (
                  <div key={campaign.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                    {campaign.thumbnail && (
                      <img src={campaign.thumbnail} alt={campaign.productName} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-800 truncate">{campaign.title}</p>
                      <p className="text-[11px] text-gray-400 truncate">{campaign.seller.shopName} · {campaign.participantCount}명</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-emerald-600">
                        {campaign.goalQuantity ? Math.round((campaign.currentQuantity / campaign.goalQuantity) * 100) : 0}%
                      </p>
                      <p className="text-[10px] text-gray-400">달성률</p>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <Icon name="Chart" size={28} className="mx-auto text-gray-200 mb-2" />
              <p className="text-xs text-gray-400">진행중인 캠페인이 없습니다.</p>
            </div>
          )}
        </div>

        {/* Product List */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
            <h2 className="text-sm font-bold text-gray-900">내 상품</h2>
            <Link href="/brand/products" className="text-[11px] text-gray-400 hover:text-gray-600">전체보기 →</Link>
          </div>
          {brand.products.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {brand.products.slice(0, 5).map((product) => (
                <div key={product.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {product.thumbnail && (
                      <img src={product.thumbnail} alt={product.name} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 truncate">{product.name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                      <span>라이브 셀러 {product._count.sellerProducts}</span>
                      <span>·</span>
                      <span>리뷰 {product._count.reviews}</span>
                      <span>·</span>
                      <span>판매 {product.soldCount}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[13px] font-bold text-gray-900">
                      {product.supplyPrice != null ? formatPrice(Number(product.supplyPrice)) : "공급가 미입력"}
                    </p>
                    <p className="text-[9px] text-gray-400">공급가</p>
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${product.isActive ? "bg-green-500" : "bg-gray-300"}`} />
                      <span className="text-[10px] text-gray-400">{product.isActive ? "판매중" : "비활성"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <Icon name="Package" size={28} className="mx-auto text-gray-200 mb-2" />
              <p className="text-xs text-gray-400 mb-1">등록된 상품이 없습니다.</p>
              <Link href="/brand/products" className="text-xs text-blue-500 hover:underline">첫 상품 등록하기</Link>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-bold text-gray-900 mb-3">빠른 관리</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {[
            { href: "/brand/products", label: "상품 관리", icon: "Package", desc: "상품 등록 & 수정" },
            { href: "/brand/campaigns", label: "캠페인", icon: "Event", desc: "공구 현황" },
            { href: "/brand/sellers", label: "라이브 셀러", icon: "Store", desc: "연결 라이브 셀러" },
            { href: "/brand/orders", label: "주문", icon: "OrderManagement", desc: "주문 확인" },
            { href: "/brand/stats", label: "통계", icon: "Chart", desc: "매출 분석" },
            { href: "/brand/settings", label: "설정", icon: "Settings", desc: "브랜드 정보" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 sm:gap-3 p-3 sm:p-3.5 bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gray-50 group-hover:bg-gray-100 flex items-center justify-center transition-colors">
                <Icon name={item.icon} size={15} className="text-gray-500" />
              </div>
              <div className="min-w-0">
            
                <p className="text-[13px] font-semibold text-gray-800 group-hover:text-gray-900 truncate">{item.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
