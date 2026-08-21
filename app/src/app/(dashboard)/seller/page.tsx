import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VISIBLE_ORDER_FILTER } from "@/lib/orderCleanup";
import { getSellerFanCount } from "@/lib/sellerFans";
import { getFeatureFlags } from "@/lib/settings";
import { formatPrice } from "@/lib/utils";
import { DEFAULT_PRODUCT_IMAGE } from "@/lib/defaults";
import SafeImage from "@/components/shared/SafeImage";
import ShopLinkButton from "@/components/shared/ShopLinkButton";
import HexNumBadge from "@/components/shared/HexNumBadge";
import SellerLiveCodeCard from "@/components/shared/SellerLiveCodeCard";
import SellerMenteeReferralCard from "@/components/seller/SellerMenteeReferralCard";

export const dynamic = "force-dynamic";

export default async function SellerDashboard() {
    const { beeDecoration: SHOW_BEES, referral: FEATURE_REFERRAL } = await getFeatureFlags();
  const session = await auth();
  if (!session) redirect("/auth/login");
  if (session.user?.role !== "SELLER") redirect("/");

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session!.user!.id },
    include: {
      campaigns: {
        where: { status: "ACTIVE" },
        include: { product: true },
        orderBy: { endDate: "asc" },
      },
      _count: {
        // orders 는 전체 주문(취소·이탈 포함)이라 주문관리와 어긋나므로 쓰지 않는다.
        // 총 주문 수는 VISIBLE_ORDER_FILTER 로 조회한 allOrders 길이를 사용.
        select: { fans: true, shopProducts: true, campaigns: true },
      },
    },
  });

  if (!seller) redirect("/");

  // 셀러가입 추천인코드 조회 (없으면 null, 클라이언트에서 발급 버튼 표시)
  // Prisma 클라이언트/DB에 sellerReferralCode가 아직 반영되지 않아도 대시보드가 죽지 않도록 fallback
  let sellerReferralCode: string | null = null;
  try {
    const sellerUser = await (prisma as any).user.findUnique({
      where: { id: session!.user!.id },
      select: { sellerReferralCode: true },
    });
    sellerReferralCode = sellerUser?.sellerReferralCode ?? null;
  } catch (referralError) {
    console.error("셀러 추천인코드 조회 실패 (null로 fallback):", referralError);
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "";
  const sellerReferralLink = sellerReferralCode
    ? `${siteUrl}/auth/register?role=SELLER&sellerRef=${sellerReferralCode}`
    : null;

  // 기간 경계 (오늘/이번주(월요일 시작)/이번달)
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - ((todayStart.getDay() + 6) % 7)); // 월요일 시작
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [allOrders, recentOrders, recentReviews, topProducts, pendingOrders] = await Promise.all([
    // 주문 수/매출 집계용 (실데이터 기반)
    // 주문관리 목록과 동일한 VISIBLE_ORDER_FILTER 를 써야 두 화면의 건수가 어긋나지 않는다.
    // (미결제 PENDING·결제 흔적 없는 CANCELLED 는 주문관리에서 보이지 않으므로 여기서도 제외)
    prisma.order.findMany({
      where: { ...VISIBLE_ORDER_FILTER, sellerId: seller.id },
      select: { createdAt: true, paidAt: true, finalAmount: true, paymentStatus: true, status: true },
    }),
    prisma.order.findMany({
      where: { ...VISIBLE_ORDER_FILTER, sellerId: seller.id },
      include: { user: { select: { name: true } }, items: { select: { productName: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.review.findMany({
      where: { product: { sellerProducts: { some: { sellerId: seller.id } } } },
      include: { user: { select: { name: true } }, product: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.sellerShopProduct.findMany({
      where: { sellerId: seller.id, isActive: true },
      include: { product: { select: { name: true, thumbnail: true, basePrice: true, soldCount: true } } },
      orderBy: { product: { soldCount: "desc" } },
      take: 5,
    }),
    // "처리대기" = 셀러가 실제로 처리해야 할 주문(결제완료·확인됨 = 발송 전).
    // 이전에는 status:"PENDING"(미결제 이탈 주문)을 셌는데, 그 주문은 주문관리 목록에
    // 아예 노출되지 않아 셀러가 대시보드 숫자를 보고도 찾아갈 수 없었다.
    prisma.order.count({
      where: { ...VISIBLE_ORDER_FILTER, sellerId: seller.id, status: { in: ["PAID", "CONFIRMED"] } },
    }),
  ]);

  // 팬 수는 totalFans(시드 더미값 섞인 비정규화 컬럼) 대신 관계 테이블에서 실집계한다.
  const fanCount = await getSellerFanCount(seller.id, FEATURE_REFERRAL);

  // 주문 수(생성 기준) & 매출(결제완료 기준) 기간별 집계
  const isPaid = (o: { paymentStatus: string; status: string }) =>
    o.paymentStatus === "COMPLETED" && o.status !== "CANCELLED" && o.status !== "REFUNDED";
  const inPeriod = (d: Date, start: Date) => d >= start;
  let todayOrders = 0, weekOrders = 0, monthOrders = 0;
  let todaySales = 0, weekSales = 0, monthSales = 0, revenue = 0;
  for (const o of allOrders) {
    if (inPeriod(o.createdAt, todayStart)) todayOrders++;
    if (inPeriod(o.createdAt, weekStart)) weekOrders++;
    if (inPeriod(o.createdAt, monthStart)) monthOrders++;
    if (isPaid(o)) {
      const amt = Number(o.finalAmount);
      const sale = o.paidAt ?? o.createdAt;
      revenue += amt;
      if (inPeriod(sale, todayStart)) todaySales += amt;
      if (inPeriod(sale, weekStart)) weekSales += amt;
      if (inPeriod(sale, monthStart)) monthSales += amt;
    }
  }

  const statusLabels: Record<string, { label: string; color: string }> = {
    PENDING: { label: "대기", color: "bg-yellow-50 text-yellow-700" },
    CONFIRMED: { label: "확인", color: "bg-blue-50 text-blue-700" },
    SHIPPING: { label: "배송중", color: "bg-indigo-50 text-indigo-700" },
    DELIVERED: { label: "완료", color: "bg-green-50 text-green-700" },
    CANCELLED: { label: "취소", color: "bg-red-50 text-red-700" },
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">라이브 셀러 대시보드</h1>
            <p className="text-xs text-gray-400 mt-0.5">{seller.shopName} · {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</p>
          </div>
          {SHOW_BEES && <Image src="/favicon.svg" alt="" width={48} height={48}
            className="w-11 h-11 object-contain opacity-70 pointer-events-none select-none hidden sm:block" unoptimized aria-hidden="true" />}
        </div>
      </div>

      {/* My Shop URL */}
      <div className="bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-gray-500 mb-1">내 샵 주소</p>
            <p className="text-xs text-gray-700 font-mono truncate">/shop/{seller.slug}</p>
          </div>
          <ShopLinkButton slug={seller.slug} />
        </div>
      </div>

      {/* 셀러가입 추천인코드 & 추천인링크 */}
      <SellerMenteeReferralCard
        referralCode={sellerReferralCode}
        referralLink={sellerReferralLink}
      />

      {!seller.isApproved && (
        <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 flex items-center gap-2">
          <Icon name="Clock" size={14} />
          라이브 셀러 승인 대기 중입니다. 관리자 승인 후 샵이 공개됩니다.
        </div>
      )}

      {/* 주문 수 (오늘 / 이번주 / 이번달) */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">주문 수</h2>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-amber-400 rounded-xl p-3 sm:p-4 text-black">
            <p className="text-black/60 text-[9px] sm:text-[10px] font-medium mb-1">오늘</p>
            <p className="text-xl sm:text-2xl font-bold">{todayOrders}</p>
            <p className="text-black/50 text-[9px] sm:text-[10px] mt-1">처리대기 {pendingOrders}건</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4">
            <p className="text-gray-400 text-[9px] sm:text-[10px] font-medium mb-1">이번주</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{weekOrders}</p>
            <p className="text-gray-300 text-[9px] sm:text-[10px] mt-1">건</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4">
            <p className="text-gray-400 text-[9px] sm:text-[10px] font-medium mb-1">이번달</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{monthOrders}</p>
            <p className="text-gray-300 text-[9px] sm:text-[10px] mt-1">건</p>
          </div>
        </div>
      </div>

      {/* 매출 (오늘 / 이번주 / 이번달 / 누적) */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">매출</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: "오늘", value: todaySales },
            { label: "이번주", value: weekSales },
            { label: "이번달", value: monthSales },
            { label: "총 누적", value: revenue, accent: true },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl p-3 sm:p-4 ${s.accent ? "bg-amber-400 text-black" : "bg-white border border-gray-100"}`}>
              <p className={`text-[9px] sm:text-[10px] font-medium mb-1 ${s.accent ? "text-black/60" : "text-gray-400"}`}>{s.label}</p>
              <p className={`text-[13px] sm:text-base font-bold leading-tight break-all ${s.accent ? "text-black" : "text-gray-900"}`}>{formatPrice(s.value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "내 상품", value: seller._count.shopProducts, icon: "ProductManagement_icon", color: "text-blue-500" },
          { label: "팬 수", value: fanCount, icon: "Users_icon", color: "text-pink-500" },
          // 주문관리 헤더의 "총 N건"과 같은 모집단(VISIBLE_ORDER_FILTER)을 쓴다.
          { label: "총 주문", value: allOrders.length, icon: "OrderManagement_icon", color: "text-orange-500" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl p-3 sm:p-4 border border-gray-100">
            <Icon name={kpi.icon} size={16} className={`${kpi.color} mb-1.5 sm:mb-2`} />
            <p className="text-base sm:text-lg font-bold text-gray-900">{typeof kpi.value === "number" ? kpi.value.toLocaleString() : kpi.value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* 내 라이브 코드 + 공유 */}
      <SellerLiveCodeCard code={seller.slug} shopName={seller.shopName} />

      {/* 최근 주문 */}
      <div>
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
            <h2 className="text-sm font-bold text-gray-900">최근 주문</h2>
            <Link href="/seller/orders" className="text-[11px] text-gray-400 hover:text-gray-600">전체보기 →</Link>
          </div>
          {recentOrders.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {recentOrders.map((order) => {
                const st = statusLabels[order.status] || { label: order.status, color: "bg-gray-50 text-gray-600" };
                return (
                  <div key={order.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors">
                    <div className="min-w-0 flex-1 pr-2">
                      {/* 상품명 + 고객명 강조, 주문번호는 작게 */}
                      <p className="text-[14px] font-bold text-gray-900 truncate">
                        {order.items[0]?.productName || "주문 상품"}
                        {order.items.length > 1 && <span className="text-[11px] font-normal text-gray-400"> 외 {order.items.length - 1}건</span>}
                      </p>
                      <p className="text-[12px] font-semibold text-gray-700">{order.user.name}</p>
                      <p className="text-[10px] text-gray-300">주문 {order.orderNumber}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="text-[13px] font-bold text-gray-900">{formatPrice(Number(order.finalAmount))}</p>
                      <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10">
              <Icon name="Package" size={28} className="mx-auto text-gray-200 mb-2" />
              <p className="text-xs text-gray-400">아직 주문이 없습니다.</p>
            </div>
          )}
        </div>
      </div>

      {/* Popular Products */}
      {topProducts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50">
            <h2 className="text-sm font-bold text-gray-900">인기 상품</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {topProducts.map((sp, idx) => (
              <div key={sp.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                <HexNumBadge size={20} fontSize={10} className="flex-shrink-0">{idx + 1}</HexNumBadge>
                <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                  <SafeImage src={sp.product.thumbnail} placeholder={DEFAULT_PRODUCT_IMAGE} alt={sp.product.name} width={40} height={40} fallbackText="No Img" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-800 truncate">{sp.product.name}</p>
                  <p className="text-[11px] text-gray-400">판매 {sp.product.soldCount}개</p>
                </div>
                <p className="text-[13px] font-bold text-gray-900">{formatPrice(Number(sp.product.basePrice))}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Reviews */}
      {recentReviews.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50">
            <h2 className="text-sm font-bold text-gray-900">최근 리뷰</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {recentReviews.map((review) => (
              <div key={review.id} className="px-5 py-3 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Icon name="Star" key={i} size={10} className={i < review.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"} />
                    ))}
                  </div>
                  <span className="text-[11px] font-medium text-gray-600">{review.user.name}</span>
                  <span className="text-[10px] text-gray-300">·</span>
                  <span className="text-[10px] text-gray-400 truncate">{review.product.name}</span>
                </div>
                <p className="text-[12px] text-gray-600 line-clamp-1">{review.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-bold text-gray-900 mb-3">빠른 관리</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {[
            { href: "/seller/products", label: "상품 관리", icon: "ProductManagement_icon", desc: "라이브 셀러 상품" },
            { href: "/seller/campaigns", label: "캠페인", icon: "Event", desc: "공구 캠페인" },
            { href: "/seller/fans", label: "팬 관리", icon: "Users_icon", desc: "팬 소통" },
            { href: "/seller/orders", label: "주문", icon: "OrderManagement_icon", desc: "주문 처리" },
            { href: "/seller/settlements", label: "정산", icon: "Settlement_icon", desc: "수익 정산" },
            { href: "/seller/live", label: "라이브", icon: "Live_icon", desc: "라이브 방송" },
            { href: `/shop/${seller.slug}`, label: "SHOP 바로가기", icon: "Store", desc: "샵 바로가기" },
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
