import { Icon } from '@/components/shared/Icon';
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import SafeImage from "@/components/shared/SafeImage";
import SellerSearchHero from "@/components/shared/SellerSearchHero";
import HomeMyShopBar from "@/components/shared/HomeMyShopBar";
import HeroBannerSlider from "@/components/shared/HeroBannerSlider";
import SellerMarquee from "@/components/shared/SellerMarquee";
import HomeFaq from "@/components/shared/HomeFaq";
import HomeStartTabs from "@/components/shared/HomeStartTabs";
import { DEFAULT_PRODUCT_IMAGE, pickSellerAvatar } from "@/lib/defaults";
import { LIVE_RING_CLASS, OnAirBadge } from "@/components/shared/LiveBadge";
import { getFeatureFlags } from "@/lib/settings";
import { getHomeStats, getHomeStories, getHomeBenefits } from "@/lib/siteContent";
import { Heart, Radio, Sparkles, ShieldCheck, Gift, Award, Quote, Instagram, Youtube, Rocket, Shirt, Sofa, UtensilsCrossed, Laptop, Baby, Dumbbell, PawPrint, CreditCard, Smartphone, Landmark} from 'lucide-react';

export const dynamic = "force-dynamic";

// 남성/여성 구매회원 캐릭터 이미지 — 항목 인덱스 기반으로 남/여 교대 적용
const BUYER_MALE_AVATARS = Array.from({ length: 13 }, (_, i) => `/avatars/남성구매회원_${i + 1}.png`);
const BUYER_FEMALE_AVATARS = Array.from({ length: 13 }, (_, i) => `/avatars/여성구매회원_${i + 1}.png`);
function buyerAvatar(i: number): string {
  const arr = i % 2 === 0 ? BUYER_MALE_AVATARS : BUYER_FEMALE_AVATARS;
  return encodeURI(arr[Math.floor(i / 2) % arr.length]);
}

