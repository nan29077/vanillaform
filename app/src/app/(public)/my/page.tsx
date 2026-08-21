import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import {Wallet, Clock, XCircle, Instagram, Youtube, Tag, Sparkles, Users, Store} from 'lucide-react';
import SafeImage from "@/components/shared/SafeImage";
import MyPageBottomMenu from "@/components/shared/MyPageBottomMenu";
import ApplySellerButton from "@/components/shared/ApplySellerButton";
import { getFeatureFlags } from "@/lib/settings";
import { requireBuyerSession } from "@/lib/buyerGuard";
import { NO_IMAGE, pickBuyerAvatar, pickSellerAvatar } from "@/lib/defaults";
import { isSellerLive, sellerProfileImage } from "@/lib/sellerLive";
import LiveBadge, { LIVE_RING_CLASS } from "@/components/shared/LiveBadge";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  // 비로그인 → 로그인, 비구매자 → 역할 대시보드로 즉시 리다이렉트 (데이터 조회/렌더 이전)
  const session = await requireBuyerSession();

  const user = await prisma.user.findUnique({
    where: { id: session.user!.id },
    include: {
      buyerProfile: {
        include: {
          primarySeller: {
            include: { user: { select: { name: true } } },
          },
          referredBySeller: {
            select: { id: true, shopName: true, slug: true, referralDiscountRate: true, pickDiscountRate: true },
          },
          follows: {
            include: {
              seller: {
                select: {
                  id: true, shopName: true, slug: true, shopLogo: true, pickDiscountRate: true, isManualLive: true,
                  user: { select: { avatar: true } },
                  liveStreams: { where: { status: "LIVE" }, take: 1, select: { id: true, shareCode: true } },
                },
              },
            },
          },
        },
      },
      orders: {
        include: { seller: true, items: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      reviews: { orderBy: { createdAt: "desc" }, take: 3 },
      wishlists: {
        include: {
          product: {
            include: {
              brand: true,
              sellerProducts: {
                where: { isActive: true },
                include: { seller: true },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      },
      sellerProfile: { select: { id: true, isApproved: true } },
      _count: { select: { orders: true, reviews: true, cartItems: true, wishlists: true } },
    },
  });

  if (!user) redirect("/auth/login");
  const sellerApplied = !!user.sellerProfile;

  // 사용 가능한 게임 당첨 쿠폰 수
  const gameCouponCount = await prisma.userGameCoupon.count({
    where: { userId: session.user!.id, usedAt: null, expiresAt: { gt: new Date() } },
  });

  const flags = await getFeatureFlags();

  // Compute discount benefits (before menuItems to avoid reference error)
  const referredSeller = user.buyerProfile?.referredBySeller;
  const pickedSellers = user.buyerProfile?.follows || [];

  const menuItems = [
    { href: "/my/orders", icon: "OrderHistory", label: "주문 내역", count: user._count.orders, color: "bg-blue-50" },
    { href: "/cart", icon: "Cart", label: "장바구니", count: user._count.cartItems, color: "bg-brand-50" },
    { href: "/my/reviews", icon: "WriteReview", label: "내 리뷰", count: user._count.reviews, color: "bg-yellow-50" },
    { href: "/my/wishlist", icon: "Wishlist", label: "찜한 상품", count: user._count.wishlists, color: "bg-rose-50" },
    { href: "/my/seller", icon: "MyPick", label: "내 Pick 라이브 셀러", count: pickedSellers.length || null, color: "bg-pink-50", small: true },
    { href: "/my/game-coupons", icon: "Gift", label: "게임 쿠폰", count: gameCouponCount || null, color: "bg-amber-50" },
    { href: "/my/addresses", icon: "Location", label: "배송지 관리", count: null, color: "bg-purple-50" },
  ];

  // Compute active discounts
  const activeDiscounts: { sellerName: string; slug: string; type: string; rate: number }[] = [];
  if (referredSeller && Number(referredSeller.referralDiscountRate) > 0) {
    activeDiscounts.push({
      sellerName: referredSeller.shopName,
      slug: referredSeller.slug,
      type: "추천인 할인",
      rate: Number(referredSeller.referralDiscountRate),
    });
  }

  return (
    <div className="animate-fade-in pb-4">
      {/* 프로필 카드 (바닐라 플라워 노랑 + 검정 텍스트) */}
      <div className="bg-brand-500 px-4 pt-6 pb-10">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-black/10 flex items-center justify-center text-gray-900 text-xl font-bold overflow-hidden">
            <img
              src={user.avatar || pickBuyerAvatar(user.id, (user as any).gender)}
              alt={user.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">{user.name}</h1>
            {/* OAuth 이메일 미동의 시 placeholder(@no-email.local)는 숨김 */}
            {user.email && !user.email.endsWith("@no-email.local") && (
              <p className="text-xs text-gray-800/70">{user.email}</p>
            )}
          </div>
          <Link href="/my/settings" className="p-2 text-gray-700 hover:text-gray-900">
            <Icon name="Settings" size={20} strokeWidth={1.5} />
          </Link>
        </div>

      </div>

      {/* 포인트/쿠폰 요약 카드 */}
      <div className="mx-4 -mt-6 bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="grid grid-cols-4 divide-x divide-gray-100">
          <Link href="/my/points" className="text-center py-1">
            <p className="text-lg font-bold text-gray-900">0</p>
            <p className="text-[10px] text-gray-400">포인트</p>
          </Link>
          <Link href="/my/orders" className="text-center py-1">
            <p className="text-lg font-bold text-gray-900">{user._count.orders}</p>
            <p className="text-[10px] text-gray-400">주문</p>
          </Link>
          <Link href="/my/reviews" className="text-center py-1">
            <p className="text-lg font-bold text-gray-900">{user._count.reviews}</p>
            <p className="text-[10px] text-gray-400">리뷰</p>
          </Link>
          <Link href="/my/wishlist" className="text-center py-1">
            <p className="text-lg font-bold text-rose-500">{user._count.wishlists}</p>
            <p className="text-[10px] text-gray-400">찜</p>
          </Link>
        </div>
      </div>

      {/* 셀러 입점 신청 (구매자 → 셀러) */}
      <div className="px-4 mb-4">
        <ApplySellerButton initialApplied={sellerApplied} />
      </div>

      {/* 할인 혜택 배너 — 추천인 제도 ON일 때만 */}
      {flags.referral && activeDiscounts.length > 0 && (
        <div className="px-4 mb-4">
          <div className="bg-brand-50 rounded-xl border border-brand-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="Gift" size={16} className="text-brand-600" />
              <h2 className="text-sm font-bold text-gray-900">나의 할인 혜택</h2>
            </div>
            <div className="space-y-2">
              {activeDiscounts.map((d, i) => (
                <Link
                  key={i}
                  href={`/shop/${d.slug}`}
                  className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {d.type === "추천인 할인" ? (
                      <Sparkles size={14} className="text-brand-500" />
                    ) : (
                      <Icon name="Check" size={14} className="text-emerald-500" />
                    )}
                    <div>
                      <p className="text-xs font-medium text-gray-900">{d.sellerName}</p>
                      <p className="text-[10px] text-gray-400">{d.type}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-brand-600">{d.rate}% OFF</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 내 Pick 셀러 미리보기 */}
      {pickedSellers.length > 0 && (
        <div className="px-4 mb-4">
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Icon name="Wishlist" size={14} className="text-pink-500 fill-pink-500" />
                내 Pick 라이브 셀러
              </h2>
              <Link href="/my/seller" className="text-xs text-brand-600 hover:underline flex items-center gap-0.5">
                전체보기 ({pickedSellers.length})
                <Icon name="ChevronDown" size={12} className="-rotate-90" />
              </Link>
            </div>
            <div className="px-4 pb-3">
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                {pickedSellers.slice(0, 8).map(({ seller }) => {
                  const live = isSellerLive(seller);
                  const liveHref = live && seller.liveStreams[0]?.shareCode
                    ? `/live/${seller.liveStreams[0].shareCode}`
                    : `/shop/${seller.slug}`;
                  return (
                  <Link key={seller.id} href={liveHref} className="flex flex-col items-center flex-shrink-0 w-16 group">
                    <div className="relative mb-1.5">
                      <div className={`w-14 h-14 rounded-full overflow-hidden bg-gray-100 ${live ? LIVE_RING_CLASS : "ring-2 ring-gray-100"}`}>
                        <SafeImage
                          src={sellerProfileImage(seller)}
                          placeholder={pickSellerAvatar(seller.id)}
                          alt={seller.shopName}
                          width={56}
                          height={56}
                          fallbackText={seller.shopName.charAt(0)}
                        />
                      </div>
                      {live && <LiveBadge className="absolute -bottom-1 left-1/2 -translate-x-1/2" />}
                    </div>
                    <p className="text-[10px] font-medium text-gray-700 truncate w-full text-center">{seller.shopName}</p>
                  </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 메뉴 그리드 */}
      <div className="px-4 mb-4">
        <div className="grid grid-cols-3 gap-3">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-100 hover:border-brand-200 transition-all"
            >
              <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center`}>
                <Icon name={item.icon} size={20} />
              </div>
              <div className="text-center">
                <p className={`${(item as { small?: boolean }).small ? "text-[10px] whitespace-nowrap" : "text-xs"} font-medium text-gray-800`}>{item.label}</p>
                {item.count !== null && item.count > 0 && (
                  <p className="text-[10px] text-brand-600 font-bold">{item.count}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 내가 찜한 상품 */}
      <div className="px-4 mb-4">
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h2 className="text-sm font-bold text-gray-900">
              <Icon name="Wishlist" size={14} className="inline-block mr-1 text-rose-500 fill-rose-500" />
              내가 찜한 상품
            </h2>
            {user._count.wishlists > 0 && (
              <Link href="/my/wishlist" className="text-xs text-brand-600 hover:underline">
                전체보기 ({user._count.wishlists})
              </Link>
            )}
          </div>
          {user.wishlists.length > 0 ? (
            <div className="px-4 pb-3">
              <div className="grid grid-cols-3 gap-2">
                {user.wishlists.map((wish) => {
                  const p = wish.product;
                  const discountPercent = p.comparePrice && Number(p.comparePrice) > Number(p.basePrice)
                    ? Math.round((1 - Number(p.basePrice) / Number(p.comparePrice)) * 100)
                    : 0;
                  return (
                    <Link key={wish.id} href={`/products/${p.id}`} className="group">
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 mb-1.5">
                        <SafeImage
                          src={p.thumbnail}
                          placeholder={NO_IMAGE}
                          alt={p.name}
                          width={160}
                          height={160}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          fallbackText={p.name.charAt(0)}
                        />
                        {discountPercent > 0 && (
                          <span className="absolute top-1 left-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                            {discountPercent}%
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 truncate">
                        {p.sellerProducts[0]?.seller?.shopName || p.brand?.brandName || ""}
                      </p>
                      <p className="text-xs font-medium text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs font-bold text-gray-900">{formatPrice(Number(p.basePrice))}</p>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 px-4">
              <Icon name="Wishlist" size={36} strokeWidth={1.5} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs">아직 찜한 상품이 없습니다.</p>
            </div>
          )}
        </div>
      </div>

      {/* 최근 주문 */}
      <div className="px-4 mb-4">
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h2 className="text-sm font-bold text-gray-900">최근 주문</h2>
            <Link href="/my/orders" className="text-xs text-brand-600 hover:underline">
              전체보기
            </Link>
          </div>
          {user.orders.length > 0 ? (
            <div className="px-4 pb-3">
              {user.orders.slice(0, 3).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    {/* 상품명 + 고객명을 크게 강조 (주문번호는 작게) */}
                    <p className="text-[15px] font-bold text-gray-900 truncate">
                      {order.items[0]?.productName || "주문 상품"}
                      {order.items.length > 1 && (
                        <span className="text-[11px] font-normal text-gray-400"> 외 {order.items.length - 1}건</span>
                      )}
                    </p>
                    <p className="text-[12px] font-semibold text-gray-700 mt-0.5">{user.name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {order.seller.shopName} · {new Date(order.createdAt).toLocaleDateString("ko-KR")} · 주문 {order.orderNumber}
                    </p>
                    {order.discountType && Number(order.discountAmount) > 0 && (
                      <span className="text-[9px] text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">
                        {order.discountType.startsWith("referral")
                          ? "추천인 할인"
                          : order.discountType.startsWith("cart")
                          ? "장바구니 할인"
                          : order.discountType.startsWith("coupon")
                          ? "쿠폰 할인"
                          : "채널인증 할인"} -{formatPrice(Number(order.discountAmount))}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {formatPrice(Number(order.finalAmount))}
                    </p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      order.status === "DELIVERED" ? "bg-green-50 text-green-600"
                        : order.status === "SHIPPING" ? "bg-blue-50 text-blue-600"
                        : order.status === "CANCELLED" ? "bg-red-50 text-red-600"
                        : "bg-gray-50 text-gray-600"
                    }`}>
                      {order.status === "PENDING" && "결제대기"}
                      {order.status === "PAID" && "결제완료"}
                      {order.status === "CONFIRMED" && "확인됨"}
                      {order.status === "SHIPPING" && "배송중"}
                      {order.status === "DELIVERED" && "배송완료"}
                      {order.status === "CANCELLED" && "취소됨"}
                      {order.status === "REFUND_REQUESTED" && "환불요청"}
                      {order.status === "REFUNDED" && "환불완료"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 px-4">
              <Icon name="Package" size={36} strokeWidth={1.5} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs">아직 주문 내역이 없습니다.</p>
            </div>
          )}
        </div>
      </div>

      {/* 하단 메뉴 */}
      <MyPageBottomMenu />
    </div>
  );
}
