"use client";

import { useState, useEffect, useCallback, useId } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Bell, User, ShoppingBag, Heart, Gift, Share2, X, Play, Clock,
  ChevronRight, ChevronDown, ChevronUp, Eye,
  Loader2, Package, ExternalLink, Copy, CheckCircle,
  Video, BellRing, Pin, Info, ShoppingCart, Store,
} from "lucide-react";

// ─── YouTube 미리보기 URL 파싱 (음소거 자동재생) ───
function getYoutubePreviewUrl(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&?]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/live\/([^?/]+)/,
    /youtube\.com\/embed\/([^?/]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return `https://www.youtube-nocookie.com/embed/${match[1]}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1`;
  }
  return null;
}

// ─── 바닐라 플라워 테마 색상 ───
const HONEY = "#4C8E6B";
const BROWN = "#3D2B1F";
const GOLD = "#D4A017";

// 플라워 패턴 배경 (CSS)
const HONEYCOMB_BG: React.CSSProperties = {
  backgroundColor: "#FFFDF7",
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg width='56' height='100' viewBox='0 0 56 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M28 66L0 50L0 16L28 0L56 16L56 50L28 66L28 100' fill='none' stroke='%23F5A623' stroke-opacity='0.08' stroke-width='2'/%3E%3Cpath d='M28 0L28 34L0 50L0 84L28 100L56 84L56 50L28 34' fill='none' stroke='%23F5A623' stroke-opacity='0.08' stroke-width='2'/%3E%3C/svg%3E\")",
};

// ─── 바닐라 플라워 스티커 (인라인 SVG) ───
function BeeIcon({ size = 18 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" className="inline-block flex-shrink-0">
      <ellipse cx="10.5" cy="7.5" rx="5" ry="4" fill="#CDEBF7" stroke="#3D2B1F" strokeWidth="1.2" />
      <ellipse cx="21.5" cy="7.5" rx="5" ry="4" fill="#E3F4FB" stroke="#3D2B1F" strokeWidth="1.2" />
      <clipPath id={`bee-${id}`}>
        <ellipse cx="16" cy="19" rx="10" ry="8.5" />
      </clipPath>
      <ellipse cx="16" cy="19" rx="10" ry="8.5" fill="#4C8E6B" />
      <g clipPath={`url(#bee-${id})`}>
        <rect x="10" y="9" width="4" height="20" fill="#3D2B1F" />
        <rect x="18" y="9" width="4" height="20" fill="#3D2B1F" />
      </g>
      <ellipse cx="16" cy="19" rx="10" ry="8.5" fill="none" stroke="#3D2B1F" strokeWidth="1.5" />
      <circle cx="13" cy="17.5" r="1.2" fill="#3D2B1F" />
    </svg>
  );
}

// ─── 타입 ───
interface ChannelProduct {
  id: string;
  isActive: boolean;
  sortOrder: number;
  livePrice: number | null;
  product: { id: string; name: string; thumbnail: string | null; basePrice: number; comparePrice: number | null };
}
interface ScheduledLive {
  id: string;
  title: string;
  scheduledAt: string | null;
  shareCode: string;
  thumbnailImage: string | null;
}
interface ChannelCoupon {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  validDays: number;
  minOrderAmount: number | null;
}
interface LiveSiteSettings {
  siteTitle: string;
  liveIntro: string;
  previewImage: string;
  previewImageLink: string;
  previewBgColor: string;
  themeColor: string;
  buttonColor: string;
}

interface ChannelData {
  id: string;
  title: string;
  description: string | null;
  thumbnailImage: string | null;
  status: "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";
  shareCode: string;
  scheduledAt: string | null;
  viewerCount: number;
  peakViewerCount: number;
  likeCount: number;
  isVodSaved: boolean;
  externalUrl: string | null;
  offThumbnailUrl: string | null;
  offLinkUrl: string | null;
  offLinkText: string | null;
  seller: {
    id: string;
    shopName: string;
    shopLogo: string | null;
    shopDescription: string | null;
    slug: string;
    totalFans: number;
    liveSiteSettings: string | null;
    businessType: string | null;
    representativeName: string | null;
    businessRegistrationNo: string | null;
    telecomSalesLicenseNo: string | null;
    businessAddress: string | null;
    businessCategory: string | null;
    _count: { followers: number; liveStreams: number };
  };
  products: ChannelProduct[];
  coupons: ChannelCoupon[];
  scheduledLives: ScheduledLive[];
  noticeCount: number;
  isFollowing: boolean;
  isLoggedIn: boolean;
}
interface Notice {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
}
interface ChannelOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  finalAmount: number;
  createdAt: string;
  items: { id: string; productName: string; variantName: string | null; quantity: number; totalPrice: number }[];
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "결제 대기", PAID: "결제 완료", PREPARING: "상품 준비 중",
  SHIPPED: "배송 중", DELIVERED: "배송 완료", CANCELLED: "취소됨",
  REFUNDED: "환불됨", CONFIRMED: "구매 확정",
};

const formatNum = (n: number) =>
  n >= 10000 ? `${(n / 10000).toFixed(1)}만` : n >= 1000 ? `${(n / 1000).toFixed(1)}천` : n.toLocaleString();

