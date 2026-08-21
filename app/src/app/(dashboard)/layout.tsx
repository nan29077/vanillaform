import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFeatureFlags } from "@/lib/settings";
import { pickRoleAvatar, shouldUseAvatar } from "@/lib/defaults";
import type { FeatureFlags } from "@/lib/featureFlags";
import {Shield, Store, Crown, User} from 'lucide-react';
import LogoutButton from "@/components/shared/LogoutButton";
import MobileSidebar from "@/components/shared/MobileSidebar";
import SidebarNavLinks from "@/components/shared/SidebarNavLinks";
import NotificationBell from "@/components/shared/NotificationBell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await auth();
  } catch (e) {
    console.error("Dashboard auth error:", e);
    redirect("/auth/login");
  }
  
  if (!session?.user) redirect("/auth/login");

  const role = (session.user as any).role || "BUYER";

  // Buyer는 대시보드 접근 불가
  if (role === "BUYER") redirect("/");

  const navItems: Record<string, { href: string; iconName: string; label: string; group?: string }[]> = {
    SUPER_ADMIN: [
      { href: "/admin", iconName: "Dashboard", label: "대시보드", group: "메인" },
      // 회원 관리
      { href: "/admin/users", iconName: "Users", label: "회원 관리", group: "회원 관리" },
      { href: "/admin/sellers", iconName: "Store", label: "라이브 셀러 관리", group: "회원 관리" },
      { href: "/admin/middle-admins", iconName: "Settings", label: "중간관리자 관리", group: "회원 관리" },
      { href: "/admin/brands", iconName: "Official", label: "브랜드사 관리", group: "회원 관리" },
      { href: "/admin/nodes", iconName: "Users", label: "노드 계정 관리", group: "회원 관리" },
      // 상품 관리
      { href: "/admin/products", iconName: "Package", label: "상품 관리", group: "상품 관리" },
      { href: "/admin/package-products", iconName: "Package", label: "패키지 상품 승인", group: "상품 관리" },
      { href: "/admin/package-purchase-orders", iconName: "OrderManagement", label: "패키지 발주서", group: "상품 관리" },
      { href: "/admin/categories", iconName: "Category", label: "카테고리 관리", group: "상품 관리" },
      // 주문·정산
      { href: "/admin/orders", iconName: "OrderManagement", label: "주문 관리", group: "주문·정산" },
      { href: "/admin/campaigns", iconName: "Event", label: "공동구매 관리", group: "주문·정산" },
      { href: "/admin/settlements", iconName: "Settlement", label: "정산 관리", group: "주문·정산" },
      { href: "/admin/middle-settlements", iconName: "Settlement", label: "중간관리자 정산", group: "주문·정산" },
      { href: "/admin/brand-settlements", iconName: "Warehouse", label: "브랜드사 정산", group: "주문·정산" },
      { href: "/admin/node-settlements", iconName: "Bandwidth", label: "노드 정산", group: "주문·정산" },
      { href: "/admin/deposit-transfer", iconName: "Wallet", label: "입금이체(송금)", group: "주문·정산" },
      { href: "/admin/manual-settlement", iconName: "Edit", label: "수기 정산", group: "주문·정산" },
      { href: "/admin/tax", iconName: "Receipt", label: "세무 관리", group: "주문·정산" },
      { href: "/admin/revenue", iconName: "Ranking", label: "관리자 수익", group: "주문·정산" },
      // 콘텐츠
      { href: "/admin/banners", iconName: "Globe", label: "사이트 관리", group: "콘텐츠" },
      { href: "/admin/contents", iconName: "Star", label: "콘텐츠 관리", group: "콘텐츠" },
      { href: "/admin/games", iconName: "Play", label: "게임관리", group: "콘텐츠" },
      { href: "/admin/live-products", iconName: "Live", label: "라이브 상품관리", group: "콘텐츠" },
      // 알림톡
      { href: "/admin/alimtalk", iconName: "Notification", label: "알림톡 관리", group: "알림톡" },
      // 고객지원
      { href: "/admin/inquiries", iconName: "Comment", label: "문의 관리", group: "고객지원" },
      { href: "/admin/support/chatbot", iconName: "Message", label: "챗봇 관리", group: "고객지원" },
      { href: "/admin/contact-settings", iconName: "CustomerService", label: "고객센터 설정", group: "고객지원" },
      // SNS구독 승인은 HIDDEN_MENU_HREFS 로 숨김
      { href: "/admin/channel-verifications", iconName: "Certified", label: "SNS구독 승인", group: "고객지원" },
      // 시스템
      { href: "/admin/seller-rates", iconName: "Discount", label: "멘티추천커미션·기타 할인율 설정", group: "시스템" },
      { href: "/admin/settings", iconName: "Settings", label: "권한 설정", group: "시스템" },
      { href: "/admin/account", iconName: "Lock", label: "내 계정", group: "시스템" },
    ],
    SELLER: [
      { href: "/seller", iconName: "Dashboard_icon", label: "대시보드", group: "메인" },
      // 샵 관리
      { href: "/seller/shop", iconName: "ShopManagement_icon", label: "샵 관리", group: "샵 관리" },
      // 상품 관리
      { href: "/seller/products", iconName: "ProductManagement_icon", label: "상품 관리", group: "상품 관리" },
      { href: "/seller/contents", iconName: "ProductContent_icon", label: "콘텐츠 관리", group: "상품 관리" },
      // 판매·라이브
      { href: "/seller/live", iconName: "Live_icon", label: "라이브 커머스", group: "판매·라이브" },
      { href: "/seller/campaigns", iconName: "Event", label: "공동구매 관리", group: "판매·라이브" },
      { href: "/seller/games", iconName: "Play", label: "게임관리", group: "판매·라이브" },
      // 주문·정산
      { href: "/seller/orders", iconName: "OrderManagement_icon", label: "주문 관리", group: "주문·정산" },
      { href: "/seller/package-purchase-orders", iconName: "Package", label: "패키지 발주서", group: "주문·정산" },
      { href: "/seller/settlements", iconName: "Settlement_icon", label: "정산·출금", group: "주문·정산" },
      // 알림톡
      { href: "/seller/alimtalk", iconName: "Notification", label: "알림톡 관리", group: "알림톡" },
      // 팬 관리
      { href: "/seller/fans", iconName: "Heart", label: "팬 관리", group: "팬 관리" },
      // SNS구독 승인은 HIDDEN_MENU_HREFS 로 숨김
      { href: "/seller/channel-verifications", iconName: "Certified", label: "SNS구독 승인", group: "팬 관리" },
      // 추천인(멘토-멘티)
      { href: "/seller/mentees", iconName: "Users", label: "멘티셀러 관리", group: "추천인 관리" },
      // 설정
      { href: "/seller/settings", iconName: "Settings", label: "설정", group: "설정" },
    ],
    MIDDLE_ADMIN: [
      { href: "/middle", iconName: "Dashboard", label: "대시보드", group: "메인" },
      // 회원 관리
      { href: "/middle/sellers", iconName: "Store", label: "라이브 셀러 관리", group: "회원 관리" },
      { href: "/middle/brands", iconName: "Official", label: "브랜드사 관리", group: "회원 관리" },
      // 상품
      { href: "/middle/products", iconName: "Package", label: "상품 관리", group: "상품" },
      { href: "/middle/package-products", iconName: "Package", label: "패키지 상품", group: "상품" },
      // 주문·정산
      { href: "/middle/orders", iconName: "OrderManagement", label: "주문 관리", group: "주문·정산" },
      { href: "/middle/settlements", iconName: "Settlement", label: "마진 정산", group: "주문·정산" },
      { href: "/middle/brand-settlements", iconName: "Warehouse", label: "브랜드사 정산", group: "주문·정산" },
      // 설정
      { href: "/middle/settings", iconName: "Settings", label: "설정", group: "설정" },
    ],
    NODE: [
      { href: "/node", iconName: "Dashboard", label: "대시보드", group: "메인" },
      { href: "/node/products", iconName: "Package", label: "상품 관리", group: "상품" },
      { href: "/node/members", iconName: "Users", label: "전체 회원 관리", group: "회원 관리" },
      { href: "/node/sellers", iconName: "Store", label: "셀러 관리", group: "회원 관리" },
      { href: "/node/brands", iconName: "Official", label: "브랜드 관리", group: "회원 관리" },
      { href: "/node/orders", iconName: "OrderManagement", label: "주문 관리", group: "주문·정산" },
      { href: "/node/settlements", iconName: "Settlement", label: "정산 관리", group: "주문·정산" },
      { href: "/node/settings", iconName: "Settings", label: "설정", group: "설정" },
    ],
    BRAND_ADMIN: [
      { href: "/brand", iconName: "Dashboard", label: "대시보드", group: "메인" },
      // 상품·셀러
      { href: "/brand/products", iconName: "Package", label: "상품 관리", group: "상품·셀러" },
      { href: "/brand/sellers", iconName: "Users", label: "라이브 셀러 관리", group: "상품·셀러" },
      // 주문·정산
      { href: "/brand/orders", iconName: "OrderManagement", label: "주문 현황", group: "주문·정산" },
      { href: "/brand/package-purchase-orders", iconName: "Package", label: "패키지 발주서", group: "주문·정산" },
      { href: "/brand/settlements", iconName: "Settlement", label: "정산 내역", group: "주문·정산" },
      { href: "/brand/stats", iconName: "Chart", label: "통계", group: "주문·정산" },
      // 콘텐츠
      { href: "/brand/contents", iconName: "Star", label: "콘텐츠 관리", group: "콘텐츠" },
      // 계정
      { href: "/brand/settings", iconName: "Settings", label: "브랜드 설정", group: "계정" },
    ],
    BUYER: [],
  };

  // 노드 정산 메뉴: 활성 노드 계정이 1개 이상일 때만 표시
  const activeNodeCount =
    role === "SUPER_ADMIN"
      ? await prisma.user.count({ where: { role: "NODE", isActive: true } })
      : 0;

  // 기능 토글에 따라 관련 메뉴 숨김. (href → 필요한 기능 키)
  const flags: FeatureFlags = await getFeatureFlags();
  const MENU_FEATURE_GATE: { match: (href: string) => boolean; key: keyof FeatureFlags }[] = [
    { match: (h) => h.endsWith("/campaigns"), key: "groupBuy" },
    { match: (h) => h.endsWith("/live") || h.endsWith("/live-products"), key: "liveCommerce" },
    { match: (h) => h.endsWith("/contents"), key: "brix" },
    { match: (h) => h === "/admin/sellers", key: "seller" },
    { match: (h) => h === "/seller/games", key: "game" },
  ];
  // 노출 숨김 메뉴: "SNS구독 승인"(채널 구독 인증) 메뉴는 사이드바에서 감춘다.
  // (페이지/기능 자체는 유지하되 메뉴 진입만 비노출)
  const HIDDEN_MENU_HREFS = ["/admin/channel-verifications", "/seller/channel-verifications"];
  const items = (navItems[role] || navItems.BUYER).filter((item) => {
    if (HIDDEN_MENU_HREFS.includes(item.href)) return false;
    // 노드 정산: 활성 노드가 없으면 메뉴 숨김
    if (item.href === "/admin/node-settlements") return activeNodeCount > 0;
    // 라이브 상품관리: 라이브커머스 또는 공동구매 중 하나라도 꺼져 있으면 숨김
    if (item.href === "/admin/live-products") return flags.liveCommerce && flags.groupBuy;
    const gate = MENU_FEATURE_GATE.find((g) => g.match(item.href));
    return gate ? flags[gate.key] : true;
  });

  // Fetch profile photo for seller/brand - safely
  let profileImage = session.user.image || null;
  let userAvatar: string | null = null;
  let userGender: string | null = null;
  // SELLER 사이드바 표시 이름: session.user.name(JWT) 대신 DB에서 직접 읽은 shopName 사용
  let sellerShopName: string | null = null;
  try {
    const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { avatar: true, gender: true } });
    userAvatar = dbUser?.avatar ?? null;
    userGender = dbUser?.gender ?? null;
    if (role === "SELLER") {
      const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user.id }, select: { shopLogo: true, shopName: true } });
      if (seller?.shopLogo) profileImage = seller.shopLogo;
      if (seller?.shopName) sellerShopName = seller.shopName;
    } else if (role === "BRAND_ADMIN") {
      const brand = await prisma.brandProfile.findUnique({ where: { userId: session.user.id }, select: { brandLogo: true } });
      if (brand?.brandLogo) profileImage = brand.brandLogo;
    }
  } catch (e) {
    console.error("Profile image fetch error:", e);
    // Continue with default image
  }
  // 사이드바에 표시할 이름: SELLER는 shopName(셀러명), 그 외는 User.name
  const sidebarName = sellerShopName || session.user.name;

  // 역할 기반 랜덤 캐릭터 아바타 (기존 프로필 이미지 우선, 없으면 역할별 캐릭터)
  // 제외 목록(예: 천송이 쇼핑/김혜선)은 아바타를 적용하지 않음
  const roleAvatarFallback = shouldUseAvatar(session.user.name, sellerShopName)
    ? (userAvatar || pickRoleAvatar(session.user.id, role, userGender))
    : (userAvatar || null);
  const displayImage = profileImage || roleAvatarFallback;
  const sidebarAvatar = displayImage;

  const roleConfig: Record<string, { label: string; labelEn: string; icon: any; color: string; gradient: string }> = {
    SUPER_ADMIN: { label: "최고관리자", labelEn: "Admin Console", icon: Shield, color: "text-red-600 bg-red-50", gradient: "from-red-500 to-rose-600" },
    NODE: { label: "노드", labelEn: "Node Console", icon: Shield, color: "text-teal-600 bg-teal-50", gradient: "from-teal-500 to-emerald-600" },
    MIDDLE_ADMIN: { label: "중간관리자", labelEn: "Partner Console", icon: Shield, color: "text-amber-600 bg-amber-50", gradient: "from-amber-500 to-orange-600" },
    SELLER: { label: "라이브 셀러", labelEn: "Seller Studio", icon: Store, color: "text-blue-600 bg-blue-50", gradient: "from-blue-500 to-indigo-600" },
    BRAND_ADMIN: { label: "브랜드", labelEn: "Brand Portal", icon: Crown, color: "text-purple-600 bg-purple-50", gradient: "from-purple-500 to-violet-600" },
    BUYER: { label: "구매자", labelEn: "My Page", icon: User, color: "text-green-600 bg-green-50", gradient: "from-green-500 to-emerald-600" },
  };
  const rc = roleConfig[role] || roleConfig.BUYER;

  return (
    <div className="min-h-screen bg-[#fdfaf0]">
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-[260px] bg-white border-r border-gray-100/80 hidden lg:flex flex-col z-40">
        {/* Logo & Role */}
        <div className="px-5 py-4 border-b border-gray-100/80 flex items-start justify-between">
          <Link href="/" className="flex flex-col items-start gap-0.5">
            <img src="/logo.svg" alt="바닐라폼" className="h-8 w-auto object-contain" />
            <p className="text-[9px] text-gray-400 tracking-wide pl-0.5">{rc.labelEn}</p>
          </Link>
          {/* 대시보드 알림(출금 반려 등) — /my/* 는 구매자 전용이라 "전체 보기"는 숨긴다 */}
          <NotificationBell size={20} className="text-gray-500" buttonClassName="p-1.5 -mr-1.5" allHref={null} />
        </div>

        {/* User Profile */}
        <div className="px-4 py-3.5 border-b border-gray-100/80">
          <div className="flex items-center gap-3">
            {displayImage ? (
              <img
                src={displayImage}
                alt={session.user.name || "프로필"}
                className="w-9 h-9 rounded-lg object-cover shadow-sm"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${rc.gradient} flex items-center justify-center text-white text-sm font-bold shadow-sm`}>
                {sidebarName?.charAt(0) || "U"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-900 truncate">{sidebarName}</p>
              <p className="text-[10px] text-gray-400 truncate">{session.user.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <SidebarNavLinks items={items} />

        {/* Bottom Actions */}
        <div className="p-3 border-t border-gray-100/80 space-y-0.5">
          <Link
            href="/?main=1"
            className="flex items-center gap-3 px-3 py-2 text-[13px] text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Icon name="Home" size={16} strokeWidth={1.5} />
            메인으로
          </Link>
          <LogoutButton variant="sidebar" />
        </div>
      </aside>

      {/* Mobile Sidebar (Client Component) */}
      <MobileSidebar
        items={items}
        roleConfig={{ label: rc.label, color: rc.color }}
        user={{
          name: sidebarName,
          email: session.user.email,
          nameInitial: sidebarName?.charAt(0) || "U",
          avatar: sidebarAvatar,
        }}
      />

      {/* Main Content */}
      <main className="lg:ml-[260px] min-h-screen p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
