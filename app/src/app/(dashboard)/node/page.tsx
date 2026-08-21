import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNodeEnabled } from "@/lib/systemConfig";

export const dynamic = "force-dynamic";

export default async function NodeDashboardPage() {
  const session = await auth();
  if (session?.user?.role !== "NODE") redirect("/");

  const nodeEnabled = await getNodeEnabled();
  if (!nodeEnabled) redirect("/");

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [pendingCount, approvedCount, sellerCount, brandCount, monthlyOrderCount, pendingSettlementCount] = await Promise.all([
    prisma.product.count({
      where: { isActive: true, isApproved: false, nodeApprovedAt: null, sellerId: null },
    }),
    prisma.product.count({
      where: { isActive: true, isApproved: false, nodeApprovedAt: { not: null } },
    }),
    prisma.user.count({ where: { role: "SELLER" } }),
    prisma.brandProfile.count(),
    prisma.order.count({ where: { createdAt: { gte: firstDayOfMonth } } }),
    (async () => { try { return await (prisma as any).settlement.count({ where: { status: "PENDING" } }); } catch { return 0; } })(),
  ]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-lg font-bold text-gray-900">노드 대시보드</h1>
        <p className="text-xs text-gray-400 mt-0.5">노드로 들어온 상품에 마진을 설정하고 최종 등록합니다.</p>
      </div>

      {/* 주요 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        <Link href="/node/sellers" className="bg-gray-900 rounded-xl p-3 sm:p-4 text-white hover:opacity-90 transition-opacity">
          <p className="text-gray-300 text-[9px] sm:text-[10px] font-medium mb-1 flex items-center gap-1">
            <Icon name="Users" size={11} /> 관리 셀러 수
          </p>
          <p className="text-xl sm:text-2xl font-bold">{sellerCount.toLocaleString()}</p>
          <p className="text-gray-400 text-[9px] sm:text-[10px] mt-1">전체 라이브 셀러</p>
        </Link>
        <Link href="/node/brands" className="bg-gray-900 rounded-xl p-3 sm:p-4 text-white hover:opacity-90 transition-opacity">
          <p className="text-gray-300 text-[9px] sm:text-[10px] font-medium mb-1 flex items-center gap-1">
            <Icon name="Official" size={11} /> 관리 브랜드 수
          </p>
          <p className="text-xl sm:text-2xl font-bold">{brandCount.toLocaleString()}</p>
          <p className="text-gray-400 text-[9px] sm:text-[10px] mt-1">전체 브랜드</p>
        </Link>
        <Link href="/node/orders" className="bg-amber-400 rounded-xl p-3 sm:p-4 text-black hover:opacity-90 transition-opacity">
          <p className="text-black/60 text-[9px] sm:text-[10px] font-medium mb-1 flex items-center gap-1">
            <Icon name="Cart" size={11} /> 이번 달 주문
          </p>
          <p className="text-xl sm:text-2xl font-bold">{monthlyOrderCount.toLocaleString()}</p>
          <p className="text-black/50 text-[9px] sm:text-[10px] mt-1">{now.getMonth() + 1}월 주문 건수</p>
        </Link>
      </div>

      {/* 상품 및 정산 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Link href="/node/products" className="bg-white rounded-xl p-3 sm:p-4 border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group">
          <Icon name="Clock" size={16} strokeWidth={1.5} className="text-amber-500 mb-1.5 sm:mb-2" />
          <p className="text-base sm:text-lg font-bold text-gray-900">{pendingCount.toLocaleString()}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">마진 설정 대기</p>
        </Link>
        <Link href="/node/products" className="bg-white rounded-xl p-3 sm:p-4 border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group">
          <Icon name="Check" size={16} strokeWidth={1.5} className="text-emerald-500 mb-1.5 sm:mb-2" />
          <p className="text-base sm:text-lg font-bold text-gray-900">{approvedCount.toLocaleString()}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">최종 등록 완료</p>
        </Link>
        <Link href="/node/settlements" className="bg-white rounded-xl p-3 sm:p-4 border border-amber-100 hover:border-amber-200 hover:shadow-sm transition-all group">
          <Icon name="Wallet" size={16} strokeWidth={1.5} className="text-amber-500 mb-1.5 sm:mb-2" />
          <p className="text-base sm:text-lg font-bold text-gray-900">{pendingSettlementCount.toLocaleString()}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">정산 대기 중</p>
        </Link>
        <Link href="/node/orders" className="bg-white rounded-xl p-3 sm:p-4 border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all group">
          <Icon name="Chart" size={16} strokeWidth={1.5} className="text-brand-500 mb-1.5 sm:mb-2" />
          <p className="text-base sm:text-lg font-bold text-gray-900">{monthlyOrderCount.toLocaleString()}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">이번 달 주문</p>
        </Link>
      </div>

      {/* 빠른 이동 */}
      <div>
        <h2 className="text-sm font-bold text-gray-900 mb-3">빠른 이동</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {[
            { href: "/node/products", label: "상품 관리", icon: "Package", desc: "마진 설정 및 최종 등록" },
            { href: "/node/sellers", label: "셀러 관리", icon: "Store", desc: "라이브 셀러 조회" },
            { href: "/node/brands", label: "브랜드 관리", icon: "Official", desc: "브랜드 조회" },
            { href: "/node/orders", label: "주문 관리", icon: "OrderManagement", desc: "주문 현황 조회" },
            { href: "/node/settlements", label: "정산", icon: "Settlement", desc: "정산 현황 조회" },
            { href: "/node/settings", label: "설정", icon: "Settings", desc: "노드 설정" },
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