const formatDateTime = (d: string | null) => {
  if (!d) return "일정 미정";
  const dt = new Date(d);
  return dt.toLocaleString("ko-KR", { month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
};

export default function LiveChannelPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string) ?? "";

  const [channel, setChannel] = useState<ChannelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // 모달 상태
  const [showNotices, setShowNotices] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // 공지사항
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [noticesLoading, setNoticesLoading] = useState(false);
  const [unreadNotices, setUnreadNotices] = useState(0);

  // 주문내역
  const [orders, setOrders] = useState<ChannelOrder[] | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersNeedLogin, setOrdersNeedLogin] = useState(false);

  // 예약 알림 (로컬 저장)
  const [alarmSet, setAlarmSet] = useState<Record<string, boolean>>({});

  // 사업자 정보 펼침/닫힘
  const [bizOpen, setBizOpen] = useState(false);

  // 마이페이지 바텀시트
  const [showMyPage, setShowMyPage] = useState(false);
  const [myOverview, setMyOverview] = useState<any>(null);
  const [myOverviewLoading, setMyOverviewLoading] = useState(false);

  // 장바구니 바텀시트
  const [showCart, setShowCart] = useState(false);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [cartFetching, setCartFetching] = useState(false);
  const [cartNeedLogin, setCartNeedLogin] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const fetchChannel = useCallback(async () => {
    try {
      const res = await fetch(`/api/live/${code}/channel`);
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      // 이 셀러의 더 최신 LIVE 방송이 시작됐으면 해당 페이지로 이동
      if (data.channel.activeShareCode) {
        router.replace(`/live/${data.channel.activeShareCode}`);
        return;
      }
      setChannel(data.channel);
      setFollowing(data.channel.isFollowing);
      // 미읽음 공지 수 계산
      try {
        const seen = Number(localStorage.getItem(`sb_notice_seen_${data.channel.seller.id}`) || "0");
        setUnreadNotices(Math.max(0, data.channel.noticeCount - seen));
      } catch { setUnreadNotices(data.channel.noticeCount); }
    } catch {
      setError("채널 정보를 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => { fetchChannel(); }, [fetchChannel]);

  // LIVE 중이면 20초마다 갱신
  useEffect(() => {
    if (channel?.status === "LIVE") {
      const t = setInterval(fetchChannel, 20000);
      return () => clearInterval(t);
    }
  }, [channel?.status, fetchChannel]);

  // 예약 알림 로컬 상태 로드
  useEffect(() => {
    if (!channel) return;
    try {
      const map: Record<string, boolean> = {};
      const all = [...channel.scheduledLives.map(l => l.id), channel.id];
      all.forEach(id => { map[id] = localStorage.getItem(`sb_live_alarm_${id}`) === "1"; });
      setAlarmSet(map);
    } catch {}
  }, [channel]);

  // 마이페이지 개요 조회 (마이페이지 시트 열릴 때)
  useEffect(() => {
    if (!showMyPage) return;
    setMyOverviewLoading(true);
    fetch("/api/my/overview")
      .then(r => r.json())
      .then(d => { if (!d.error) setMyOverview(d); })
      .catch(() => {})
      .finally(() => setMyOverviewLoading(false));
  }, [showMyPage]);

  // ─── 핸들러 ───
  const handleFollow = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    try {
      const res = await fetch(`/api/live/${code}/follow`, { method: "POST" });
      if (res.status === 401) {
        showToast("로그인이 필요합니다");
        setTimeout(() => router.push(`/auth/login?callbackUrl=/live/${code}`), 800);
        return;
      }
      const data = await res.json();
      if (data.error) { showToast(data.error); return; }
      setFollowing(data.following);
      showToast(data.following ? "채널을 찜했어요!" : "찜을 해제했어요");
    } catch {
      showToast("잠시 후 다시 시도해주세요");
    } finally {
      setFollowLoading(false);
    }
  };

  const openNotices = async () => {
    setShowNotices(true);
    if (channel) {
      try { localStorage.setItem(`sb_notice_seen_${channel.seller.id}`, String(channel.noticeCount)); } catch {}
      setUnreadNotices(0);
    }
    if (notices) return;
    setNoticesLoading(true);
    try {
      const res = await fetch(`/api/live/${code}/notices`);
      const data = await res.json();
      setNotices(data.notices || []);
    } catch { setNotices([]); }
    finally { setNoticesLoading(false); }
  };

  const openOrders = async () => {
    setShowOrders(true);
    setOrdersLoading(true);
    setOrdersNeedLogin(false);
    try {
      const res = await fetch(`/api/live/${code}/orders`);
      if (res.status === 401) { setOrdersNeedLogin(true); return; }
      const data = await res.json();
      setOrders(data.orders || []);
    } catch { setOrders([]); }
    finally { setOrdersLoading(false); }
  };

  const handleCopyUrl = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    navigator.clipboard.writeText(url)
      .then(() => { setShowShare(false); showToast("채널 링크가 복사되었습니다!"); })
      .catch(() => showToast("링크 복사에 실패했습니다"));
  };

  const handleNativeShare = () => {
    if (navigator.share && channel) {
      navigator.share({ title: `${channel.seller.shopName} 라이브 채널`, url: window.location.href }).catch(() => {});
    }
    setShowShare(false);
  };

  const toggleAlarm = (liveId: string, title: string) => {
    const next = !alarmSet[liveId];
    setAlarmSet(prev => ({ ...prev, [liveId]: next }));
    try { localStorage.setItem(`sb_live_alarm_${liveId}`, next ? "1" : "0"); } catch {}
    showToast(next ? `'${title}' 방송 알림을 신청했어요!` : "방송 알림을 해제했어요");
  };

  const openCart = async () => {
    setShowCart(true);
    setCartFetching(true);
    setCartNeedLogin(false);
    try {
      const res = await fetch('/api/cart');
      if (res.status === 401) { setCartNeedLogin(true); return; }
      const data = await res.json();
      setCartItems(data.items || []);
    } catch { setCartItems([]); }
    finally { setCartFetching(false); }
  };

  // ─── 로딩/에러 ───
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={HONEYCOMB_BG}>
        <div className="text-center">
          <img
            src="/favicon.svg"
            alt="로딩"
            className="w-16 h-16 mx-auto mb-3 animate-bounce"
            style={{ objectFit: "contain" }}
          />
          <p className="text-sm font-medium" style={{ color: GOLD }}>채널을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !channel) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={HONEYCOMB_BG}>
        <Image src="/favicon.svg" alt="bee" width={96} height={96} className="w-24 h-24 object-contain" />
        <p className="text-lg font-bold mt-4" style={{ color: BROWN }}>채널을 찾을 수 없어요</p>
        <p className="text-sm text-gray-400 mt-1">{error || "잘못된 주소이거나 삭제된 채널입니다."}</p>
        <Link href="/live" className="mt-6 px-6 py-2.5 rounded-full text-sm font-bold shadow-sm" style={{ backgroundColor: HONEY, color: BROWN }}>
          라이브 홈으로
        </Link>
      </div>
    );
  }

  const isLive = channel.status === "LIVE";
  const isScheduled = channel.status === "SCHEDULED";
  const isOff = channel.status === "ENDED" || channel.status === "CANCELLED";
  const mainThumbnail = isOff
    ? (channel.offThumbnailUrl || channel.thumbnailImage)
    : channel.thumbnailImage;

  // 사이트 설정 파싱
  const siteSettings: LiveSiteSettings = (() => {
    const defaults: LiveSiteSettings = {
      siteTitle: "", liveIntro: "", previewImage: "",
      previewImageLink: "", previewBgColor: "#1a0a00",
      themeColor: "#4C8E6B", buttonColor: "#4C8E6B",
    };
    if (!channel.seller.liveSiteSettings) return defaults;
    try { return { ...defaults, ...JSON.parse(channel.seller.liveSiteSettings) }; }
    catch { return defaults; }
  })();
  const THEME = siteSettings.themeColor || HONEY;
  const BTN_COLOR = siteSettings.buttonColor || HONEY;
  const watchUrl = `/live/${code}/watch`;
  const specialProducts = channel.products.filter(
    p => p.livePrice !== null && p.livePrice < p.product.basePrice
  );
  const coupons = channel.coupons || [];
  const hasEvents = specialProducts.length > 0 || coupons.length > 0 || !!channel.offLinkUrl;

  // ─── 우측 아이콘 메뉴 정의 ───
  const iconMenu: { key: string; label: string; icon?: any; imgSrc?: string; badge?: number; filled?: boolean; onClick: () => void }[] = [
    { key: "notice", label: "공지사항", imgSrc: "/icons/Notification_icon.png", badge: unreadNotices, onClick: openNotices },
    { key: "me", label: "마이페이지", icon: User, onClick: () => setShowMyPage(true) },
    { key: "orders", label: "주문내역", imgSrc: "/icons/OrderManagement_icon.png", onClick: openOrders },
    { key: "cart", label: "장바구니", icon: ShoppingCart, onClick: openCart },
    { key: "event", label: "이벤트", imgSrc: "/icons/Benefits_icon.png", onClick: () => setShowEvents(true) },
    { key: "share", label: "공유하기", imgSrc: "/icons/ShareLink_icon.png", onClick: () => setShowShare(true) },
  ];

  return (
    <div
      className="min-h-screen"
      style={{
        ...HONEYCOMB_BG,
        ["--theme-color" as any]: THEME,
        ["--btn-color" as any]: BTN_COLOR,
      }}
    >
      <div className="max-w-[480px] mx-auto min-h-screen flex flex-col bg-white/60 shadow-[0_0_24px_rgba(212,160,23,0.08)]">

        {/* ═══ 상단 헤더 ═══ */}
        <header className="bg-white/85 backdrop-blur-sm border-b-2 border-amber-100 sticky top-0 z-30">
          {/* 메인 행: 프로필 + 셀러명 + Pick 버튼 */}
          <div className="px-4 py-2 h-12 flex items-center gap-3">
            <Link href={`/shop/${channel.seller.slug}`} className="flex-shrink-0">
              {channel.seller.shopLogo ? (
                <img src={channel.seller.shopLogo} alt={channel.seller.shopName} className="w-9 h-9 rounded-full object-cover ring-2 ring-offset-1" style={{ ["--tw-ring-color" as any]: HONEY }} />
              ) : (
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-extrabold ring-2 ring-offset-1" style={{ backgroundColor: "#FDEBC8", color: BROWN, ["--tw-ring-color" as any]: HONEY }}>
                  {channel.seller.shopName.charAt(0)}
                </div>
              )}
            </Link>
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <h1 className="text-[15px] font-extrabold truncate" style={{ color: BROWN }}>{channel.seller.shopName}</h1>
              {isLive && (
                <span className="flex-shrink-0 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ backgroundColor: "#ff3b5c" }}>
                  <span className="w-1 h-1 bg-white rounded-full animate-pulse" /> LIVE
                </span>
              )}
              {isOff && (
                <span className="flex-shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">• OFF</span>
              )}
            </div>
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold transition-all shadow-sm ${following ? "bg-amber-50 border border-amber-200" : ""}`}
              style={following ? { color: GOLD } : { backgroundColor: HONEY, color: BROWN }}
            >
              {followLoading ? <Loader2 size={14} className="animate-spin" /> : following ? "Pick 완료" : "+ Pick"}
            </button>
          </div>
          {/* 방송 제목 별도 줄 */}
          <div className="px-4 py-1 text-[11px] text-gray-500 bg-amber-50/60 border-t border-amber-100 truncate text-center">
            {channel.title}
          </div>
        </header>

        {/* ═══ 메인 영역 + 우측 아이콘 메뉴 ═══ */}
        {/* 모바일: flex row (preview + icons 나란히) / PC: relative block (icons 프레임 바깥 우측) */}
        <div className="relative flex gap-2.5 px-3 pt-3 items-start lg:block lg:px-3 lg:pt-3">
          {/* 메인 영역 */}
          <div className="flex-1 min-w-0 lg:flex-none lg:w-full">
            <div className="relative rounded-2xl overflow-hidden border-2 border-amber-100 bg-white shadow-sm aspect-[3/4]">
              {/* 배경: 사이트 설정 배경색 or 기본 amber 계열 */}
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={siteSettings.previewBgColor
                  ? { backgroundColor: siteSettings.previewBgColor }
                  : { background: "linear-gradient(160deg,#FFF3D6 0%,#FFE9B8 100%)" }
                }
              >
                {siteSettings.previewImage ? (
                  siteSettings.previewImageLink ? (
                    <a href={siteSettings.previewImageLink} target="_blank" rel="noopener noreferrer" className="absolute inset-0">
                      <img src={siteSettings.previewImage} alt="" className="w-full h-full object-cover" />
                    </a>
                  ) : (
                    <img src={siteSettings.previewImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  )
                ) : !isLive ? (
                  /* TV 스태틱 노이즈 — 방송 대기 중 */
                  <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: "#0d0d0d" }}>
                    {/* 흑백 노이즈 레이어 (메인, 빠른 깜빡임) */}
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")`,
                        backgroundSize: "150px 150px",
                        animation: "staticNoise 0.18s steps(1) infinite",
                        opacity: 0.92,
                      }}
                    />
                    {/* 노이즈 레이어 2 (거친 노이즈, 느린 주기) */}
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n2'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n2)'/%3E%3C/svg%3E")`,
                        backgroundSize: "220px 220px",
                        animation: "staticNoise2 0.32s steps(1) infinite",
                        opacity: 0.28,
                        mixBlendMode: "overlay",
                      }}
                    />
                    {/* 스캔라인 오버레이 */}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.28) 2px, rgba(0,0,0,0.28) 4px)",
                        zIndex: 1,
                      }}
                    />
                    {/* 비네트 */}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, rgba(0,0,0,0.9) 100%)",
                        zIndex: 2,
                      }}
                    />
                    {/* 대기 텍스트 */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5" style={{ zIndex: 3 }}>
                      <div
                        className="font-mono text-[12px] font-bold tracking-[0.4em]"
                        style={{ color: "#4C8E6B", animation: "tvBlink 1.4s step-end infinite" }}
                      >
                        ● 방송 대기 중
                      </div>
                      <div className="font-mono text-[9px] tracking-[0.5em] opacity-50" style={{ color: "#4C8E6B" }}>
                        STANDBY
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-black" />
                )}
              </div>

              {/* LIVE 유튜브 미리보기 (음소거 자동재생) */}
              {isLive && channel.externalUrl && (() => {
                const previewUrl = getYoutubePreviewUrl(channel.externalUrl!);
                return previewUrl ? (
                  <iframe
                    src={previewUrl}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    title={channel.title}
                    style={{ border: "none", pointerEvents: "none" }}
                  />
                ) : null;
              })()}

              {/* LIVE 방송 중 */}
              {isLive && (
                <button onClick={() => router.push(watchUrl)} className="absolute inset-0 text-left">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
                  <div className="absolute top-3 left-3 flex items-center rounded-full overflow-hidden shadow-lg">
                    <span className="text-white text-[10px] font-bold px-2.5 py-1 flex items-center gap-1" style={{ backgroundColor: "#ff3b5c" }}>
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
                    </span>
                    <span className="bg-black/60 text-white text-[10px] px-2 py-1 flex items-center gap-1">
                      <Eye size={10} /> {formatNum(channel.viewerCount)}
                    </span>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="flex items-center gap-2 px-5 py-3 rounded-full font-extrabold text-[14px] shadow-xl animate-pulse-slow" style={{ backgroundColor: HONEY, color: BROWN }}>
                      <Play size={16} fill={BROWN} /> 지금 시청하기
                    </span>
                  </div>
                </button>
              )}

              {/* 예약된 방송 */}
              {isScheduled && (
                <div className="absolute inset-0">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />
                  <span className="absolute top-3 left-3 text-white text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-500/90 shadow flex items-center gap-1">
                    <Clock size={10} /> 방송 예정
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-4 text-center">
                    <p className="text-white/80 text-[11px] font-medium">{formatDateTime(channel.scheduledAt)}</p>
                    <p className="text-white text-[14px] font-extrabold mt-1 line-clamp-2">{channel.title}</p>
                    <button
                      onClick={() => toggleAlarm(channel.id, channel.title)}
                      className={`mt-3 w-full py-2.5 rounded-full text-[12px] font-bold flex items-center justify-center gap-1.5 shadow-lg transition-all ${alarmSet[channel.id] ? "bg-white/20 text-white backdrop-blur" : ""}`}
                      style={!alarmSet[channel.id] ? { backgroundColor: HONEY, color: BROWN } : {}}
                    >
                      {alarmSet[channel.id] ? <><BellRing size={13} /> 알림 신청 완료</> : <><Bell size={13} /> 예약 알림 설정</>}
                    </button>
                  </div>
                </div>
              )}

              {/* 방송 종료 (OFF) */}
              {isOff && (
                <div className="absolute inset-0">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                  <span className="absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-full bg-black/50 text-white/80 backdrop-blur">• OFF</span>
                  <div className="absolute inset-x-0 bottom-0 p-3 space-y-2">
                    {channel.isVodSaved && (
                      <button
                        onClick={() => router.push(watchUrl)}
                        className="w-full py-2.5 rounded-full text-[12px] font-bold bg-white/15 text-white backdrop-blur flex items-center justify-center gap-1.5 border border-white/25"
                      >
                        <Video size={13} /> 지난 방송 다시보기
                      </button>
                    )}
                    {channel.offLinkUrl && (
                      <a
                        href={channel.offLinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 rounded-full text-[13px] font-extrabold flex items-center justify-center gap-1.5 shadow-lg"
                        style={{ backgroundColor: HONEY, color: BROWN }}
                      >
                        <ExternalLink size={14} /> {channel.offLinkText || "자세히 보기"}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 모바일 전용: 우측 세로 아이콘 메뉴 (flex row 안에서) */}
          <div className="w-[52px] flex-shrink-0 flex flex-col items-center gap-3 pt-1 sticky top-0 lg:hidden">
            {iconMenu.map(item => (
              <button key={item.key} onClick={item.onClick} className="flex flex-col items-center gap-1 group">
                <span className="relative w-11 h-11 rounded-full flex items-center justify-center shadow-sm border border-amber-200 transition-transform group-active:scale-90" style={{ background: "linear-gradient(160deg,#F7B733 0%,#D4A017 100%)" }}>
                  {item.imgSrc
                    ? <img src={item.imgSrc} className={`w-[18px] h-[18px] object-contain${item.filled ? "" : " opacity-90"}`} alt="" />
                    : item.icon && <item.icon size={18} className="text-white" fill={item.filled ? "white" : "none"} />
                  }
                  {!!item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border border-white">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </span>
                <span className="text-[9px] font-bold" style={{ color: BROWN }}>{item.label}</span>
              </button>
            ))}
          </div>

          {/* PC 전용: 스크롤해도 화면 우측 고정 */}
          <div className="hidden lg:flex flex-col items-center gap-3 fixed z-40"
            style={{ left: "calc(50% + 248px)", top: "50%", transform: "translateY(-50%)" }}>
            {iconMenu.map(item => (
              <button key={item.key} onClick={item.onClick} className="flex flex-col items-center gap-1 group">
                <span className="relative w-11 h-11 rounded-full flex items-center justify-center shadow-sm border border-amber-200 transition-transform group-active:scale-90" style={{ background: "linear-gradient(160deg,#F7B733 0%,#D4A017 100%)" }}>
                  {item.imgSrc
                    ? <img src={item.imgSrc} className={`w-[18px] h-[18px] object-contain${item.filled ? "" : " opacity-90"}`} alt="" />
                    : item.icon && <item.icon size={18} className="text-white" fill={item.filled ? "white" : "none"} />
                  }
                  {!!item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border border-white">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </span>
                <span className="text-[9px] font-bold" style={{ color: BROWN }}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ═══ 방송 소개 ═══ */}
        <section className="mx-3 mt-3 bg-white rounded-2xl border border-amber-100 p-4">
          <h2 className="flex items-center gap-1.5 text-[13px] font-extrabold mb-2" style={{ color: BROWN }}>
            <img src="/icons/Broadcast_icon.png" className="w-4 h-4 object-contain" alt="" /> 방송 소개
          </h2>
          <p className={`text-[12.5px] leading-relaxed text-gray-600 whitespace-pre-wrap ${descExpanded ? "" : "line-clamp-3"}`}>
            {(isLive && siteSettings.liveIntro) || channel.description || channel.seller.shopDescription || `${channel.seller.shopName} 채널에 오신 것을 환영합니다! 달콤한 혜택 가득한 라이브 방송을 만나보세요.`}
          </p>
          {(channel.description || channel.seller.shopDescription || "").length > 60 && (
            <button onClick={() => setDescExpanded(!descExpanded)} className="mt-1.5 text-[11px] font-bold flex items-center gap-0.5" style={{ color: GOLD }}>
              {descExpanded ? <>접기 <ChevronUp size={12} /></> : <>더보기 <ChevronDown size={12} /></>}
            </button>
          )}
        </section>

        {/* ═══ 예약된 라이브 ═══ */}
        <section className="mx-3 mt-3 bg-white rounded-2xl border border-amber-100 p-4">
          <h2 className="flex items-center gap-1.5 text-[13px] font-extrabold mb-3" style={{ color: BROWN }}>
            <img src="/icons/ScheduleLive_icon.png" alt="예약 라이브" className="w-5 h-5 object-contain" /> 예약된 라이브
          </h2>
          {channel.scheduledLives.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-[12px] text-gray-400">아직 예약된 라이브가 없어요</p>
              <p className="text-[11px] text-gray-300 mt-0.5">채널을 팔로우하고 새 방송 소식을 받아보세요!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {channel.scheduledLives.map(sl => {
                const d = sl.scheduledAt ? new Date(sl.scheduledAt) : null;
                return (
                  <div key={sl.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-amber-100 bg-gradient-to-r from-amber-50/80 to-white">
                    <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 border border-amber-200" style={{ backgroundColor: "#FDEBC8" }}>
                      {d ? (
                        <>
                          <span className="text-[9px] font-bold" style={{ color: GOLD }}>{d.getMonth() + 1}월</span>
                          <span className="text-[16px] font-extrabold leading-none" style={{ color: BROWN }}>{d.getDate()}</span>
                        </>
                      ) : (
                        <img src="/icons/Calendar_icon.png" alt="" className="w-6 h-6 object-contain opacity-50" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-bold truncate" style={{ color: BROWN }}>{sl.title}</p>
                      <p className="text-[10.5px] text-gray-400 mt-0.5 flex items-center gap-1">
                        <Clock size={10} />
                        {d ? d.toLocaleString("ko-KR", { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "일정 미정"}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleAlarm(sl.id, sl.title)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all border ${alarmSet[sl.id] ? "bg-amber-50 border-amber-200" : "border-transparent shadow-sm"}`}
                      style={alarmSet[sl.id] ? { color: GOLD } : { backgroundColor: HONEY, color: BROWN }}
                    >
                      {alarmSet[sl.id] ? <><BellRing size={11} /> 신청됨</> : <><Bell size={11} /> 알림 신청</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ═══ 라이브 상품 미리보기 ═══ */}
        <section className="mx-3 mt-3 mb-4 bg-white rounded-2xl border border-amber-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-1.5 text-[13px] font-extrabold" style={{ color: BROWN }}>
              <img src="/icons/LiveProductShowcase_icon.png" className="w-4 h-4 object-contain" alt="" /> 라이브 상품 미리보기
            </h2>
            <span className="text-[11px] font-bold" style={{ color: GOLD }}>{channel.products.length}개</span>
          </div>
          {channel.products.length === 0 ? (
            <div className="py-6 text-center">
              <BeeIcon size={30} />
              <p className="text-[12px] text-gray-400 mt-2">준비 중인 상품이 없어요</p>
            </div>
          ) : (
            <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
              {channel.products.map(lp => {
                const price = lp.livePrice ?? lp.product.basePrice;
                const dp = lp.livePrice && lp.product.basePrice > lp.livePrice
                  ? Math.round(((lp.product.basePrice - lp.livePrice) / lp.product.basePrice) * 100)
                  : 0;
                return (
                  <Link key={lp.id} href={`/products/${lp.product.id}`} className="w-[124px] flex-shrink-0">
                    <div className="relative w-[124px] h-[124px] rounded-xl overflow-hidden border border-amber-100 bg-amber-50">
                      {lp.product.thumbnail ? (
                        <img src={lp.product.thumbnail} alt={lp.product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Package size={24} className="text-amber-200" /></div>
                      )}
                      {lp.isActive && isLive && (
                        <span className="absolute top-1.5 left-1.5 text-white text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#ff3b5c" }}>LIVE</span>
                      )}
                      {dp > 0 && (
                        <span className="absolute bottom-1.5 right-1.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shadow" style={{ backgroundColor: HONEY, color: BROWN }}>{dp}%</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-600 line-clamp-2 mt-1.5 leading-snug">{lp.product.name}</p>
                    <p className="text-[12.5px] font-extrabold mt-0.5" style={{ color: BROWN }}>
                      {price.toLocaleString()}<span className="text-[10px] font-bold">원</span>
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* ═══ 사업자 정보 ═══ */}
        <footer className="mx-3 mt-3 mb-24 bg-white rounded-2xl border border-amber-100 p-4 space-y-3">
          {/* 판매자 정보 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Store size={13} className="text-gray-400" />
              <span className="text-[11px] font-bold text-gray-500">판매자 정보</span>
              <span className="text-[9px] text-gray-300">
                {channel.seller.businessType === "business" ? "사업자 판매자" : "개인 판매자"}
              </span>
            </div>
            {channel.seller.businessType === "business" ? (
              <div className="space-y-1">
                {([
                  { label: "상호", value: channel.seller.shopName },
                  channel.seller.representativeName ? { label: "대표자", value: channel.seller.representativeName } : null,
                  channel.seller.businessRegistrationNo ? { label: "사업자등록번호", value: channel.seller.businessRegistrationNo } : null,
                  channel.seller.telecomSalesLicenseNo ? { label: "통신판매업신고", value: channel.seller.telecomSalesLicenseNo } : null,
                  channel.seller.businessCategory ? { label: "업종/업태", value: channel.seller.businessCategory } : null,
                  channel.seller.businessAddress ? { label: "주소", value: channel.seller.businessAddress } : null,
                ] as ({ label: string; value: string } | null)[]).filter(Boolean).map((r) => (
                  <p key={r!.label} className="text-[10px] text-gray-500 leading-relaxed">
                    <span className="text-gray-400">{r!.label}</span>
                    <span className="mx-1.5 text-gray-300">·</span>
                    <span className="text-gray-600">{r!.value}</span>
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-gray-500">개인판매자</p>
            )}
          </div>

          {/* 바닐라폼 통신판매중개업 안내 */}
          <div className="rounded-xl bg-amber-50/60 border border-amber-100 overflow-hidden">
            <button
              type="button"
              onClick={() => setBizOpen(v => !v)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
            >
              <Info size={13} className="text-gray-400 flex-shrink-0" />
              <span className="flex-1 text-[10.5px] text-gray-500 leading-snug">
                <b className="text-gray-600 font-semibold">바닐라폼는 통신판매중개자</b>이며 거래의 당사자가 아닙니다.
              </span>
              <span className="text-[9px] text-gray-400 flex items-center gap-0.5 flex-shrink-0">
                자세히 보기
                <ChevronDown size={12} className={`transition-transform ${bizOpen ? "rotate-180" : ""}`} />
              </span>
            </button>
            {bizOpen && (
              <div className="px-3 pb-3 pt-0.5 border-t border-amber-100">
                <p className="text-[10px] text-gray-500 leading-relaxed mt-2">
                  바닐라폼는 통신판매중개자로서 통신판매의 당사자가 아니며, 상품의 주문·배송·환불 등 거래에 대한
                  의무와 책임은 판매자(라이브 셀러)에게 있습니다. 바닐라폼는 거래 시스템(플랫폼)을 제공할 뿐 개별 거래에 대해서는
                  책임을 지지 않습니다.
                </p>
                <div className="mt-3 pt-3 border-t border-amber-100 space-y-0.5 text-[10px] text-gray-400 leading-relaxed">
                  <p className="font-semibold text-gray-500 mb-1">통신판매중개자 정보</p>
                  <p><span className="text-gray-400">운영사</span> 바닐라폼 · 사업자 정보 준비 중</p>
                  <p><span className="text-gray-400">사업자등록번호</span> 662-86-02270</p>
                  <p><span className="text-gray-400">통신판매신고번호</span> 2022-고양일산서-0400</p>
                  <p><span className="text-gray-400">대표번호</span> 070-4158-2540</p>
                  <p><span className="text-gray-400">주소</span> 경기도 고양시 일산서구 킨텍스로 240, 2501호</p>
                </div>
              </div>
            )}
          </div>

          <p className="text-[10px] text-gray-400 text-center pt-1">
            &copy; {new Date().getFullYear()} VanillaForm. All rights reserved.
          </p>
        </footer>
      </div>

      {/* 하단 고정: 셀러샵 바로가기 버튼 (스크롤해도 항상 보임) */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        <div className="mx-auto max-w-[480px] px-4 py-3 bg-white/95 backdrop-blur-sm border-t border-amber-100 shadow-[0_-4px_20px_rgba(212,160,23,0.12)]"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <Link
            href={`/shop/${channel.seller.slug}`}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-full text-[13px] font-bold shadow-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: BTN_COLOR, color: BROWN }}
          >
            <img src="/icons/ShopManagement_icon.png" className="w-4 h-4 object-contain" alt="" />
            {channel.seller.shopName} 셀러샵 바로가기
            <ChevronRight size={14} style={{ color: BROWN }} />
          </Link>
        </div>
      </div>

      {/* ═══ 공지사항 모달 ═══ */}
      <BottomSheet isOpen={showNotices} title="공지사항" icon={<Bell size={15} style={{ color: GOLD }} />} onClose={() => setShowNotices(false)}>
        {noticesLoading ? (
          <SheetLoading />
        ) : !notices || notices.length === 0 ? (
          <SheetEmpty message="등록된 공지사항이 없어요" />
        ) : (
          <div className="space-y-2.5">
            {notices.map(n => (
              <div key={n.id} className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/50">
                <div className="flex items-center gap-1.5">
                  {n.isPinned && (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: HONEY, color: BROWN }}>
                      <Pin size={9} /> 고정
                    </span>
                  )}
                  <p className="text-[13px] font-bold flex-1 min-w-0 truncate" style={{ color: BROWN }}>{n.title}</p>
                </div>
                <p className="text-[12px] text-gray-500 mt-1.5 whitespace-pre-wrap leading-relaxed">{n.content}</p>
                <p className="text-[10px] text-gray-300 mt-2">{new Date(n.createdAt).toLocaleDateString("ko-KR")}</p>
              </div>
            ))}
          </div>
        )}
      </BottomSheet>

      {/* ═══ 주문내역 모달 ═══ */}
      <BottomSheet isOpen={showOrders} title="이 채널 주문내역" icon={<ShoppingBag size={15} style={{ color: GOLD }} />} onClose={() => setShowOrders(false)}>
        {ordersLoading ? (
          <SheetLoading />
        ) : ordersNeedLogin ? (
          <div className="py-8 text-center">
            <User size={34} className="text-amber-300 mx-auto" />
            <p className="text-[13px] font-bold mt-3" style={{ color: BROWN }}>로그인이 필요해요</p>
            <p className="text-[11px] text-gray-400 mt-1">로그인하고 주문 내역을 확인해보세요</p>
            <Link href={`/auth/login?callbackUrl=/live/${code}`} className="inline-block mt-4 px-6 py-2.5 rounded-full text-[12px] font-bold shadow-sm" style={{ backgroundColor: HONEY, color: BROWN }}>
              로그인 하러가기
            </Link>
          </div>
        ) : !orders || orders.length === 0 ? (
          <SheetEmpty message="이 채널에서 주문한 내역이 없어요" />
        ) : (
          <div className="space-y-2.5">
            {orders.map(o => (
              <Link key={o.id} href={`/my/orders`} className="block p-3.5 rounded-xl border border-amber-100 bg-white hover:bg-amber-50/50 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">{new Date(o.createdAt).toLocaleDateString("ko-KR")} · {o.orderNumber}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50" style={{ color: GOLD }}>
                    {ORDER_STATUS_LABEL[o.status] || o.status}
                  </span>
                </div>
                <p className="text-[12.5px] font-bold mt-1.5 truncate" style={{ color: BROWN }}>
                  {o.items[0]?.productName}
                  {o.items.length > 1 && <span className="text-gray-400 font-medium"> 외 {o.items.length - 1}건</span>}
                </p>
                <p className="text-[13px] font-extrabold mt-1" style={{ color: BROWN }}>{o.finalAmount.toLocaleString()}원</p>
              </Link>
            ))}
          </div>
        )}
      </BottomSheet>

      {/* ═══ 이벤트/쿠폰 모달 ═══ */}
      <BottomSheet isOpen={showEvents} title="이벤트 & 혜택" icon={<Gift size={15} style={{ color: GOLD }} />} onClose={() => setShowEvents(false)}>
        {!hasEvents ? (
          <SheetEmpty message="진행 중인 이벤트가 없어요" sub="라이브 방송 중 특별 혜택이 공개될 수 있어요!" />
        ) : (
          <div className="space-y-2.5">
            {coupons.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-3.5 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/60">
                <span className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(160deg,#F7B733,#D4A017)" }}>
                  <Gift size={17} className="text-white" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-extrabold" style={{ color: BROWN }}>
                    {c.discountType === "PERCENT" ? `${c.discountValue}% 할인` : `${c.discountValue.toLocaleString()}원 할인`}
                  </p>
                  <p className="text-[10.5px] text-gray-400 mt-0.5">
                    쿠폰코드 <b style={{ color: GOLD }}>{c.code}</b>
                    {c.minOrderAmount ? ` · ${c.minOrderAmount.toLocaleString()}원 이상 구매 시` : ""}
                  </p>
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(c.code).then(() => showToast("쿠폰코드가 복사되었어요!")).catch(() => {}); }}
                  className="text-[10px] font-bold px-2.5 py-1.5 rounded-full flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: HONEY, color: BROWN }}
                >
                  코드 복사
                </button>
              </div>
            ))}
            {channel.offLinkUrl && (
              <a href={channel.offLinkUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3.5 rounded-xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-white">
                <span className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(160deg,#F7B733,#D4A017)" }}>
                  <Gift size={17} className="text-white" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-extrabold" style={{ color: BROWN }}>{channel.offLinkText || "이벤트 바로가기"}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">채널 이벤트를 확인해보세요</p>
                </div>
                <ExternalLink size={14} style={{ color: GOLD }} />
              </a>
            )}
            {specialProducts.map(lp => {
              const dp = Math.round(((lp.product.basePrice - (lp.livePrice as number)) / lp.product.basePrice) * 100);
              return (
                <Link key={lp.id} href={`/products/${lp.product.id}`} className="flex items-center gap-3 p-3 rounded-xl border border-amber-100 bg-white">
                  {lp.product.thumbnail ? (
                    <img src={lp.product.thumbnail} alt="" className="w-12 h-12 rounded-lg object-cover border border-amber-100 flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0"><Package size={16} className="text-amber-200" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11.5px] text-gray-600 truncate">{lp.product.name}</p>
                    <p className="text-[13px] font-extrabold mt-0.5" style={{ color: BROWN }}>
                      <span className="mr-1" style={{ color: "#ff3b5c" }}>{dp}%</span>
                      {(lp.livePrice as number).toLocaleString()}원
                    </p>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ backgroundColor: HONEY, color: BROWN }}>라이브 특가</span>
                </Link>
              );
            })}
          </div>
        )}
      </BottomSheet>

      {/* ═══ 공유 모달 ═══ */}
      <BottomSheet isOpen={showShare} title="채널 공유하기" icon={<Share2 size={15} style={{ color: GOLD }} />} onClose={() => setShowShare(false)}>
        <div className="text-center pb-2">
          <div className="w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(245,166,35,0.12)" }}>
            <Share2 size={22} style={{ color: GOLD }} />
          </div>
          <p className="text-[12px] text-gray-400 mb-4">라이브 채널을 친구에게 알려주세요!</p>
          <div className="bg-amber-50 rounded-xl p-3 flex items-center gap-2 mb-3 border border-amber-100">
            <span className="flex-1 text-[11px] text-gray-500 truncate text-left">{typeof window !== "undefined" ? window.location.href : ""}</span>
            <button onClick={handleCopyUrl} className="flex-shrink-0 px-3 py-1.5 text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-sm" style={{ backgroundColor: HONEY, color: BROWN }}>
              <Copy size={11} /> 복사
            </button>
          </div>
          {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
            <button onClick={handleNativeShare} className="w-full py-3 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2" style={{ backgroundColor: BROWN }}>
              <Share2 size={14} /> 다른 앱으로 공유
            </button>
          )}
        </div>
      </BottomSheet>

      {/* ═══ 마이페이지 바텀시트 ═══ */}
      <BottomSheet isOpen={showMyPage} title="마이페이지" icon={<User size={15} style={{ color: GOLD }} />} onClose={() => setShowMyPage(false)} maxHeight="85vh">
        {!channel.isLoggedIn ? (
          <div className="py-8 text-center">
            <User size={34} className="text-amber-300 mx-auto" />
            <p className="text-[13px] font-bold mt-3" style={{ color: BROWN }}>로그인이 필요해요</p>
            <p className="text-[11px] text-gray-400 mt-1">로그인 후 마이페이지를 이용해보세요</p>
            <Link
              href={`/auth/login?callbackUrl=/live/${code}`}
              className="inline-block mt-4 px-6 py-2.5 rounded-full text-[12px] font-bold shadow-sm"
              style={{ backgroundColor: HONEY, color: BROWN }}
            >
              로그인 하러가기
            </Link>
          </div>
        ) : myOverviewLoading ? (
          <SheetLoading />
        ) : myOverview ? (
          <div className="space-y-4 pb-2">
            {/* 프로필 */}
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50/60 border border-amber-100">
              <div className="w-12 h-12 rounded-full bg-amber-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                {myOverview.user.avatar ? (
                  <img src={myOverview.user.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-[18px] font-bold" style={{ color: BROWN }}>{myOverview.user.name.charAt(0)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-extrabold" style={{ color: BROWN }}>{myOverview.user.name}</p>
                {myOverview.user.email && !myOverview.user.email.endsWith("@no-email.local") && (
                  <p className="text-[11px] text-gray-400 truncate">{myOverview.user.email}</p>
                )}
              </div>
              <Link href="/my/settings" onClick={() => setShowMyPage(false)} className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <ChevronRight size={14} style={{ color: BROWN }} />
              </Link>
            </div>
            {/* 요약 수치 */}
            <div className="grid grid-cols-4 gap-2">
              {([
                { label: "주문", count: myOverview.counts.orders, href: "/my/orders" },
                { label: "리뷰", count: myOverview.counts.reviews, href: "/my/reviews" },
                { label: "찜", count: myOverview.counts.wishlists, href: "/my/wishlist" },
                { label: "장바구니", count: myOverview.counts.cartItems, href: "/cart" },
              ] as { label: string; count: number; href: string }[]).map(item => (
                <Link key={item.label} href={item.href} onClick={() => setShowMyPage(false)} className="flex flex-col items-center p-3 rounded-xl bg-white border border-amber-100">
                  <span className="text-[16px] font-extrabold" style={{ color: BROWN }}>{item.count}</span>
                  <span className="text-[10px] text-gray-400 mt-0.5 text-center leading-tight">{item.label}</span>
                </Link>
              ))}
            </div>
            {/* 바로가기 메뉴 */}
            <div className="grid grid-cols-2 gap-2">
              {([
                { label: "주문내역", href: "/my/orders", Icon: Package },
                { label: "장바구니", href: "/cart", Icon: ShoppingCart },
                { label: "찜한 상품", href: "/my/wishlist", Icon: Heart },
                { label: "마이페이지 전체", href: "/my", Icon: User },
              ] as { label: string; href: string; Icon: React.ElementType }[]).map(item => (
                <Link key={item.label} href={item.href} onClick={() => setShowMyPage(false)}
                  className="flex items-center gap-2 p-3 rounded-xl bg-white border border-amber-100"
                >
                  <item.Icon size={14} style={{ color: GOLD }} />
                  <span className="text-[12px] font-bold flex-1 min-w-0 truncate" style={{ color: BROWN }}>{item.label}</span>
                  <ChevronRight size={12} className="flex-shrink-0 text-gray-300" />
                </Link>
              ))}
            </div>
            {/* 최근 주문 미리보기 */}
            {myOverview.orders.length > 0 && (
              <div>
                <p className="text-[12px] font-bold mb-2" style={{ color: BROWN }}>최근 주문</p>
                <div className="space-y-2">
                  {myOverview.orders.slice(0, 2).map((o: any) => (
                    <Link key={o.id} href="/my/orders" onClick={() => setShowMyPage(false)}
                      className="flex items-center justify-between p-3 rounded-xl bg-white border border-amber-100"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold truncate" style={{ color: BROWN }}>
                          {o.items[0]?.productName || "주문 상품"}
                          {o.items.length > 1 && <span className="text-gray-400 font-normal"> 외 {o.items.length - 1}건</span>}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{new Date(o.createdAt).toLocaleDateString("ko-KR")}</p>
                      </div>
                      <p className="text-[12px] font-extrabold flex-shrink-0 ml-2" style={{ color: BROWN }}>{o.finalAmount.toLocaleString()}원</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <SheetEmpty message="정보를 불러올 수 없어요" />
        )}
      </BottomSheet>

      {/* ═══ 장바구니 바텀시트 ═══ */}
      <BottomSheet isOpen={showCart} title="장바구니" icon={<ShoppingCart size={15} style={{ color: GOLD }} />} onClose={() => setShowCart(false)}>
        {cartFetching ? (
          <SheetLoading />
        ) : cartNeedLogin ? (
          <div className="py-8 text-center">
            <User size={34} className="text-amber-300 mx-auto" />
            <p className="text-[13px] font-bold mt-3" style={{ color: BROWN }}>로그인이 필요해요</p>
            <p className="text-[11px] text-gray-400 mt-1">로그인하고 장바구니를 확인해보세요</p>
            <Link href={`/auth/login?callbackUrl=/live/${code}`} className="inline-block mt-4 px-6 py-2.5 rounded-full text-[12px] font-bold shadow-sm" style={{ backgroundColor: HONEY, color: BROWN }}>
              로그인 하러가기
            </Link>
          </div>
        ) : cartItems.length === 0 ? (
          <SheetEmpty message="장바구니가 비어있습니다" sub="라이브 상품을 담아보세요!" />
        ) : (
          <>
            <div>
              {cartItems.map(item => {
                const price = item.variant?.price ?? item.product.basePrice;
                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 border-b border-amber-50">
                    <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-amber-50">
                      {item.product.thumbnail ? (
                        <img src={item.product.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-amber-200" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-bold truncate" style={{ color: BROWN }}>{item.product.name}</p>
                      {item.variant && <p className="text-[10px] text-gray-400 mt-0.5">{item.variant.name}</p>}
                      <p className="text-[13px] font-extrabold mt-0.5" style={{ color: GOLD }}>{price.toLocaleString()}원</p>
                    </div>
                    <span className="text-[12px] text-gray-400 flex-shrink-0">×{item.quantity}</span>
                  </div>
                );
              })}
            </div>
            <div className="pt-4">
              <div className="flex justify-between mb-3 text-[13px]">
                <span className="text-gray-500 font-medium">총 {cartItems.reduce((s: number, i: any) => s + i.quantity, 0)}개</span>
                <span className="font-extrabold" style={{ color: BROWN }}>
                  {cartItems.reduce((s: number, i: any) => s + (i.variant?.price ?? i.product.basePrice) * i.quantity, 0).toLocaleString()}원
                </span>
              </div>
              <Link
                href="/cart"
                onClick={() => setShowCart(false)}
                className="w-full py-3 rounded-xl text-[13px] font-bold text-center block"
                style={{ backgroundColor: HONEY, color: BROWN }}
              >
                장바구니 전체보기
              </Link>
            </div>
          </>
        )}
      </BottomSheet>

      {/* ═══ 토스트 ═══ */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[90] animate-toast-in">
          <div className="text-white text-[12.5px] font-bold px-5 py-3 rounded-full shadow-xl flex items-center gap-2" style={{ backgroundColor: BROWN }}>
            <CheckCircle size={14} style={{ color: HONEY }} />
            {toast}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes toast-in {
          0% { opacity: 0; transform: translate(-50%, -16px); }
          100% { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-toast-in { animation: toast-in 0.25s ease-out; }
        @keyframes pulse-slow {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
        .animate-pulse-slow { animation: pulse-slow 2s ease-in-out infinite; }
        /* TV 스태틱 노이즈 애니메이션 */
        @keyframes staticNoise {
          0%   { background-position: 0px 0px; }
          10%  { background-position: -50px -30px; }
          20%  { background-position: 30px -60px; }
          30%  { background-position: -70px 45px; }
          40%  { background-position: 60px 75px; }
          50%  { background-position: -20px -90px; }
          60%  { background-position: 90px 20px; }
          70%  { background-position: -90px -55px; }
          80%  { background-position: 45px 90px; }
          90%  { background-position: -40px 60px; }
          100% { background-position: 0px 0px; }
        }
        @keyframes staticNoise2 {
          0%   { background-position: 100px 50px; }
          14%  { background-position: 30px 120px; }
          28%  { background-position: -80px 20px; }
          42%  { background-position: 70px -80px; }
          57%  { background-position: -30px 70px; }
          71%  { background-position: 120px -30px; }
          85%  { background-position: -100px 90px; }
          100% { background-position: 100px 50px; }
        }
        @keyframes tvBlink {
          0%, 49%, 100% { opacity: 1; }
          50%, 99% { opacity: 0.25; }
        }
      `}</style>
    </div>
  );
}

// ─── 바텀시트 공통 컴포넌트 ───
function BottomSheet({ title, icon, onClose, children, maxHeight = "80vh", isOpen = true }: {
  title: string; icon?: React.ReactNode; onClose: () => void; children: React.ReactNode; maxHeight?: string; isOpen?: boolean;
}) {
  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 z-[79] bg-black/45"
        style={{
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s',
        }}
        onClick={onClose}
      />
      {/* 바텀시트 본체: 정중앙 아래에서 수직으로 올라옴 */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: isOpen ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100%)',
          transition: 'transform 0.3s ease-out',
          width: '100%',
          maxWidth: '480px',
          zIndex: 80,
          backgroundColor: '#fff',
          borderRadius: '1.5rem 1.5rem 0 0',
          borderTop: `4px solid ${HONEY}`,
          maxHeight,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="flex justify-center pt-2.5 pb-1"><div className="w-10 h-1 rounded-full bg-amber-100" /></div>
        <div className="px-5 py-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-[15px] font-extrabold" style={{ color: BROWN }}>
            {icon} {title}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
            <X size={16} style={{ color: GOLD }} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-1">{children}</div>
      </div>
    </>
  );
}

function SheetLoading() {
  return (
    <div className="py-10 flex flex-col items-center gap-2">
      <Loader2 size={22} className="animate-spin" style={{ color: GOLD }} />
      <p className="text-[12px] text-gray-300">불러오는 중...</p>
    </div>
  );
}

function SheetEmpty({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="py-8 text-center">
      <Package size={34} className="text-amber-200 mx-auto" />
      <p className="text-[13px] font-bold text-gray-400 mt-3">{message}</p>
      {sub && <p className="text-[11px] text-gray-300 mt-1">{sub}</p>}
    </div>
  );
}
