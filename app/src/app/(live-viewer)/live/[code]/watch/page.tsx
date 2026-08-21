"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Heart, Share2, ShoppingCart, Send, Radio,
  ChevronDown, X, Minus, Plus, Truck,
  Eye, Video, Loader2,
  ChevronRight, Volume2, VolumeX, Package,
  HelpCircle, Gift, Info, Tag, Clock, Bell,
  ShoppingBag, Star,
  ArrowLeft, Copy, Ticket, CheckCircle,
  ChevronUp, ExternalLink, Store, Pin,
  Play, Pause,
} from "lucide-react";
import PCDirectorSuiteComponent from "@/components/live/PCDirectorSuiteComponent";
import MobileImmersiveComponent from "@/components/live/MobileImmersiveComponent";
import WatchMyPageSheet from "@/components/live/WatchMyPageSheet";

// ── 앱 테마 (amber/honey) ───────────────────────────────────────────
const HONEY = "#4C8E6B";
const HONEY_DARK = "#D4A017";
const HONEY_BG = "rgba(245,166,35,0.12)";
const PRIMARY = HONEY;

// ── 타입 ───────────────────────────────────────────────────────────
interface LiveCoupon {
  id: string; code: string; discountType: string; discountValue: number;
  validDays: number; maxCount: number | null; minOrderAmount: number | null; issuedCount: number;
}

interface CartItem {
  id: string; productId: string; sellerId: string; quantity: number;
  product: { id: string; name: string; thumbnail: string | null; basePrice: number };
  variant: { id: string; name: string; price: number; stock: number } | null;
}

interface LiveData {
  id: string; title: string; description: string | null; thumbnailImage: string | null;
  status: string; shareCode: string; viewerCount: number; peakViewerCount: number;
  likeCount: number; isVodSaved: boolean; startedAt: string | null; endedAt: string | null;
  theme?: string;
  platform?: string | null;
  externalUrl?: string | null;
  seller: { id: string; shopName: string; shopLogo: string | null; slug: string; totalFans: number; _count: { followers: number; liveStreams: number } };
  products: { id: string; product: { id: string; name: string; thumbnail: string | null; basePrice: number; comparePrice: number | null; badges: any; description?: string }; livePrice: number | null; sortOrder: number; isActive: boolean }[];
  chatMessages: { id: string; nickname: string; message: string; isManager: boolean; isSystem: boolean; isBot?: boolean; isYoutube?: boolean; createdAt: string }[];
  coupons: LiveCoupon[];
}

interface Notice {
  id: string; title: string; content: string; isPinned: boolean; createdAt: string;
}

// ── YouTube 임베드 URL ─────────────────────────────────────────────
function getYoutubeEmbedUrl(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&?]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/live\/([^?/]+)/,
    /youtube\.com\/embed\/([^?/]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return `https://www.youtube-nocookie.com/embed/${match[1]}?enablejsapi=1&autoplay=1&mute=0&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1`;
  }
  return null;
}

// ── 숫자 포맷 ─────────────────────────────────────────────────────
const formatNum = (n: number) =>
  n >= 10000 ? `${(n / 10000).toFixed(1)}만` : n >= 1000 ? `${(n / 1000).toFixed(1)}천` : n.toLocaleString();