// 서비스 차별점 (왜 바닐라폼인가)
const DIFFERENTIATORS = [
  { icon: Heart, color: "text-pink-500", bg: "bg-pink-50", title: "단골 중심 구조", desc: "아무나 둘러보는 오픈마켓이 아니라, 내가 PICK한 라이브 셀러와 깊게 연결돼요." },
  { icon: Radio, color: "text-rose-500", bg: "bg-rose-50", title: "라이브로 사는 재미", desc: "실시간 방송에서 묻고 바로 사는, 보는 쇼핑의 몰입감." },
  { icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-50", title: "안심 거래·정산", desc: "통신판매중개 보호와 투명한 정산으로 안전하게." },
  { icon: Gift, color: "text-brand-600", bg: "bg-brand-50", title: "소싱 없이 라이브 셀러 시작", desc: "브랜드 상품을 골라 담기만 하면 누구나 라이브 셀러가 될 수 있어요." },
];

// 라이브 커머스 진행 방법 (구매자 / 셀러)
const BUYER_STEPS = ["좋아하는 라이브 셀러를 PICK해요", "방송 시작 알림을 받아요", "라이브에 입장해 소통해요", "마음에 들면 바로 구매해요"];
const SELLER_STEPS = ["판매할 브랜드 상품을 골라요", "라이브 방송을 예약·시작해요", "실시간으로 상품을 소개해요", "주문·정산은 플랫폼이 처리해요"];

// 카테고리 소개 (라인형 아이콘)
const CATEGORIES = [
  { icon: Shirt, name: "패션" }, { icon: Sparkles, name: "뷰티" }, { icon: Sofa, name: "리빙" },
  { icon: UtensilsCrossed, name: "푸드" }, { icon: Laptop, name: "디지털" }, { icon: Baby, name: "키즈" },
  { icon: Dumbbell, name: "스포츠" }, { icon: PawPrint, name: "펫" },
];

// 메인 페이지 = "바닐라폼 브랜드 소개 + 셀러 진입(이름검색/PICK) + 셀러 신청 유도" 화면.
// ※ 상품 판매/구매 리스트(인기상품·공구·상품 그리드 등)는 두지 않는다.
//   유일한 예외: 내가 PICK한 셀러가 "지금 라이브 방송 중"인 상품을 셀러별로 묶어 보여준다.
async function getHomeData(featureLive: boolean) {
  const session = await auth();
  const isBuyer = !!(session?.user && session.user.role === "BUYER");

  let liveSellers: {
    id: string;
    slug: string;
    shopName: string;
    shopLogo: string | null;
    liveTitle: string;
    shareCode: string | null;
    isManual: boolean;
    liveLink: string | null;
    products: { id: string; name: string; thumbnail: string | null; price: number; basePrice: number }[];
  }[] = [];

  if (isBuyer) {
    const profile = await prisma.buyerProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        follows: {
          select: {
            seller: {
              select: {
                id: true,
                slug: true,
                shopName: true,
                shopLogo: true,
                featureLiveCommerce: true,
                isManualLive: true,
                liveLink: true,
                manualLiveProductIds: true,
                liveStreams: {
                  where: { status: "LIVE" },
                  take: 1,
                  orderBy: { startedAt: "desc" },
                  select: {
                    id: true,
                    title: true,
                    shareCode: true,
                    products: {
                      orderBy: { sortOrder: "asc" },
                      select: {
                        id: true,
                        livePrice: true,
                        product: { select: { id: true, name: true, thumbnail: true, basePrice: true } },
                      },
                    },
                  },
                },
                shopProducts: {
                  where: { isActive: true },
                  select: {
                    product: { select: { id: true, name: true, thumbnail: true, basePrice: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    liveSellers = (profile?.follows || [])
      .map((f) => f.seller)
      .map((s) => {
        // 1순위: 바닐라폼 라이브 커머스(실제 LIVE 방송) — 라이브 커머스 기능 ON + 방송 진행 중
        const hasRealLive = featureLive && (s.featureLiveCommerce ?? false) && s.liveStreams.length > 0;
        if (hasRealLive) {
          const live = s.liveStreams[0];
          return {
            id: s.id,
            slug: s.slug,
            shopName: s.shopName,
            shopLogo: s.shopLogo,
            liveTitle: live.title,
            shareCode: live.shareCode,
            isManual: false,
            liveLink: null,
            products: live.products.map((lp) => ({
              id: lp.product.id,
              name: lp.product.name,
              thumbnail: lp.product.thumbnail,
              price: Number(lp.livePrice ?? lp.product.basePrice),
              basePrice: Number(lp.product.basePrice),
            })),
          };
        }

        // 2순위: 수동 "라이브 중" 스위치 ON — 실제 방송 없이도 노출 상품과 함께 노출
        if (s.isManualLive) {
          let ids: string[] = [];
          try {
            ids = JSON.parse((s as any).manualLiveProductIds || "[]");
          } catch {
            ids = [];
          }
          const productMap = new Map(s.shopProducts.map((sp) => [sp.product.id, sp.product]));
          const products = ids
            .map((id) => productMap.get(id))
            .filter(Boolean)
            .map((p) => ({
              id: p!.id,
              name: p!.name,
              thumbnail: p!.thumbnail,
              price: Number(p!.basePrice),
              basePrice: Number(p!.basePrice),
            }));
          return {
            id: s.id,
            slug: s.slug,
            shopName: s.shopName,
            shopLogo: s.shopLogo,
            liveTitle: "라이브 중",
            shareCode: null,
            isManual: true,
            liveLink: (s as any).liveLink || null,
            products,
          };
        }

        return null;
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
  }

  return { liveSellers, isBuyer };
}

const SELLER_CTA_BG_DEFAULT = "/banners/banner5.jpg";

// 구매회원(BUYER) 외 계정은 메인 페이지 진입 시 각자 대시보드로 리다이렉트
const ROLE_DASHBOARD: Record<string, string> = {
  SELLER: "/seller",
  BRAND_ADMIN: "/brand",
  SUPER_ADMIN: "/admin",
  MIDDLE_ADMIN: "/middle",
  NODE: "/node",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const session = await auth();
  const role = session?.user?.role;
  // 대시보드의 "메인으로"/"홈" 버튼은 ?main=1 로 진입한다.
  // 이 경우 비구매 계정도 대시보드로 튕기지 않고 메인 페이지를 그대로 본다.
  const forceHome = searchParams?.main === "1";
  if (!forceHome && role && role !== "BUYER" && ROLE_DASHBOARD[role]) {
    redirect(ROLE_DASHBOARD[role]);
  }

  const { liveCommerce: FEATURE_LIVE } = await getFeatureFlags();
  const { liveSellers, isBuyer } = await getHomeData(FEATURE_LIVE);

  // 관리자 "사이트 관리 > 메인페이지 관리"에서 수정 가능한 숫자/성공스토리/혜택
  const [homeStats, homeStories, homeBenefits] = await Promise.all([getHomeStats(), getHomeStories(), getHomeBenefits()]);

  // 최고관리자 배너 관리에서 등록한 상단 배너(최대 3개, 슬라이드) + 하단 배너
  const [heroBanners, bottomBanner, activeCampaignCount] = await Promise.all([
    prisma.banner.findMany({
      where: { isActive: true, position: "hero" },
      orderBy: { sortOrder: "asc" },
      take: 3,
    }),
    prisma.banner.findFirst({
      where: { isActive: true, position: "bottom" },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.groupBuyCampaign.count({ where: { status: "ACTIVE" } }),
  ]);

  const sellerCtaBg = bottomBanner?.imageUrl || SELLER_CTA_BG_DEFAULT;
  const sellerCtaLink = bottomBanner?.linkUrl || "/become-seller";

  return (
    <div className="bg-white min-h-screen">
      {/* ───── 상단 배너 슬라이드 (자동+수동, 최대 3페이지 / DB 배너 없으면 기본) ───── */}
      <HeroBannerSlider
        banners={heroBanners.map((b) => ({
          id: b.id,
          title: b.title,
          subtitle: b.subtitle,
          imageUrl: b.imageUrl,
          linkUrl: b.linkUrl,
        }))}
        liveCampaignCount={activeCampaignCount}
      />

      {/* ───── 내 PICK 셀러 LIVE 방송 중 상품 (셀러별 구분) ───── */}
      {liveSellers.length > 0 && (
        <section className="pt-6 pb-2">
          <div className="flex items-center gap-1.5 px-4 mb-3">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <h2 className="text-sm font-bold text-gray-900">내PICK 라이브</h2>
            <span className="text-[10px] text-gray-400">지금 방송 중</span>
          </div>

          <div className="space-y-5">
            {liveSellers.map((s) => {
              // 프로필 클릭 → 라이브 방송으로 이동 (우선순위: 인앱 라이브 시청페이지 > 샵관리 수동 liveLink > 셀러샵)
              const inAppLiveUrl = !s.isManual && s.shareCode ? `/live/${s.shareCode}` : null;
              const externalLiveUrl = s.isManual ? s.liveLink : null;
              const profileContent = (
                <>
                  {/* 라이브 중 프로필 — 라이브 메뉴(/live)와 동일한 두근두근 링 (LIVE_RING_CLASS) */}
                  <div className="relative w-10 h-10 flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full overflow-hidden bg-gray-100 ${LIVE_RING_CLASS}`}>
                      <SafeImage src={s.shopLogo} placeholder={pickSellerAvatar(s.id)} alt={s.shopName} width={40} height={40} fallbackText={s.shopName.charAt(0)} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13px] font-bold text-gray-900 truncate">{s.shopName}</p>
                      <OnAirBadge className="w-8 h-8" />
                    </div>
                    <p className="text-[10px] text-gray-400 truncate">{s.liveTitle}</p>
                  </div>
                </>
              );
              const profileCls = "flex items-center gap-2.5 px-4 mb-2.5";
              // 샵 바로가기 버튼 (상품 리스트 오른쪽)
              const shopShortcut = (
                <Link
                  href={`/shop/${s.slug}`}
                  className="flex-shrink-0 w-20 flex flex-col items-center justify-center gap-1 rounded-xl border border-gray-200 bg-gray-50 active:scale-[0.98] transition-transform aspect-square self-start"
                >
                  <Icon name="Store" size={18} className="text-gray-500" />
                  <span className="text-[10px] font-semibold text-gray-600">샵 바로가기</span>
                </Link>
              );
              return (
                <div key={s.id}>
                  {/* 셀러 헤더 — 클릭 시 라이브 방송으로 이동 (인앱 라이브 우선, 수동 연동은 liveLink) */}
                  {externalLiveUrl ? (
                    <a href={externalLiveUrl} target="_blank" rel="noopener noreferrer" className={profileCls}>
                      {profileContent}
                    </a>
                  ) : (
                    <Link href={inAppLiveUrl || `/shop/${s.slug}`} className={profileCls}>
                      {profileContent}
                    </Link>
                  )}

                  {/* 방송 중 상품 가로 스크롤 + 샵 바로가기 */}
                  {s.products.length > 0 ? (
                    <div className="flex gap-2.5 overflow-x-auto scrollbar-hide px-4 pb-1">
                      {s.products.map((p) => {
                        const dp = p.basePrice > p.price ? Math.round((1 - p.price / p.basePrice) * 100) : 0;
                        return (
                          <Link
                            key={p.id}
                            href={`/products/${p.id}?sellerId=${s.id}&ref=${s.slug}`}
                            className="flex-shrink-0 w-20 active:scale-[0.98] transition-transform"
                          >
                            <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 mb-1.5">
                              <SafeImage src={p.thumbnail} placeholder={DEFAULT_PRODUCT_IMAGE} alt={p.name} width={80} height={80} fallbackText={p.name.charAt(0)} className="w-full h-full object-cover" />
                              {dp > 0 && (
                                <span className="absolute top-1 left-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">LIVE {dp}%</span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-800 line-clamp-1">{p.name}</p>
                            <p className="text-[12px] font-bold text-gray-900">{p.price.toLocaleString()}원</p>
                          </Link>
                        );
                      })}
                      {shopShortcut}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 px-4 pb-1">
                      <p className="text-[11px] text-gray-400 flex-1">방송 상품 준비 중</p>
                      {shopShortcut}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 라이브 중인 PICK 셀러가 없을 때(로그인 구매자에게만) 안내 */}
      {liveSellers.length === 0 && isBuyer && (
        <section className="pt-6 pb-1 px-4">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-2 h-2 rounded-full bg-gray-300" />
            <h2 className="text-sm font-bold text-gray-900">내PICK 라이브</h2>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 px-4 py-5 text-center">
            <Icon name="Live" size={24} strokeWidth={1.5} className="mx-auto mb-2 text-gray-300" />
            <p className="text-[12px] text-gray-500">현재 라이브 중인 PICK 라이브 셀러가 없어요</p>
            <p className="text-[11px] text-gray-400 mt-0.5">PICK한 라이브 셀러가 방송을 시작하면 여기에 표시돼요</p>
          </div>
        </section>
      )}

      {/* ───── 셀러 찾기 (이름 검색) ───── */}
      <div id="find-seller">
        <SellerSearchHero />
      </div>

      {/* ───── 내 PICK + 빠른 메뉴 ───── */}
      <HomeMyShopBar />

      {/* ───── 바닐라폼 소개: 우리는 이런 곳이에요 ───── */}
      <section className="px-5 pt-8 pb-2">
        <h2 className="text-[17px] font-extrabold text-gray-900">바닐라폼는요</h2>
        <p className="mt-1.5 text-[13px] text-gray-500 leading-relaxed">
          브랜드의 좋은 상품을, 신뢰하는 라이브 셀러(인플루언서)의 목소리로 만나는 곳.
          정해진 라이브 셀러를 통해서만 쇼핑하는, 단골 중심의 새로운 커머스예요.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <IntroStat icon={<Icon name="Users" size={18} className="text-brand-600" />} value="단골 PICK" label="나만의 라이브 셀러" />
          <IntroStat icon={<Icon name="Live" size={18} className="text-rose-500" />} value="라이브" label="실시간 소통" />
          <IntroStat icon={<Icon name="Certified" size={18} className="text-emerald-500" />} value="안심거래" label="중개 보호" />
        </div>
      </section>

      {/* ───── 지금 활동중인 셀러 (자동 슬라이드 마퀴) ───── */}
      <section className="pt-7 pb-1">
        <div className="flex items-center gap-1.5 px-5 mb-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h2 className="text-[15px] font-extrabold text-gray-900">지금 활동중인 라이브 셀러</h2>
        </div>
        <SellerMarquee />
      </section>

      {/* ───── 바닐라폼로 얻는 것 (통계·효과·혜택) ───── */}
      <section className="px-5 pt-7 pb-2">
        <h2 className="text-[17px] font-extrabold text-gray-900">바닐라폼로 얻는 것</h2>
        <p className="mt-1 text-[12px] text-gray-500">단골 중심 커머스가 만드는 차이</p>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {homeBenefits.stats.map((s, i) => (
            <StatTile key={i} value={s.value} label={s.label} sub={s.sub} />
          ))}
        </div>
        <div className="mt-4 space-y-2.5">
          {homeBenefits.items.map((item, i) => (
            <Benefit key={i} icon={<BenefitIcon type={item.iconType} />} title={item.title} desc={item.desc} />
          ))}
        </div>
      </section>

      {/* ───── 숫자로 보는 바닐라폼 (다크 배너) ───── */}
      <section className="px-4 pt-7">
        <div className="rounded-3xl bg-gray-900 text-white p-6">
          <div className="inline-flex items-center gap-1 rounded-full bg-brand-500/20 text-brand-300 px-2.5 py-1 mb-3">
            <Award size={12} /> <span className="text-[10px] font-bold tracking-wide">BY THE NUMBERS</span>
          </div>
          <h2 className="text-[18px] font-extrabold">숫자로 보는 바닐라폼</h2>
          <p className="text-[11px] text-white/60 mt-1">함께 성장하는 단골 커머스</p>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5">
            {homeStats.map((s, i) => (
              <BigStat key={i} value={s.value} label={s.label} />
            ))}
          </div>
        </div>
      </section>

      {/* ───── 성공한 셀러 스토리 ───── */}
      <section className="pt-8 pb-1">
        <div className="px-5 mb-3">
          <h2 className="text-[17px] font-extrabold text-gray-900">바닐라폼로 성공한 라이브 셀러</h2>
          <p className="mt-1 text-[12px] text-gray-500">평범한 일상에서, 나만의 샵으로</p>
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-1">
          {homeStories.map((s, i) => (
            <div key={s.name} className="flex-shrink-0 w-64 rounded-2xl border border-gray-100 bg-white p-4 flex flex-col">
              <Quote size={20} className="text-brand-400" />
              <p className="text-[12.5px] text-gray-700 leading-relaxed mt-2 flex-1">{s.quote}</p>
              <div className="flex items-center gap-2.5 mt-3 pt-3 border-t border-gray-50">
                <img src={buyerAvatar(i)} alt="" className="w-10 h-10 rounded-full bg-brand-50 ring-2 ring-brand-100 object-cover" />
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-gray-900 truncate">{s.name}</p>
                  <p className="text-[10.5px] text-brand-600 font-bold">{s.metric}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───── 이런 분들께 추천해요 ───── */}
      <section className="px-5 pt-8">
        <h2 className="text-[17px] font-extrabold text-gray-900">이런 분들께 추천해요</h2>
        <div className="mt-4 space-y-2.5">
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-9 h-9 rounded-xl bg-pink-50 flex items-center justify-center"><Icon name="Cart" size={17} className="text-pink-500" /></div>
              <p className="text-[14px] font-bold text-gray-900">이렇게 쇼핑하고 싶다면</p>
            </div>
            <ul className="space-y-1.5">
              {["믿을 수 있는 라이브 셀러에게만 사고 싶어요", "라이브로 실물 보고 바로 사고 싶어요", "단골 라이브 셀러의 큐레이션을 받고 싶어요"].map((t) => (
                <li key={t} className="flex items-start gap-1.5 text-[12.5px] text-gray-600"><Icon name="Check" size={14} className="text-brand-500 mt-0.5 flex-shrink-0" /> {t}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center"><Icon name="Store" size={17} className="text-brand-600" /></div>
              <p className="text-[14px] font-bold text-gray-900">이렇게 판매하고 싶다면</p>
            </div>
            <ul className="space-y-1.5">
              {["내 팬·팔로워로 수익을 만들고 싶어요", "상품 소싱·재고 부담 없이 시작하고 싶어요", "라이브와 콘텐츠로 판매하고 싶어요"].map((t) => (
                <li key={t} className="flex items-start gap-1.5 text-[12.5px] text-gray-700"><Icon name="Check" size={14} className="text-brand-600 mt-0.5 flex-shrink-0" /> {t}</li>
              ))}
            </ul>
            <Link href="/become-seller" className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-brand-700">
              라이브 셀러로 신청하기 <Icon name="ChevronDown" size={14} className="-rotate-90" />
            </Link>
          </div>
        </div>
      </section>

      {/* ───── 왜 바닐라폼일까요 (차별점) ───── */}
      <section className="px-5 pt-8">
        <div className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 px-2.5 py-1 mb-2">
          <Icon name="Lightning" size={12} /> <span className="text-[10px] font-bold">WHY VANILLAFORM</span>
        </div>
        <h2 className="text-[18px] font-extrabold text-gray-900">왜 바닐라폼일까요?</h2>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {DIFFERENTIATORS.map((d) => {
            const Icon = d.icon;
            return (
              <div key={d.title} className="rounded-2xl border border-gray-100 bg-white p-4">
                <div className={`w-9 h-9 rounded-xl ${d.bg} flex items-center justify-center mb-2`}>
                  <Icon size={17} className={d.color} />
                </div>
                <p className="text-[13px] font-bold text-gray-900">{d.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{d.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ───── 라이브 커머스 진행 방법 (구매자 / 셀러) ───── */}
      <section className="px-5 pt-8">
        <h2 className="text-[18px] font-extrabold text-gray-900">라이브 커머스, 이렇게 진행돼요</h2>
        <p className="mt-1 text-[12px] text-gray-500">구매자도, 라이브 셀러도 쉽고 간단하게</p>
        <div className="mt-4 grid grid-cols-1 gap-2.5">
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center"><Icon name="Wishlist" size={16} className="text-pink-500" /></div>
              <p className="text-[14px] font-bold text-gray-900">구매자라면</p>
            </div>
            <ol className="space-y-2">
              {BUYER_STEPS.map((t, i) => (
                <li key={t} className="flex items-center gap-2.5 text-[12.5px] text-gray-700">
                  <span className="w-5 h-5 rounded-full bg-gray-900 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center"><Icon name="Store" size={16} className="text-brand-600" /></div>
              <p className="text-[14px] font-bold text-gray-900">라이브 셀러라면</p>
            </div>
            <ol className="space-y-2">
              {SELLER_STEPS.map((t, i) => (
                <li key={t} className="flex items-center gap-2.5 text-[12.5px] text-gray-700">
                  <span className="w-5 h-5 rounded-full bg-brand-500 text-black text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ───── 카테고리 소개 ───── */}
      <section className="px-5 pt-8">
        <h2 className="text-[18px] font-extrabold text-gray-900">다양한 카테고리</h2>
        <p className="mt-1 text-[12px] text-gray-500">라이브 셀러의 취향만큼 폭넓은 상품들</p>
        <div className="mt-4 grid grid-cols-4 gap-2.5">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.name} className="rounded-2xl border border-gray-100 bg-white py-3.5 flex flex-col items-center gap-1.5">
                <span className="w-9 h-9 rounded-full bg-brand-50 flex items-center justify-center">
                  <Icon size={18} strokeWidth={1.6} className="text-brand-600" />
                </span>
                <span className="text-[11px] font-medium text-gray-700">{c.name}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ───── 간편결제 (셀러 편의) ───── */}
      <section className="px-4 pt-8">
        <div className="rounded-3xl border border-brand-100 bg-brand-50/50 p-5">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center flex-shrink-0">
              <Icon name="CreditCard" size={18} strokeWidth={1.8} className="text-black" />
            </span>
            <div>
              <h2 className="text-[16px] font-extrabold text-gray-900">결제는 1초, 판매는 막힘없이</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">통장 대조·수기 확인 없이 결제가 자동으로 끝나요</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {[
              {
                icon: CreditCard,
                label: "신용·체크카드",
                desc: "모든 카드사 즉시 결제. 할부도 지원돼 고객은 부담 없이, 라이브 셀러는 결제 누락 걱정 없이 판매해요.",
              },
              {
                icon: Smartphone,
                label: "간편결제",
                badge: "카카오페이 · 네이버페이 등",
                desc: "지문·비밀번호 한 번이면 끝. 카드 정보 입력 없이 라이브 도중에도 바로 결제로 이어져요.",
              },
              {
                icon: Landmark,
                label: "간편 계좌이체",
                desc: "계좌를 한 번만 등록하면, 라이브 방송마다 클릭 한 번으로 계좌이체 완료. 매번 계좌번호를 입력할 필요가 없어요.",
              },
            ].map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.label} className="flex items-start gap-3 rounded-2xl bg-white border border-gray-100 p-3.5">
                  <span className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                    <Icon size={17} strokeWidth={1.7} className="text-brand-600" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[13px] font-bold text-gray-900">{m.label}</p>
                      {m.badge && (
                        <span className="text-[9px] font-bold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded-full">{m.badge}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{m.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3.5 flex items-center gap-1.5 text-[12px] text-gray-600">
            <Icon name="Check" size={14} className="text-brand-600 flex-shrink-0" />
            카드·간편결제·계좌이체까지 모두 지원 — 라이브 셀러는 그만큼 편하게 판매해요
          </p>
        </div>
      </section>

      {/* ───── 이렇게 즐겨요 ───── */}
      <section className="px-5 pt-8 pb-2">
        <h2 className="text-[15px] font-extrabold text-gray-900">이렇게 즐겨요</h2>
        <div className="mt-4 space-y-2.5">
          <StoryStep no={1} icon={<Icon name="Search" size={16} className="text-brand-600" />} title="라이브 셀러를 찾아요" desc="라이브 셀러 이름으로 검색해 마음에 드는 라이브 셀러를 만나요." />
          <StoryStep no={2} icon={<Icon name="Wishlist" size={16} className="text-pink-500" />} title="라이브 셀러를 PICK해요" desc="PICK하면 단골가게가 되고, 새 소식과 라이브를 놓치지 않아요." />
          <StoryStep no={3} icon={<Icon name="Live" size={16} className="text-rose-500" />} title="샵·라이브를 즐겨요" desc="라이브 셀러별 전용 샵과 라이브에서 라이브 셀러의 취향을 그대로 만나요." />
        </div>
      </section>

      {/* ───── 셀러 신청 유도 배너 (실사 배경) ───── */}
      <section className="px-4 pt-7 pb-8">
        <Link
          href={sellerCtaLink}
          className="relative block rounded-3xl overflow-hidden active:scale-[0.99] transition-transform shadow-md"
        >
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${sellerCtaBg})` }} />
          <div className="absolute inset-0 bg-gradient-to-tr from-brand-700/85 via-brand-600/70 to-purple-600/65" />
          <div className="relative p-5 text-white">
            <div className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 mb-2">
              <Icon name="Megaphone" size={11} />
              <span className="text-[10px] font-bold">라이브 셀러 모집</span>
            </div>
            <h3 className="text-[18px] font-extrabold leading-snug">
              내 팬과 함께
              <br />나만의 샵을 열어보세요
            </h3>
            <p className="mt-1.5 text-[12px] text-white/85 leading-relaxed">
              상품 소싱 걱정 없이, 브랜드 상품을 골라 판매하고 커미션을 받아요.
            </p>
            <div className="mt-3 flex items-center gap-3 text-[11px] text-white/90">
              <span className="flex items-center gap-1"><Icon name="Chart" size={12} /> 판매 커미션</span>
              <span className="flex items-center gap-1"><Icon name="Gift" size={12} /> 추천 수익</span>
              <span className="flex items-center gap-1"><Icon name="Live" size={12} /> 라이브 판매</span>
            </div>
            <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-white text-brand-700 text-[13px] font-bold px-4 py-2">
              라이브 셀러로 신청하기 <Icon name="ChevronDown" size={15} className="-rotate-90" />
            </span>
          </div>
        </Link>
      </section>

      {/* ───── 자주 묻는 질문 ───── */}
      <section className="px-5 pt-8">
        <h2 className="text-[17px] font-extrabold text-gray-900 flex items-center gap-1.5">
          <Icon name="Help" size={18} className="text-brand-500" /> 자주 묻는 질문
        </h2>
        <div className="mt-4">
          <HomeFaq />
        </div>
      </section>

      {/* ───── SNS / 커뮤니티 팔로우 ───── */}
      <section className="px-4 pt-8">
        <div className="rounded-3xl bg-gradient-to-br from-brand-50 to-amber-50 border border-brand-100 p-6 text-center">
          <div className="w-11 h-11 rounded-full bg-brand-500 flex items-center justify-center mx-auto mb-3">
            <Sparkles size={18} className="text-black" />
          </div>
          <h2 className="text-[16px] font-extrabold text-gray-900">바닐라폼와 더 가까이</h2>
          <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">
            새로운 라이브 셀러와 라이브 소식,<br />이벤트를 가장 먼저 받아보세요.
          </p>
          <div className="flex justify-center gap-2.5 mt-4">
            <a href="#" className="inline-flex items-center gap-1.5 rounded-full bg-white text-gray-800 text-[12px] font-bold px-3.5 py-2 ring-1 ring-gray-100 active:scale-95 transition-transform">
              <Instagram size={14} className="text-pink-500" /> 인스타그램
            </a>
            <a href="#" className="inline-flex items-center gap-1.5 rounded-full bg-white text-gray-800 text-[12px] font-bold px-3.5 py-2 ring-1 ring-gray-100 active:scale-95 transition-transform">
              <Youtube size={14} className="text-red-500" /> 유튜브
            </a>
            <a href="#" className="inline-flex items-center gap-1.5 rounded-full bg-[#FEE500] text-[#3C1E1E] text-[12px] font-bold px-3.5 py-2 active:scale-95 transition-transform">
              <Icon name="Message" size={14} /> 카카오채널
            </a>
          </div>
        </div>
      </section>

      {/* ───── 라이브 찾기 진입 ───── */}
      {FEATURE_LIVE && (
        <section className="px-4 pb-9">
          <Link
            href="/live"
            className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 px-5 py-4 active:scale-[0.99] transition-transform"
          >
            <div className="w-9 h-9 rounded-full bg-rose-500 flex items-center justify-center text-white flex-shrink-0">
              <Icon name="Live" size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">라이브 찾기</p>
              <p className="text-[11px] text-gray-500 mt-0.5">라이브 셀러 이름·코드로 진행 중인 라이브를 찾아보세요</p>
            </div>
            <Icon name="ChevronDown" size={18} className="text-rose-300 flex-shrink-0 -rotate-90" />
          </Link>
        </section>
      )}

      {/* ───── 최종 CTA: 지금 바로 시작하세요 (탭: 회원가입 / 셀러로 시작하기) ───── */}
      <HomeStartTabs />

      <div className="h-4" />
    </div>
  );
}

/* ── 다크 배너용 큰 수치 ── */
function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-[24px] font-extrabold text-brand-400 leading-none">{value}</p>
      <p className="text-[11px] text-white/70 mt-1.5">{label}</p>
    </div>
  );
}

/* ── 통계 타일 ── */
function StatTile({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-3.5">
      <p className="text-[22px] font-extrabold text-gray-900 leading-none">{value}</p>
      <p className="text-[12px] font-bold text-gray-700 mt-1.5">{label}</p>
      <p className="text-[10px] text-gray-400">{sub}</p>
    </div>
  );
}

/* ── 혜택 아이콘 매핑 ── */
function BenefitIcon({ type }: { type: string }) {
  const cls16 = { size: 16 };
  switch (type) {
    case "radio": return <Icon name="Live" {...cls16} className="text-rose-500" />;
    case "shield": return <Icon name="Certified" {...cls16} className="text-emerald-500" />;
    case "star": return <Sparkles {...cls16} className="text-yellow-500" />;
    case "zap": return <Icon name="Lightning" {...cls16} className="text-amber-500" />;
    case "trending": return <Icon name="Chart" {...cls16} className="text-blue-500" />;
    case "users": return <Icon name="Users" {...cls16} className="text-violet-500" />;
    case "heart": default: return <Icon name="Wishlist" {...cls16} className="text-pink-500" />;
  }
}

/* ── 혜택 행 ── */
function Benefit({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3">
      <div className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-[13px] font-bold text-gray-900">{title}</p>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

/* ── 소개 통계 카드 ── */
function IntroStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-gray-100 bg-white py-3.5">
      <div className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center">{icon}</div>
      <p className="text-[12px] font-bold text-gray-900">{value}</p>
      <p className="text-[10px] text-gray-400">{label}</p>
    </div>
  );
}

/* ── 브랜드 스토리 스텝 ── */
function StoryStep({ no, icon, title, desc }: { no: number; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3">
      <div className="relative flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center">{icon}</div>
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gray-900 text-white text-[9px] font-bold flex items-center justify-center">
          {no}
        </span>
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-[13px] font-bold text-gray-900">{title}</p>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
