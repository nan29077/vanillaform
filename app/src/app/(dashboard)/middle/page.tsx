import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MiddleDashboard() {
  const session = await auth();
  if (session?.user?.role !== "MIDDLE_ADMIN") redirect("/");

  const middleAdminId = session!.user.middleAdminId as string | undefined;
  if (!middleAdminId) redirect("/");

  const profile = await prisma.middleAdminProfile.findUnique({
    where: { id: middleAdminId },
    select: { name: true },
  });

  // 소속 브랜드/셀러 요약 조회
  const [brands, sellers] = await Promise.all([
    prisma.brandProfile.findMany({
      where: { middleAdminId },
      select: {
        id: true,
        brandName: true,
        marginMethod: true,
        marginRate: true,
        _count: { select: { products: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.sellerProfile.findMany({
      where: { middleAdminId },
      select: {
        id: true,
        shopName: true,
        middleAdminMarginRate: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const brandCount = brands.length;
  const sellerCount = sellers.length;
  const totalProducts = brands.reduce((acc, b) => acc + b._count.products, 0);
  // 마진이 설정된(0보다 큰) 브랜드 수 — 누적 마진 요약 대용
  const brandsWithMargin = brands.filter((b) => Number(b.marginRate) > 0).length;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">중간관리자 대시보드</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {profile?.name ?? "중간관리자"} · {new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
          </p>
        </div>
        <Link
          href="/middle/brands"
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors flex-shrink-0"
        >
          <Icon name="Plus" size={14} strokeWidth={2} />
          <span className="hidden sm:inline">브랜드 등록</span>
          <span className="sm:hidden">등록</span>
        </Link>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-gray-900 rounded-xl p-3 sm:p-4 text-white">
          <p className="text-gray-300 text-[9px] sm:text-[10px] font-medium mb-1">소속 브랜드</p>
          <p className="text-xl sm:text-2xl font-bold">{brandCount.toLocaleString()}</p>
          <p className="text-gray-400 text-[9px] sm:text-[10px] mt-1">관리 중인 브랜드</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-3 sm:p-4 text-white">
          <p className="text-gray-300 text-[9px] sm:text-[10px] font-medium mb-1">소속 라이브 셀러</p>
          <p className="text-xl sm:text-2xl font-bold">{sellerCount.toLocaleString()}</p>
          <p className="text-gray-400 text-[9px] sm:text-[10px] mt-1">관리 중인 라이브 셀러</p>
        </div>
        <div className="bg-amber-400 rounded-xl p-3 sm:p-4 text-black">
          <p className="text-black/60 text-[9px] sm:text-[10px] font-medium mb-1">마진 설정 브랜드</p>
          <p className="text-xl sm:text-2xl font-bold">{brandsWithMargin.toLocaleString()}</p>
          <p className="text-black/50 text-[9px] sm:text-[10px] mt-1">전체 {brandCount}개 중</p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: "소속 브랜드", value: brandCount, icon: "Official", color: "text-purple-500" },
          { label: "소속 라이브 셀러", value: sellerCount, icon: "Store", color: "text-blue-500" },
          { label: "브랜드 상품", value: totalProducts, icon: "Package", color: "text-orange-500" },
          { label: "마진 설정", value: brandsWithMargin, icon: "Discount", color: "text-emerald-500" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl p-3 sm:p-4 border border-gray-100">
            <Icon name={kpi.icon} size={16} className={`${kpi.color} mb-1.5 sm:mb-2`} />
            <p className="text-base sm:text-lg font-bold text-gray-900">{kpi.value.toLocaleString()}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Two-Column: Brands + Sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 소속 브랜드 */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
            <h2 className="text-sm font-bold text-gray-900">소속 브랜드</h2>
            <Link href="/middle/brands" className="text-[11px] text-gray-400 hover:text-gray-600">전체보기 →</Link>
          </div>
          {brands.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {brands.slice(0, 5).map((b) => (
                <div key={b.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <Icon name="Official" size={16} className="text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 truncate">{b.brandName}</p>
                    <p className="text-[11px] text-gray-400 truncate">상품 {b._count.products}개</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[11px] font-medium text-gray-500">
                      {Number(b.marginRate) > 0
                        ? `${b.marginMethod === "PERCENTAGE" ? "퍼센트" : "공급가"} ${Number(b.marginRate)}%`
                        : "마진 미설정"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <Icon name="Official" size={28} className="mx-auto text-gray-200 mb-2" />
              <p className="text-xs text-gray-400 mb-1">소속 브랜드가 없습니다.</p>
              <Link href="/middle/brands" className="text-xs text-blue-500 hover:underline">브랜드 등록하기</Link>
            </div>
          )}
        </div>

        {/* 소속 셀러 */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
            <h2 className="text-sm font-bold text-gray-900">소속 라이브 셀러</h2>
            <Link href="/middle/sellers" className="text-[11px] text-gray-400 hover:text-gray-600">전체보기 →</Link>
          </div>
          {sellers.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {sellers.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Icon name="Store" size={16} className="text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-800 truncate">{s.shopName}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[11px] font-medium text-gray-500">
                      {Number(s.middleAdminMarginRate) > 0
                        ? `마진 ${Number(s.middleAdminMarginRate)}%`
                        : "마진 미설정"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <Icon name="Store" size={28} className="mx-auto text-gray-200 mb-2" />
              <p className="text-xs text-gray-400 mb-1">소속 라이브 셀러가 없습니다.</p>
              <Link href="/middle/sellers" className="text-xs text-blue-500 hover:underline">라이브 셀러 등록하기</Link>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-bold text-gray-900 mb-3">빠른 관리</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {[
            { href: "/middle/brands", label: "브랜드 관리", icon: "Official", desc: "브랜드 등록 & 조회" },
            { href: "/middle/sellers", label: "라이브 셀러 관리", icon: "Store", desc: "라이브 셀러 등록 & 조회" },
            { href: "/middle/settlements", label: "정산", icon: "Settlement", desc: "마진 정산 현황" },
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
                <p className="text-[12px] sm:text-[13px] font-medium text-gray-800">{item.label}</p>
                <p className="text-[9px] sm:text-[10px] text-gray-400 truncate">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