// ── 사이드 아이콘 버튼 (PC 좌측 사이드바용) ────────────────────────
function SideIconBtn({
  onClick, href, title, active, badge, children,
}: {
  onClick?: () => void; href?: string; title?: string;
  active?: boolean; badge?: number; children: React.ReactNode;
}) {
  const cls = `relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all
    ${active
      ? "text-amber-400"
      : "text-white/50 hover:text-white/90 hover:bg-white/10"
    }`;
  const content = (
    <>
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border border-[#0a0a16]">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </>
  );
  if (href) return <Link href={href} title={title} className={cls}>{content}</Link>;
  return <button onClick={onClick} title={title} className={cls}>{content}</button>;
}

// ── 모달 바텀시트 ──────────────────────────────────────────────────
function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[80]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[78vh] flex flex-col animate-sheet-up"
        style={{ borderTop: `4px solid ${HONEY}` }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-amber-100" />
        </div>
        <div className="px-5 py-3 flex items-center justify-between border-b border-amber-50">
          <h3 className="text-[15px] font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
            <X size={16} className="text-amber-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
export default function LiveWatchPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string) ?? "";
  const { data: session } = useSession();

  // ── 기본 상태 ────────────────────────────────────────────────
  const [live, setLive] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [liked, setLiked] = useState(false);
  const [likeAnim, setLikeAnim] = useState<number[]>([]);
  const [muted, setMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"products" | "coupon" | "intro" | "benefits">("products");
  const [showMobilePurchase, setShowMobilePurchase] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showSharePopup, setShowSharePopup] = useState(false);
  const [showFaq, setShowFaq] = useState(false);
  const [couponClaimed, setCouponClaimed] = useState<Record<string, boolean>>({});
  const [couponClaimLoading, setCouponClaimLoading] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [cartLoading, setCartLoading] = useState<string | null>(null);
  const [mobileInfoSheet, setMobileInfoSheet] = useState<null | "coupon" | "intro" | "benefits">(null);
  const [showCart, setShowCart] = useState(false);
  const [externalConfirmUrl, setExternalConfirmUrl] = useState<string | null>(null);
  const [showMyPage, setShowMyPage] = useState(false);
  const [pcSelectedProductId, setPcSelectedProductId] = useState<string | null>(null);
  const [pcPurchaseQty, setPcPurchaseQty] = useState(1);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartFetching, setCartFetching] = useState(false);
  const [cartItemLoading, setCartItemLoading] = useState<string | null>(null);
  // 공지사항
  const [showNotices, setShowNotices] = useState(false);
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [noticesLoading, setNoticesLoading] = useState(false);
  // 하울링 방지: PC/모바일 중 하나만 iframe 마운트
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const pcIframeRef = useRef<HTMLIFrameElement>(null);
  const mobileIframeRef = useRef<HTMLIFrameElement>(null);

  // ── 전체 스크롤 비활성화 ────────────────────────────────────
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.style.height = "100%";
    document.documentElement.style.height = "100%";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = orig;
      document.body.style.height = "";
      document.documentElement.style.height = "";
      document.documentElement.style.overflow = "";
    };
  }, []);

  // ── 라이브 데이터 패치 ────────────────────────────────────────
  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch(`/api/live?mode=detail&code=${code}`);
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setLive(data.live);
    } catch { setError("라이브 정보를 불러올 수 없습니다."); }
    finally { setLoading(false); }
  }, [code]);

  useEffect(() => { fetchLive(); }, [fetchLive]);
  useEffect(() => {
    if (live?.status === "LIVE") {
      const interval = setInterval(fetchLive, 8000);
      return () => clearInterval(interval);
    }
  }, [live?.status, fetchLive]);

  // ── YouTube 실시간 채팅 수집 트리거 ─────────────────────────────
  // 라이브(YouTube) 진행 중, 서버가 셀러 API 키로 YouTube 채팅을 폴링해
  // 앱 채팅에 병합하도록 주기적으로 요청한다. 서버가 window 당 1회만 실제 폴링하므로
  // 여러 시청자가 동시에 호출해도 쿼터가 낭비되지 않는다. (수신 결과는 위 8초 폴링으로 표시)
  useEffect(() => {
    if (live?.status !== "LIVE" || live?.platform !== "YOUTUBE" || !live?.id) return;
    const liveId = live.id;
    const ping = () => {
      fetch("/api/live/youtube-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveId }),
      }).catch(() => {});
    };
    ping();
    const interval = setInterval(ping, 5000);
    return () => clearInterval(interval);
  }, [live?.status, live?.platform, live?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [live?.chatMessages?.length]);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── PICK 초기 상태 서버에서 조회 ─────────────────────────────
  useEffect(() => {
    if (!live?.seller?.id || !session) return;
    fetch(`/api/sellers/pick?sellerId=${live.seller.id}`)
      .then(r => r.json())
      .then(d => { if (typeof d.picked === "boolean") setFollowed(d.picked); })
      .catch(() => {});
  }, [live?.seller?.id, session]);

  // ── YouTube postMessage 음소거 제어 (일시정지와 독립 동작) ────────
  const sendYouTubeCommand = useCallback((command: string) => {
    const iframes = [pcIframeRef.current, mobileIframeRef.current];
    iframes.forEach(iframe => {
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: command, args: [] }),
          "*"
        );
      }
    });
  }, []);

  // YouTube 플레이어 상태 변화 리스너: 영상 내부 클릭으로 정지해도 소리 멈춤
  useEffect(() => {
    const handleYTMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (!data?.event) return;
        let playerState: number | null = null;
        // onStateChange: data.info = number (1=playing, 2=paused, 0=ended)
        if (data.event === "onStateChange" && typeof data.info === "number") {
          playerState = data.info;
        } else if (data.event === "infoDelivery" && data.info?.playerState !== undefined) {
          playerState = data.info.playerState;
        }
        if (playerState === null) return;
        if (playerState === 2 || playerState === 0) {
          // 일시정지 / 종료 → 소리 확실히 끔
          setIsPaused(true);
          sendYouTubeCommand("mute");
        } else if (playerState === 1) {
          // 재생 재개
          setIsPaused(false);
        }
      } catch {}
    };
    window.addEventListener("message", handleYTMessage);
    return () => window.removeEventListener("message", handleYTMessage);
  }, [sendYouTubeCommand]);

  // ── 핸들러 ────────────────────────────────────────────────────
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleChat = async () => {
    if (!chatMessage.trim() || !live) return;
    try {
      const nick = session?.user?.name || (session?.user?.email ? session.user.email.split("@")[0] : "익명");
      await fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "chat", liveId: live.id, message: chatMessage, nickname: nick }),
      });
      setChatMessage("");
      fetchLive();
    } catch {}
  };

  const handleSendChat = useCallback(async (msg: string) => {
    if (!msg.trim() || !live) return;
    try {
      const nick = session?.user?.name || (session?.user?.email ? session.user.email.split("@")[0] : "익명");
      await fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "chat", liveId: live.id, message: msg, nickname: nick }),
      });
      fetchLive();
    } catch {}
  }, [live, session, fetchLive]);

  const handleClaimCoupon = async (couponId: string) => {
    setCouponClaimLoading(couponId);
    try {
      const res = await fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim_coupon", couponId }),
      });
      const data = await res.json();
      if (data.success) {
        setCouponClaimed(prev => ({ ...prev, [couponId]: true }));
        navigator.clipboard.writeText(data.couponCode).catch(() => {});
        showToast(`쿠폰 발급 완료: ${data.couponCode}`);
        fetchLive();
      } else if (data.alreadyClaimed) {
        setCouponClaimed(prev => ({ ...prev, [couponId]: true }));
        showToast("이미 받으신 쿠폰입니다.");
      } else {
        showToast(data.error || "쿠폰 발급에 실패했습니다.");
      }
    } catch {
      showToast("쿠폰 발급 중 오류가 발생했습니다.");
    } finally {
      setCouponClaimLoading(null);
    }
  };

  const handleAddToCart = async (productId: string) => {
    if (!live) return;
    setCartLoading(productId);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, sellerId: live.seller.id, quantity: 1 }),
      });
      if (res.ok) showToast("장바구니에 담았습니다.");
      else if (res.status === 401) showToast("로그인이 필요합니다.");
      else { const d = await res.json().catch(() => ({})); showToast(d.error || "장바구니 추가에 실패했습니다."); }
    } catch { showToast("장바구니 추가 중 오류가 발생했습니다."); }
    finally { setCartLoading(null); }
  };

  const fetchCart = async () => {
    setCartFetching(true);
    try {
      const res = await fetch("/api/cart");
      if (res.ok) { const data = await res.json(); setCartItems(data.items); }
    } catch {} finally { setCartFetching(false); }
  };

  const openCart = () => { setShowCart(true); fetchCart(); };

  const handleCartQtyChange = async (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    setCartItemLoading(itemId);
    try {
      await fetch("/api/cart", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, quantity }) });
      await fetchCart();
    } catch {} finally { setCartItemLoading(null); }
  };

  const handleCartDelete = async (itemId: string) => {
    setCartItemLoading(itemId);
    try {
      await fetch("/api/cart", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId }) });
      await fetchCart();
    } catch {} finally { setCartItemLoading(null); }
  };

  const handleMuteToggle = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      sendYouTubeCommand(next ? "mute" : "unMute");
      return next;
    });
  }, [sendYouTubeCommand]);

  // 일시정지: pauseVideo + mute 동시 전송 (state updater 밖에서 side effect 처리)
  const handlePauseToggle = useCallback(() => {
    const next = !isPaused;
    setIsPaused(next);
    if (next) {
      sendYouTubeCommand("pauseVideo");
      sendYouTubeCommand("mute");
    } else {
      sendYouTubeCommand("playVideo");
      if (!muted) sendYouTubeCommand("unMute");
    }
  }, [isPaused, sendYouTubeCommand, muted]);

  const handleLike = () => {
    setLiked(true);
    const id = Date.now();
    setLikeAnim(prev => [...prev, id]);
    setTimeout(() => setLikeAnim(prev => prev.filter(a => a !== id)), 1500);
  };

  // ── PICK 토글 (서버 API 호출) ─────────────────────────────────
  const handleFollowToggle = async () => {
    if (!live?.seller?.id) return;
    try {
      const res = await fetch("/api/sellers/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId: live.seller.id }),
      });
      if (res.status === 401) { showToast("로그인이 필요합니다"); return; }
      const data = await res.json();
      if (typeof data.picked === "boolean") {
        setFollowed(data.picked);
        showToast(data.picked ? "채널을 찜했어요!" : "찜을 해제했어요");
      }
    } catch {
      showToast("잠시 후 다시 시도해주세요");
    }
  };

  const handleCopyUrl = () => {
    const url = typeof window !== "undefined" ? window.location.href.replace("/watch", "") : "";
    navigator.clipboard.writeText(url)
      .then(() => { setShowSharePopup(false); showToast("링크가 복사되었습니다."); })
      .catch(() => { setShowSharePopup(false); showToast("링크 복사에 실패했습니다."); });
  };

  const handleNativeShare = () => {
    if (navigator.share) {
      const url = typeof window !== "undefined" ? window.location.href.replace("/watch", "") : "";
      navigator.share({ title: live?.title, url }).catch(() => {});
    }
    setShowSharePopup(false);
  };

  const handleBuyClick = (productId: string) => {
    if (!live) return;
    const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;
    if (isMobile) setSelectedProductId(productId);
    else setPcSelectedProductId(productId);
  };

  const openNotices = async () => {
    setShowNotices(true);
    if (notices) return;
    setNoticesLoading(true);
    try {
      const res = await fetch(`/api/live/${code}/notices`);
      const data = await res.json();
      setNotices(data.notices || []);
    } catch { setNotices([]); }
    finally { setNoticesLoading(false); }
  };

  // ── 로딩 / 에러 ──────────────────────────────────────────────
  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0f0f1a]">
      <div className="text-center">
        <img src="/favicon.svg" alt="로딩" className="w-20 h-20 mx-auto mb-4 animate-bounce" style={{ objectFit: "contain" }} />
        <p className="text-amber-400/60 text-sm font-medium">라이브를 불러오는 중...</p>
      </div>
    </div>
  );

  if (error || !live) return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0f0f1a] text-white p-6">
      <Video size={48} className="text-white/20 mb-4" />
      <p className="text-lg font-bold mb-2">라이브를 찾을 수 없습니다</p>
      <p className="text-sm text-white/40 mb-6">{error || "잘못된 주소이거나 종료된 라이브입니다."}</p>
      <Link href={`/live/${code}`} className="px-5 py-2.5 text-white rounded-xl text-sm font-bold hover:opacity-80" style={{ backgroundColor: PRIMARY }}>
        채널로 이동
      </Link>
    </div>
  );

  // ── 파생 상태 ─────────────────────────────────────────────────
  const exposedProduct = live.products.find(p => p.isActive) || null;
  const currentProduct = exposedProduct;
  const discountPercent = currentProduct?.livePrice && currentProduct?.product?.basePrice
    ? Math.round(((currentProduct.product.basePrice - Number(currentProduct.livePrice)) / currentProduct.product.basePrice) * 100) : 0;
  const displayPrice = currentProduct ? (Number(currentProduct.livePrice) || currentProduct.product.basePrice) : 0;
  const isLive = live.status === "LIVE";
  const isEnded = live.status === "ENDED";
  const isScheduled = live.status === "SCHEDULED";
  const youtubeEmbedUrl = live.externalUrl ? getYoutubeEmbedUrl(live.externalUrl) : null;
  const externalLinkUrl = !youtubeEmbedUrl && live.externalUrl ? live.externalUrl : null;
  const selectedLp = selectedProductId ? live.products.find(p => p.product.id === selectedProductId) : null;
  const pcSelectedLp = pcSelectedProductId ? live.products.find(p => p.product.id === pcSelectedProductId) : null;
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const myNickname = session?.user?.name || (session?.user?.email ? session.user.email.split("@")[0] : "익명");

  // ── 공통 쿠폰 렌더 ────────────────────────────────────────────
  const renderCoupons = () => (
    <div className="space-y-4">
      {live.coupons && live.coupons.length > 0 ? live.coupons.map(coupon => {
        const isSoldOut = coupon.maxCount !== null && coupon.issuedCount >= coupon.maxCount;
        const isClaimed = couponClaimed[coupon.id];
        return (
          <div key={coupon.id} className="relative overflow-hidden border-2 border-dashed rounded-2xl p-4"
            style={{ borderColor: isSoldOut ? "#e5e7eb" : HONEY }}>
            <div className="absolute right-3 top-3 opacity-[0.07]"><Ticket size={52} style={{ color: HONEY }} /></div>
            <div className="mb-2">
              <span className="text-[26px] font-black" style={{ color: isSoldOut ? "#9ca3af" : PRIMARY }}>
                {coupon.discountValue.toLocaleString()}{coupon.discountType === "PERCENT" ? "%" : "원"}
              </span>
              <span className="text-sm text-gray-500 ml-1.5">할인</span>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 mb-3">
              <code className="text-sm font-mono font-bold text-gray-800 flex-1 tracking-wider">{coupon.code}</code>
              <button onClick={() => { navigator.clipboard.writeText(coupon.code); showToast("쿠폰 코드가 복사되었습니다."); }}
                className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
                style={{ color: PRIMARY, backgroundColor: HONEY_BG }}>
                <Copy size={11} /> 복사
              </button>
            </div>
            <div className="space-y-0.5 mb-3">
              <p className="text-[11px] text-gray-400">· 유효기간: 라이브 종료 후 {coupon.validDays}일</p>
              {coupon.minOrderAmount != null && coupon.minOrderAmount > 0 && (
                <p className="text-[11px] text-gray-400">· 최소 주문금액: {coupon.minOrderAmount.toLocaleString()}원 이상</p>
              )}
              {coupon.maxCount != null && (
                <p className="text-[11px] text-gray-400">
                  · 발급 현황: {coupon.issuedCount}/{coupon.maxCount}개
                  {isSoldOut && <span className="ml-1 text-red-400 font-medium">매진</span>}
                </p>
              )}
            </div>
            {isSoldOut ? (
              <div className="w-full py-2.5 text-center text-sm font-bold text-gray-400 bg-gray-100 rounded-xl">매진</div>
            ) : isClaimed ? (
              <div className="w-full py-2.5 text-center text-sm font-bold flex items-center justify-center gap-1.5 rounded-xl"
                style={{ color: PRIMARY, backgroundColor: HONEY_BG }}>
                <CheckCircle size={15} /> 발급 완료
              </div>
            ) : (
              <button onClick={() => handleClaimCoupon(coupon.id)} disabled={couponClaimLoading === coupon.id}
                className="w-full py-2.5 text-sm font-bold text-white rounded-xl transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-1.5"
                style={{ backgroundColor: PRIMARY }}>
                {couponClaimLoading === coupon.id ? <Loader2 size={14} className="animate-spin" /> : <Ticket size={14} />}
                쿠폰 받기
              </button>
            )}
          </div>
        );
      }) : (
        <div className="py-12 text-center">
          <Ticket size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-[14px] font-bold text-gray-400">쿠폰 없음</p>
          <p className="text-[12px] text-gray-300 mt-1">현재 사용 가능한 쿠폰이 없습니다.</p>
        </div>
      )}
    </div>
  );

  // ── 공통 혜택 렌더 ────────────────────────────────────────────
  const renderBenefits = () => (
    <div className="space-y-3">
      {[
        { icon: Truck, label: "무료배송", desc: "라이브 상품 전상품 무료배송", color: "bg-blue-50 text-blue-500" },
        { icon: Tag, label: "라이브 특가", desc: "방송 중에만 적용되는 특별 할인가", color: "bg-red-50 text-red-500" },
        { icon: Gift, label: "정품 보장", desc: "브랜드 공식 정품만 판매합니다", color: "bg-green-50 text-green-600" },
        { icon: Package, label: "무료 반품", desc: "7일 이내 무료 교환/반품 가능", color: "bg-purple-50 text-purple-500" },
        { icon: Star, label: "멤버 혜택", desc: "멤버 가입 시 추가 적립", color: "bg-yellow-50 text-yellow-600" },
      ].map((b, i) => {
        const [bgCls, textCls] = b.color.split(" ");
        return (
          <div key={i} className={`flex items-center gap-3 p-4 rounded-xl ${bgCls}`}>
            <div className={`w-10 h-10 rounded-full ${bgCls} flex items-center justify-center flex-shrink-0`}>
              <b.icon size={18} className={textCls} />
            </div>
            <div>
              <p className={`text-[13px] font-bold ${textCls}`}>{b.label}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{b.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── 공통 소개 렌더 ────────────────────────────────────────────
  const renderIntro = () => (
    <div className="space-y-5">
      <div>
        <h3 className="text-[13px] font-bold text-gray-800 mb-2 flex items-center gap-1.5">
          <Info size={13} style={{ color: PRIMARY }} /> 라이브 소개
        </h3>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">{live.description || "라이브 소개가 없습니다."}</p>
        </div>
      </div>
      <div>
        <h3 className="text-[13px] font-bold text-gray-800 mb-2 flex items-center gap-1.5">
          <ShoppingBag size={13} style={{ color: PRIMARY }} /> 셀러 정보
        </h3>
        <Link href={`/shop/${live.seller.slug}`} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
          {live.seller.shopLogo
            ? <img src={live.seller.shopLogo} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" />
            : <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: HONEY_BG, color: PRIMARY }}>{live.seller.shopName.charAt(0)}</div>
          }
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-gray-900">{live.seller.shopName}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">팔로워 {formatNum(live.seller._count.followers)}명 · 라이브 {live.seller._count.liveStreams}회</p>
          </div>
          <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
        </Link>
      </div>
      <div>
        <h3 className="text-[13px] font-bold text-gray-800 mb-2 flex items-center gap-1.5">
          <Eye size={13} style={{ color: PRIMARY }} /> 방송 통계
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "시청자", value: formatNum(live.viewerCount), color: PRIMARY },
            { label: "최고 시청", value: formatNum(live.peakViewerCount), color: "#111827" },
            { label: "좋아요", value: formatNum(live.likeCount), color: "#ff3e3e" },
          ].map((stat, i) => (
            <div key={i} className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-[18px] font-bold" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── 공통 상품 목록 렌더 ───────────────────────────────────────
  const renderProducts = () => (
    <div>
      <div className="px-4 py-2.5 bg-amber-50/80 border-b border-amber-100 flex items-center justify-between">
        <span className="text-[12px] font-bold text-gray-600">
          상품 <span style={{ color: PRIMARY }}>{live.products.length}</span>개
        </span>
        <button className="text-[11px] font-medium flex items-center gap-0.5" style={{ color: PRIMARY }}>
          전체 보기 <ChevronRight size={12} />
        </button>
      </div>
      {live.products.map(lp => {
        const dp = lp.livePrice ? Math.round(((lp.product.basePrice - Number(lp.livePrice)) / lp.product.basePrice) * 100) : 0;
        const price = Number(lp.livePrice) || lp.product.basePrice;
        return (
          <button key={lp.id} onClick={() => handleBuyClick(lp.product.id)}
            className={`w-full text-left flex gap-3 px-4 py-3.5 border-b border-gray-50 cursor-pointer transition-all hover:bg-amber-50/40 ${lp.isActive ? "border-l-[3px] bg-amber-50/50" : "border-l-[3px] border-l-transparent"}`}
            style={lp.isActive ? { borderLeftColor: PRIMARY } : {}}>
            <div className="relative flex-shrink-0">
              {lp.product.thumbnail
                ? <img src={lp.product.thumbnail} alt="" className="w-[72px] h-[72px] rounded-xl object-cover border border-gray-100" />
                : <div className="w-[72px] h-[72px] rounded-xl bg-gray-100 flex items-center justify-center border border-gray-100"><Package size={22} className="text-gray-300" /></div>
              }
              {lp.isActive && isLive && (
                <span className="absolute -top-1.5 -left-1.5 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md leading-none shadow-sm" style={{ backgroundColor: "#ff3b5c" }}>LIVE</span>
              )}
              <span className="absolute -top-1.5 -right-1.5 text-white text-[9px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center leading-none shadow-sm" style={{ backgroundColor: PRIMARY }}>#{lp.sortOrder + 1}</span>
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-[13px] text-gray-700 line-clamp-2 leading-[1.45] font-medium">{lp.product.name}</p>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                {dp > 0 && <span className="text-[15px] font-bold" style={{ color: "#ff3b5c" }}>{dp}%</span>}
                <span className="text-[15px] font-bold text-gray-900">{price.toLocaleString()}원</span>
              </div>
              {lp.livePrice && lp.product.basePrice !== Number(lp.livePrice) && (
                <span className="text-[11px] text-gray-300 line-through mt-0.5">{lp.product.basePrice.toLocaleString()}원</span>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5"><Truck size={9} /> 무료배송</span>
              </div>
            </div>
            <div className="self-center flex-shrink-0">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-md" style={{ backgroundColor: PRIMARY }}>
                <ShoppingCart size={14} />
              </div>
            </div>
          </button>
        );
      })}
      {live.products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-300">
          <Package size={36} className="mb-3" />
          <p className="text-[13px]">등록된 상품이 없습니다</p>
        </div>
      )}
    </div>
  );

  // ── 방송 화면 하단 상품 바 (PC · 모바일 공통) ─────────────────
  const ProductBar = ({ onCartClick, onBuyClick }: { onCartClick: () => void; onBuyClick: () => void }) => (
    currentProduct ? (
      <div className="bg-white px-3 py-2.5 flex items-center gap-2.5 border-t border-gray-100 shadow-[0_-4px_16px_rgba(0,0,0,0.18)]">
        <div className="flex-shrink-0">
          {currentProduct.product.thumbnail
            ? <img src={currentProduct.product.thumbnail} alt="" className="w-11 h-11 rounded-lg object-cover border border-gray-100" />
            : <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center"><Package size={14} className="text-gray-300" /></div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-gray-600 truncate">{currentProduct.product.name}</p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            {discountPercent > 0 && <span className="text-[13px] font-bold" style={{ color: "#ff3b5c" }}>{discountPercent}%</span>}
            <span className="text-[13px] font-bold text-gray-900">{displayPrice.toLocaleString()}원</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={onCartClick} disabled={cartLoading === currentProduct.product.id}
            className="w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-60 transition-colors shadow-sm"
            style={{ backgroundColor: HONEY_BG, color: PRIMARY }}>
            {cartLoading === currentProduct.product.id ? <Loader2 size={15} className="animate-spin" /> : <ShoppingCart size={15} />}
          </button>
          <button onClick={onBuyClick}
            className="px-3.5 py-2 text-white text-[11px] font-bold rounded-lg shadow-sm"
            style={{ backgroundColor: PRIMARY }}>
            구매하기
          </button>
        </div>
      </div>
    ) : null
  );

  // ── PC 전용 다크 렌더 함수 ────────────────────────────────────
  const renderProductsPC = () => (
    <div>
      <div className="px-4 py-2.5 bg-white/5 border-b border-white/10 flex items-center justify-between">
        <span className="text-[12px] font-bold text-white/50">
          상품 <span style={{ color: PRIMARY }}>{live.products.length}</span>개
        </span>
        <button className="text-[11px] font-medium flex items-center gap-0.5" style={{ color: PRIMARY }}>
          전체 보기 <ChevronRight size={12} />
        </button>
      </div>
      {live.products.map(lp => {
        const dp = lp.livePrice ? Math.round(((lp.product.basePrice - Number(lp.livePrice)) / lp.product.basePrice) * 100) : 0;
        const price = Number(lp.livePrice) || lp.product.basePrice;
        return (
          <button key={lp.id} onClick={() => handleBuyClick(lp.product.id)}
            className={`w-full text-left flex gap-3 px-4 py-3.5 border-b border-white/10 cursor-pointer transition-all hover:bg-white/5 ${lp.isActive ? "border-l-[3px]" : "border-l-[3px] border-l-transparent"}`}
            style={lp.isActive ? { borderLeftColor: PRIMARY } : {}}>
            <div className="relative flex-shrink-0">
              {lp.product.thumbnail
                ? <img src={lp.product.thumbnail} alt="" className="w-[72px] h-[72px] rounded-xl object-cover border border-white/10" />
                : <div className="w-[72px] h-[72px] rounded-xl bg-white/10 flex items-center justify-center border border-white/10"><Package size={22} className="text-white/30" /></div>
              }
              {lp.isActive && isLive && (
                <span className="absolute -top-1.5 -left-1.5 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md leading-none shadow-sm" style={{ backgroundColor: "#ff3b5c" }}>LIVE</span>
              )}
              <span className="absolute -top-1.5 -right-1.5 text-white text-[9px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center leading-none shadow-sm" style={{ backgroundColor: PRIMARY }}>#{lp.sortOrder + 1}</span>
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-[13px] text-white/80 line-clamp-2 leading-[1.45] font-medium">{lp.product.name}</p>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                {dp > 0 && <span className="text-[15px] font-bold" style={{ color: "#ff3b5c" }}>{dp}%</span>}
                <span className="text-[15px] font-bold text-white">{price.toLocaleString()}원</span>
              </div>
              {lp.livePrice && lp.product.basePrice !== Number(lp.livePrice) && (
                <span className="text-[11px] text-white/30 line-through mt-0.5">{lp.product.basePrice.toLocaleString()}원</span>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5"><Truck size={9} /> 무료배송</span>
              </div>
            </div>
            <div className="self-center flex-shrink-0">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-md" style={{ backgroundColor: PRIMARY }}>
                <ShoppingCart size={14} />
              </div>
            </div>
          </button>
        );
      })}
      {live.products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-white/20">
          <Package size={36} className="mb-3" />
          <p className="text-[13px]">등록된 상품이 없습니다</p>
        </div>
      )}
    </div>
  );

  const renderCouponsPC = () => (
    <div className="space-y-4">
      {live.coupons && live.coupons.length > 0 ? live.coupons.map(coupon => {
        const isSoldOut = coupon.maxCount !== null && coupon.issuedCount >= coupon.maxCount;
        const isClaimed = couponClaimed[coupon.id];
        return (
          <div key={coupon.id} className="relative overflow-hidden border-2 border-dashed rounded-2xl p-4"
            style={{ borderColor: isSoldOut ? "#ffffff15" : HONEY }}>
            <div className="absolute right-3 top-3 opacity-[0.07]"><Ticket size={52} style={{ color: HONEY }} /></div>
            <div className="mb-2">
              <span className="text-[26px] font-black" style={{ color: isSoldOut ? "#ffffff25" : PRIMARY }}>
                {coupon.discountValue.toLocaleString()}{coupon.discountType === "PERCENT" ? "%" : "원"}
              </span>
              <span className="text-sm text-white/40 ml-1.5">할인</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 mb-3">
              <code className="text-sm font-mono font-bold text-white/80 flex-1 tracking-wider">{coupon.code}</code>
              <button onClick={() => { navigator.clipboard.writeText(coupon.code); showToast("쿠폰 코드가 복사되었습니다."); }}
                className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
                style={{ color: PRIMARY, backgroundColor: HONEY_BG }}>
                <Copy size={11} /> 복사
              </button>
            </div>
            <div className="space-y-0.5 mb-3">
              <p className="text-[11px] text-white/30">· 유효기간: 라이브 종료 후 {coupon.validDays}일</p>
              {coupon.minOrderAmount != null && coupon.minOrderAmount > 0 && (
                <p className="text-[11px] text-white/30">· 최소 주문금액: {coupon.minOrderAmount.toLocaleString()}원 이상</p>
              )}
              {coupon.maxCount != null && (
                <p className="text-[11px] text-white/30">
                  · 발급 현황: {coupon.issuedCount}/{coupon.maxCount}개
                  {isSoldOut && <span className="ml-1 text-red-400 font-medium">매진</span>}
                </p>
              )}
            </div>
            {isSoldOut ? (
              <div className="w-full py-2.5 text-center text-sm font-bold text-white/25 bg-white/5 rounded-xl">매진</div>
            ) : isClaimed ? (
              <div className="w-full py-2.5 text-center text-sm font-bold flex items-center justify-center gap-1.5 rounded-xl"
                style={{ color: PRIMARY, backgroundColor: HONEY_BG }}>
                <CheckCircle size={15} /> 발급 완료
              </div>
            ) : (
              <button onClick={() => handleClaimCoupon(coupon.id)} disabled={couponClaimLoading === coupon.id}
                className="w-full py-2.5 text-sm font-bold text-white rounded-xl transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-1.5"
                style={{ backgroundColor: PRIMARY }}>
                {couponClaimLoading === coupon.id ? <Loader2 size={14} className="animate-spin" /> : <Ticket size={14} />}
                쿠폰 받기
              </button>
            )}
          </div>
        );
      }) : (
        <div className="py-12 text-center">
          <Ticket size={40} className="text-white/10 mx-auto mb-3" />
          <p className="text-[14px] font-bold text-white/30">쿠폰 없음</p>
          <p className="text-[12px] text-white/20 mt-1">현재 사용 가능한 쿠폰이 없습니다.</p>
        </div>
      )}
    </div>
  );

  const renderIntroPC = () => (
    <div className="space-y-5">
      <div>
        <h3 className="text-[13px] font-bold text-white/70 mb-2 flex items-center gap-1.5">
          <Info size={13} style={{ color: PRIMARY }} /> 라이브 소개
        </h3>
        <div className="bg-white/5 rounded-xl p-4">
          <p className="text-[13px] text-white/50 leading-relaxed whitespace-pre-wrap">{live.description || "라이브 소개가 없습니다."}</p>
        </div>
      </div>
      <div>
        <h3 className="text-[13px] font-bold text-white/70 mb-2 flex items-center gap-1.5">
          <ShoppingBag size={13} style={{ color: PRIMARY }} /> 셀러 정보
        </h3>
        <Link href={`/shop/${live.seller.slug}`} className="flex items-center gap-3 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
          {live.seller.shopLogo
            ? <img src={live.seller.shopLogo} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-white/20 shadow-sm" />
            : <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: HONEY_BG, color: PRIMARY }}>{live.seller.shopName.charAt(0)}</div>
          }
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-white/80">{live.seller.shopName}</p>
            <p className="text-[11px] text-white/30 mt-0.5">팔로워 {formatNum(live.seller._count.followers)}명 · 라이브 {live.seller._count.liveStreams}회</p>
          </div>
          <ChevronRight size={16} className="text-white/20 flex-shrink-0" />
        </Link>
      </div>
      <div>
        <h3 className="text-[13px] font-bold text-white/70 mb-2 flex items-center gap-1.5">
          <Eye size={13} style={{ color: PRIMARY }} /> 방송 통계
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "시청자", value: formatNum(live.viewerCount), color: PRIMARY },
            { label: "최고 시청", value: formatNum(live.peakViewerCount), color: "#ffffff" },
            { label: "좋아요", value: formatNum(live.likeCount), color: "#ff3e3e" },
          ].map((stat, i) => (
            <div key={i} className="text-center p-3 bg-white/5 rounded-xl">
              <p className="text-[18px] font-bold" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-[11px] text-white/30 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderBenefitsPC = () => (
    <div className="space-y-3">
      {[
        { icon: Truck, label: "무료배송", desc: "라이브 상품 전상품 무료배송", textCls: "text-blue-400", bgCls: "bg-blue-900/20" },
        { icon: Tag, label: "라이브 특가", desc: "방송 중에만 적용되는 특별 할인가", textCls: "text-red-400", bgCls: "bg-red-900/20" },
        { icon: Gift, label: "정품 보장", desc: "브랜드 공식 정품만 판매합니다", textCls: "text-emerald-400", bgCls: "bg-emerald-900/20" },
        { icon: Package, label: "무료 반품", desc: "7일 이내 무료 교환/반품 가능", textCls: "text-purple-400", bgCls: "bg-purple-900/20" },
        { icon: Star, label: "멤버 혜택", desc: "멤버 가입 시 추가 적립", textCls: "text-amber-400", bgCls: "bg-amber-900/20" },
      ].map((b, i) => (
        <div key={i} className={`flex items-center gap-3 p-4 rounded-xl ${b.bgCls}`}>
          <div className={`w-10 h-10 rounded-full ${b.bgCls} flex items-center justify-center flex-shrink-0`}>
            <b.icon size={18} className={b.textCls} />
          </div>
          <div>
            <p className={`text-[13px] font-bold ${b.textCls}`}>{b.label}</p>
            <p className="text-[11px] text-white/40 mt-0.5">{b.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );

  // ╔═══════════════════════════════════════════════════════════════
  // ║  렌더
  // ╚═══════════════════════════════════════════════════════════════
  return (
    <>
      {/* ── Toast ─────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 bg-gray-900 text-white text-[13px] font-medium rounded-full shadow-2xl animate-fade-in">
          {toast}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
           PC LAYOUT  (lg+)  — Director's Suite 다크 테마
          ════════════════════════════════════════════════════════ */}
      {isDesktop !== false && (
        <div className="hidden lg:block">
          <PCDirectorSuiteComponent
            channel={live.seller}
            liveStream={live}
            products={live.products}
            coupons={live.coupons}
            youtubeUrl={youtubeEmbedUrl ?? undefined}
            onBack={() => router.back()}
            onOpenCart={openCart}
            onAddToCart={handleAddToCart}
            onBuyClick={handleBuyClick}
            onClaimCoupon={handleClaimCoupon}
            onShare={() => setShowSharePopup(true)}
            onOpenNotices={openNotices}
            onFollowToggle={handleFollowToggle}
            onLike={handleLike}
            onChatSend={handleSendChat}
            onMuteToggle={handleMuteToggle}
            onPauseToggle={handlePauseToggle}
            cartCount={cartCount}
            cartLoading={cartLoading}
            couponClaimed={couponClaimed}
            couponClaimLoading={couponClaimLoading}
            chatMessages={live.chatMessages}
            liked={liked}
            likeAnim={likeAnim}
            followed={followed}
            muted={muted}
            isPaused={isPaused}
            iframeRef={pcIframeRef}
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
           MOBILE LAYOUT  (< lg)
          ════════════════════════════════════════════════════════ */}
      {isDesktop !== true && (
        <div className="lg:hidden">
          <MobileImmersiveComponent
            channel={live.seller}
            liveStream={live}
            products={live.products}
            coupons={live.coupons}
            youtubeUrl={youtubeEmbedUrl ?? undefined}
            onBack={() => router.back()}
            onOpenCart={openCart}
            onAddToCart={handleAddToCart}
            onBuyClick={(id) => setSelectedProductId(id)}
            onShare={() => setShowSharePopup(true)}
            onFollowToggle={handleFollowToggle}
            onLike={handleLike}
            onChatSend={handleSendChat}
            onMuteToggle={handleMuteToggle}
            onOpenMobilePurchase={() => setShowMobilePurchase(true)}
            onOpenMobileInfoSheet={(type) => setMobileInfoSheet(type)}
            onOpenMyPage={() => setShowMyPage(true)}
            cartCount={cartCount}
            cartLoading={cartLoading}
            chatMessages={live.chatMessages}
            liked={liked}
            likeAnim={likeAnim}
            followed={followed}
            muted={muted}
            iframeRef={mobileIframeRef}
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
           모달 / 팝업
          ════════════════════════════════════════════════════════ */}

      {/* 모바일 상품 목록 바텀시트 */}
      {showMobilePurchase && (
        <div className="lg:hidden fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobilePurchase(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[75vh] flex flex-col">
            <div className="flex justify-center py-2"><div className="w-9 h-1 bg-gray-200 rounded-full" /></div>
            <div className="px-4 pb-2 flex items-center justify-between">
              <span className="text-[14px] font-bold text-gray-900">
                라이브 상품 <span style={{ color: PRIMARY }}>{live.products.length}</span>
              </span>
              <button onClick={() => setShowMobilePurchase(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="overflow-y-auto flex-1 border-t border-gray-100">
              {live.products.map(lp => {
                const dp = lp.livePrice ? Math.round(((lp.product.basePrice - Number(lp.livePrice)) / lp.product.basePrice) * 100) : 0;
                const price = Number(lp.livePrice) || lp.product.basePrice;
                return (
                  <button key={lp.id} onClick={() => { setShowMobilePurchase(false); setSelectedProductId(lp.product.id); }}
                    className="w-full text-left flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50">
                    <div className="relative flex-shrink-0">
                      {lp.product.thumbnail
                        ? <img src={lp.product.thumbnail} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-100" />
                        : <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center"><Package size={20} className="text-gray-300" /></div>
                      }
                      <span className="absolute -top-1 -left-1 text-white text-[9px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center leading-none shadow-sm" style={{ backgroundColor: PRIMARY }}>#{lp.sortOrder + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-gray-600 line-clamp-2 leading-[1.4]">{lp.product.name}</p>
                      <div className="flex items-baseline gap-1.5 mt-1.5">
                        {dp > 0 && <span className="text-[14px] font-bold" style={{ color: "#ff3b5c" }}>{dp}%</span>}
                        <span className="text-[14px] font-bold text-gray-900">{price.toLocaleString()}원</span>
                      </div>
                      {lp.livePrice && lp.product.basePrice !== Number(lp.livePrice) && (
                        <span className="text-[11px] text-gray-300 line-through">{lp.product.basePrice.toLocaleString()}원</span>
                      )}
                      <span className="text-[10px] text-gray-400 mt-0.5 block">무료배송</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 모바일 정보 바텀시트 (쿠폰/소개/혜택) */}
      {mobileInfoSheet && (
        <div className="lg:hidden fixed inset-0 z-[75]">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileInfoSheet(null)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[78vh] flex flex-col"
            style={{ borderTop: `4px solid ${HONEY}` }}>
            <div className="flex justify-center py-2.5"><div className="w-9 h-1 bg-amber-100 rounded-full" /></div>
            <div className="px-4 pb-2.5 flex items-center justify-between border-b border-amber-50">
              <span className="text-[14px] font-bold text-gray-900 flex items-center gap-1.5">
                {mobileInfoSheet === "coupon"   && <><Ticket size={15} style={{ color: PRIMARY }} /> 쿠폰</>}
                {mobileInfoSheet === "intro"    && <><Info size={15} style={{ color: PRIMARY }} /> 라이브 소개</>}
                {mobileInfoSheet === "benefits" && <><Gift size={15} style={{ color: PRIMARY }} /> 혜택</>}
              </span>
              <button onClick={() => setMobileInfoSheet(null)} className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
                <X size={16} className="text-amber-500" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {mobileInfoSheet === "coupon"   && renderCoupons()}
              {mobileInfoSheet === "intro"    && renderIntro()}
              {mobileInfoSheet === "benefits" && renderBenefits()}
            </div>
          </div>
        </div>
      )}

      {/* 공지사항 바텀시트 */}
      {showNotices && (
        <BottomSheet title="공지사항" onClose={() => setShowNotices(false)}>
          {noticesLoading ? (
            <div className="py-12 flex flex-col items-center gap-2">
              <Loader2 size={22} className="animate-spin" style={{ color: HONEY }} />
              <p className="text-[12px] text-gray-300">불러오는 중...</p>
            </div>
          ) : !notices || notices.length === 0 ? (
            <div className="py-10 text-center">
              <Bell size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-[13px] font-bold text-gray-400">등록된 공지사항이 없어요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notices.map(n => (
                <div key={n.id} className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/40">
                  <div className="flex items-center gap-1.5 mb-1">
                    {n.isPinned && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: HONEY, color: "#fff" }}>
                        <Pin size={9} /> 고정
                      </span>
                    )}
                    <p className="text-[13px] font-bold flex-1 min-w-0 truncate text-gray-800">{n.title}</p>
                  </div>
                  <p className="text-[12px] text-gray-500 whitespace-pre-wrap leading-relaxed">{n.content}</p>
                  <p className="text-[10px] text-gray-300 mt-2">{new Date(n.createdAt).toLocaleDateString("ko-KR")}</p>
                </div>
              ))}
            </div>
          )}
        </BottomSheet>
      )}

      {/* 장바구니 슬라이드 패널 */}
      {showCart && (
        <div className="fixed inset-0 z-[80] flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCart(false)} />
          <div className="relative w-full max-w-[360px] h-full bg-white flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart size={17} className="text-gray-700" />
                <span className="text-[15px] font-bold text-gray-900">장바구니</span>
                {cartCount > 0 && (
                  <span className="text-[12px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: PRIMARY }}>{cartCount}</span>
                )}
              </div>
              <button onClick={() => setShowCart(false)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {cartFetching ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 size={22} className="animate-spin text-gray-300" />
                </div>
              ) : cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-16 text-gray-300">
                  <ShoppingCart size={40} className="mb-3" />
                  <p className="text-[14px]">장바구니가 비어있습니다</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {cartItems.map(item => (
                    <div key={item.id} className="flex items-start gap-3 px-4 py-3.5">
                      <div className="flex-shrink-0 w-[60px] h-[60px] rounded-lg overflow-hidden bg-gray-100 border border-gray-100">
                        {item.product.thumbnail
                          ? <img src={item.product.thumbnail} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Package size={18} className="text-gray-300" /></div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-gray-700 line-clamp-2 leading-snug font-medium">{item.product.name}</p>
                        {item.variant && <p className="text-[11px] text-gray-400 mt-0.5">{item.variant.name}</p>}
                        <p className="text-[14px] font-bold text-gray-900 mt-1">
                          {((item.variant?.price ?? item.product.basePrice) * item.quantity).toLocaleString()}원
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <button onClick={() => handleCartQtyChange(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1 || cartItemLoading === item.id}
                            className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-40">
                            <Minus size={11} />
                          </button>
                          <span className="text-[13px] font-bold text-gray-800 min-w-[20px] text-center">
                            {cartItemLoading === item.id ? <Loader2 size={11} className="animate-spin mx-auto" /> : item.quantity}
                          </span>
                          <button onClick={() => handleCartQtyChange(item.id, item.quantity + 1)}
                            disabled={cartItemLoading === item.id}
                            className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-40">
                            <Plus size={11} />
                          </button>
                          <button onClick={() => handleCartDelete(item.id)}
                            disabled={cartItemLoading === item.id}
                            className="ml-1 w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 disabled:opacity-40">
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!cartFetching && cartItems.length > 0 && (
              <div className="border-t border-gray-100 px-4 py-4 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] text-gray-500">총 금액</span>
                  <span className="text-[16px] font-bold text-gray-900">
                    {cartItems.reduce((sum, item) => sum + (item.variant?.price ?? item.product.basePrice) * item.quantity, 0).toLocaleString()}원
                  </span>
                </div>
                <Link href="/my/cart" onClick={() => setShowCart(false)}
                  className="w-full h-12 rounded-xl flex items-center justify-center text-white font-bold text-[14px] transition-opacity hover:opacity-90 gap-2"
                  style={{ backgroundColor: PRIMARY }}>
                  <ShoppingCart size={16} /> 장바구니로 이동
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 공유 팝업 */}
      {showSharePopup && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSharePopup(false)} />
          <div className="relative bg-white w-[320px] rounded-2xl shadow-2xl overflow-hidden">
            <div className="h-1" style={{ backgroundColor: HONEY }} />
            <div className="p-5 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ backgroundColor: HONEY_BG }}>
                <Share2 size={24} style={{ color: PRIMARY }} />
              </div>
              <h3 className="text-[15px] font-bold text-gray-900 mb-1">공유하기</h3>
              <p className="text-[12px] text-gray-400">라이브 링크를 공유하세요</p>
            </div>
            <div className="px-5 pb-2">
              <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2">
                <span className="flex-1 text-[11px] text-gray-500 truncate">
                  {typeof window !== "undefined" ? window.location.href.replace("/watch", "") : ""}
                </span>
                <button onClick={handleCopyUrl}
                  className="flex-shrink-0 px-3 py-1.5 text-white text-[11px] font-bold rounded-lg flex items-center gap-1"
                  style={{ backgroundColor: PRIMARY }}>
                  <Copy size={12} /> 복사
                </button>
              </div>
            </div>
            <div className="p-5 pt-3 space-y-2">
              {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
                <button onClick={handleNativeShare}
                  className="w-full py-3 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
                  <Share2 size={15} /> 다른 앱으로 공유
                </button>
              )}
              <button onClick={() => setShowSharePopup(false)}
                className="w-full py-3 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상품 구매 바텀시트 */}
      {selectedLp && (
        <div className="fixed inset-0 z-[75]">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedProductId(null)} />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl h-[75vh] flex flex-col">
            <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
              <div className="w-9 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="px-4 pb-2 flex items-center gap-2 flex-shrink-0">
              <p className="flex-1 text-[13px] font-bold text-gray-900 truncate pr-2">{selectedLp.product.name}</p>
              <button onClick={() => setSelectedProductId(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 min-h-0 border-t border-gray-100">
              <iframe src={`/products/${selectedLp.product.id}?from=live&sellerId=${live.seller.id}&embedded=true`}
                className="w-full h-full border-0" title="상품 상세" />
            </div>
          </div>
        </div>
      )}

      {/* PC 상품 팝업 모달 */}
      {pcSelectedLp && (
        <div className="hidden lg:flex fixed inset-0 z-[85] items-center justify-center">
          <div className="absolute inset-0 bg-black/80" onClick={() => setPcSelectedProductId(null)} />
          <div className="relative z-10 bg-[#0E0F15] rounded-2xl border border-white/10 overflow-hidden shadow-2xl max-w-2xl w-full" style={{ maxHeight: "85vh" }}>
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
              <p className="text-white font-bold text-[15px] truncate pr-4">{pcSelectedLp.product.name}</p>
              <button
                onClick={() => setPcSelectedProductId(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white flex-shrink-0 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            {/* 콘텐츠 */}
            <div className="overflow-y-auto" style={{ maxHeight: "calc(80vh - 64px)" }}>
              <div className="flex gap-6 p-6">
                {/* 좌: 상품 이미지 */}
                {/* 투명 PNG 가시성 확보를 위해 밝은 배경 (상품 목록 썸네일과 동일) */}
                <div className="flex-shrink-0 w-80 h-80 rounded-xl bg-gray-100 border border-white/10 overflow-hidden flex items-center justify-center">
                  {pcSelectedLp.product.thumbnail
                    ? <img
                        src={pcSelectedLp.product.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                        style={{ filter: 'none', opacity: 1 }}
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    : <Package size={48} className="text-white/20" />
                  }
                </div>
                {/* 우: 상품 정보 */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <div>
                    <p className="text-white text-[18px] font-bold leading-snug mb-4">{pcSelectedLp.product.name}</p>
                    {/* 가격 */}
                    <div className="flex items-baseline gap-3 mb-1">
                      {pcSelectedLp.livePrice && Number(pcSelectedLp.livePrice) !== pcSelectedLp.product.basePrice && (
                        <span className="text-red-400 text-[18px] font-bold">
                          {Math.round(((pcSelectedLp.product.basePrice - Number(pcSelectedLp.livePrice)) / pcSelectedLp.product.basePrice) * 100)}%
                        </span>
                      )}
                      <span className="text-2xl font-bold text-amber-400">
                        {(Number(pcSelectedLp.livePrice) || pcSelectedLp.product.basePrice).toLocaleString()}원
                      </span>
                    </div>
                    {pcSelectedLp.livePrice && Number(pcSelectedLp.livePrice) !== pcSelectedLp.product.basePrice && (
                      <p className="text-white/30 text-[13px] line-through mb-4">{pcSelectedLp.product.basePrice.toLocaleString()}원</p>
                    )}
                    <div className="flex items-center gap-1.5 mb-4">
                      <span className="text-[11px] text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded font-medium flex items-center gap-1">
                        <Truck size={10} /> 무료배송
                      </span>
                    </div>
                    {/* 상품 설명 */}
                    {pcSelectedLp.product.description && (
                      <div className="mb-4">
                        <p className="text-white/50 text-[13px] leading-relaxed line-clamp-4">{pcSelectedLp.product.description}</p>
                      </div>
                    )}
                    {/* 수량 선택 */}
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-white/60 text-[13px]">수량</span>
                      <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                        <button
                          onClick={() => setPcPurchaseQty(q => Math.max(1, q - 1))}
                          className="w-6 h-6 flex items-center justify-center text-white/60 hover:text-white"
                        ><Minus size={14} /></button>
                        <span className="text-white font-bold text-[15px] min-w-[24px] text-center">{pcPurchaseQty}</span>
                        <button
                          onClick={() => setPcPurchaseQty(q => q + 1)}
                          className="w-6 h-6 flex items-center justify-center text-white/60 hover:text-white"
                        ><Plus size={14} /></button>
                      </div>
                    </div>
                    {/* 총 결제 금액 */}
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl mb-2">
                      <span className="text-white/50 text-[13px]">총 결제 금액</span>
                      <span className="text-amber-400 text-[18px] font-bold">
                        {((Number(pcSelectedLp.livePrice) || pcSelectedLp.product.basePrice) * pcPurchaseQty).toLocaleString()}원
                      </span>
                    </div>
                  </div>
                  {/* 버튼 */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => { handleAddToCart(pcSelectedLp.product.id); }}
                      disabled={cartLoading === pcSelectedLp.product.id}
                      className="flex-1 py-3 px-8 rounded-xl border border-amber-400 text-amber-400 font-bold text-[14px] hover:bg-amber-400/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {cartLoading === pcSelectedLp.product.id ? <Loader2 size={15} className="animate-spin" /> : <ShoppingCart size={16} />}
                      장바구니
                    </button>
                    <button
                      onClick={() => { setPcSelectedProductId(null); showToast("장바구니에서 주문하세요."); }}
                      className="flex-1 py-3 px-8 rounded-xl text-black font-bold text-[14px] hover:opacity-90 transition-opacity flex items-center justify-center"
                      style={{ backgroundColor: PRIMARY }}
                    >
                      바로 구매
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 외부 링크 이동 확인 팝업 */}
      {externalConfirmUrl && (
        <div className="fixed inset-0 z-[10100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setExternalConfirmUrl(null)} />
          <div className="relative w-full max-w-[320px] bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-amber-200">
            <div className="h-1 bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-400" />
            <div className="px-6 pt-6 pb-2 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-50 flex items-center justify-center">
                <ExternalLink size={26} className="text-amber-500" />
              </div>
              <h3 className="text-[15px] font-bold text-amber-700 mb-2">외부 링크 이동 확인</h3>
              <p className="text-[13px] text-gray-500 leading-relaxed">
                외부 플랫폼으로 이동합니다.<br />
                아래 링크를 확인 후 이동해주세요.
              </p>
              <div className="mt-3 mb-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-[11px] font-mono text-amber-700 break-all">{externalConfirmUrl}</p>
              </div>
              <p className="text-[12px] text-amber-600 leading-relaxed">
                신뢰하는 사이트가 아니라면 이동을 취소하세요.
              </p>
            </div>
            <div className="p-4 pt-5 flex gap-2.5">
              <button onClick={() => setExternalConfirmUrl(null)}
                className="flex-1 py-3 text-[13px] font-semibold text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all">
                취소
              </button>
              <button onClick={() => { window.open(externalConfirmUrl, "_blank", "noopener,noreferrer"); setExternalConfirmUrl(null); }}
                className="flex-1 py-3 text-[13px] font-bold text-white rounded-xl active:scale-[0.98] transition-all"
                style={{ backgroundColor: PRIMARY }}>
                이동하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 마이페이지 바텀시트 */}
      <WatchMyPageSheet open={showMyPage} onClose={() => setShowMyPage(false)} />

      <style jsx global>{`
        @keyframes float-up {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-60px) scale(0.5); }
        }
        .animate-float-up { animation: float-up 1.4s ease-out forwards; }

        @keyframes fade-in {
          from { opacity: 0; transform: translate(-50%, -8px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }

        @keyframes sheet-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .animate-sheet-up { animation: sheet-up 0.28s ease-out; }
      `}</style>
    </>
  );
}
