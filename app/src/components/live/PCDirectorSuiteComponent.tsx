"use client";

import { useState, useRef, useEffect, RefObject, useCallback } from "react";
import Link from "next/link";
import {
  Heart, Share2, ShoppingCart, Send, Radio,
  Truck,
  Eye, Loader2,
  ChevronRight, Volume2, VolumeX, Package,
  Gift, Info, Tag, Clock, Bell,
  ShoppingBag, Star,
  ArrowLeft, Copy, Ticket, CheckCircle,
  ExternalLink, Store,
  Play, Pause, Youtube, Gamepad2,
} from "lucide-react";

// ── 색상 상수 ──────────────────────────────────────────────────────
const AMBER = "#4C8E6B";
const AMBER_BG = "rgba(245,166,35,0.12)";

// ── 숫자 포맷 ──────────────────────────────────────────────────────
const fmt = (n: number) =>
  n >= 10000 ? `${(n / 10000).toFixed(1)}만` : n >= 1000 ? `${(n / 1000).toFixed(1)}천` : n.toLocaleString();

// ── 이미지 URL 처리 ────────────────────────────────────────────────
const getImageUrl = (url: string | null | undefined): string => {
  if (!url || url.trim() === '') return '';
  if (url.startsWith('http') || url.startsWith('blob') || url.startsWith('data')) return url;
  return url.startsWith('/') ? url : `/${url}`;
};

// ── Props ──────────────────────────────────────────────────────────
export interface PCDirectorSuiteProps {
  channel: any;
  liveStream: any;
  products: any[];
  coupons: any[];
  youtubeUrl?: string;
  onBack: () => void;
  onOpenCart?: () => void;
  onAddToCart?: (productId: string) => void;
  onBuyClick?: (productId: string) => void;
  onClaimCoupon?: (couponId: string) => void;
  onShare?: () => void;
  onOpenNotices?: () => void;
  onFollowToggle?: () => void;
  onLike?: () => void;
  onChatSend?: (message: string) => void;
  onMuteToggle?: () => void;
  onPauseToggle?: () => void;
  cartCount?: number;
  cartLoading?: string | null;
  couponClaimed?: Record<string, boolean>;
  couponClaimLoading?: string | null;
  chatMessages?: any[];
  liked?: boolean;
  likeAnim?: number[];
  followed?: boolean;
  muted?: boolean;
  isPaused?: boolean;
  iframeRef?: RefObject<HTMLIFrameElement | null>;
}

// "chat" 탭 제거
type RailTab = "products" | "coupon" | "intro" | "benefits";

export default function PCDirectorSuiteComponent({
  channel,
  liveStream,
  products,
  coupons,
  youtubeUrl,
  onBack,
  onOpenCart,
  onAddToCart,
  onBuyClick,
  onClaimCoupon,
  onShare,
  onOpenNotices,
  onFollowToggle,
  onLike,
  onChatSend,
  onMuteToggle,
  onPauseToggle,
  cartCount = 0,
  cartLoading = null,
  couponClaimed = {},
  couponClaimLoading = null,
  chatMessages = [],
  liked = false,
  likeAnim = [],
  followed = false,
  muted = false,
  isPaused = false,
  iframeRef,
}: PCDirectorSuiteProps) {
  const [rightTab, setRightTab] = useState<RailTab>("products");
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const localIframeRef = useRef<HTMLIFrameElement>(null);
  const frameRef = iframeRef ?? localIframeRef;

  // 시청자 참여 게임 폴링
  const [activeGame, setActiveGame] = useState<{ id: string; type: string; title: string } | null>(null);
  const pollActiveGame = useCallback(async () => {
    const code = liveStream?.shareCode;
    if (!code) return;
    try {
      const res = await fetch(`/api/live/${code}/active-game`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setActiveGame(data.game ?? null);
      }
    } catch {}
  }, [liveStream?.shareCode]);

  useEffect(() => {
    pollActiveGame();
    const t = setInterval(pollActiveGame, 5000);
    return () => clearInterval(t);
  }, [pollActiveGame]);

  const seller = channel ?? liveStream?.seller;
  const isLive = liveStream?.status === "LIVE";
  const isEnded = liveStream?.status === "ENDED";
  const isScheduled = liveStream?.status === "SCHEDULED";

  const exposedProduct = products.find((p: any) => p.isActive) ?? null;

  const externalLinkUrl = !youtubeUrl && liveStream?.externalUrl ? liveStream.externalUrl : null;

  // 채팅 자동 스크롤
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages?.length]);

  const handleChat = () => {
    if (!chatInput.trim()) return;
    onChatSend?.(chatInput.trim());
    setChatInput("");
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  // ── LEFT RAIL (chat 탭 제거) ────────────────────────────────────
  const railItems = [
    { tab: "products" as RailTab, icon: <ShoppingBag size={20} />, label: "상품" },
    { tab: "coupon" as RailTab, icon: <Ticket size={20} />, label: "쿠폰" },
    { tab: "intro" as RailTab, icon: <Info size={20} />, label: "라이브 소개" },
    { tab: "benefits" as RailTab, icon: <Gift size={20} />, label: "혜택" },
  ];

  // ── 상품 목록 렌더 ──────────────────────────────────────────────
  const renderProducts = () => (
    <div>
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/10">
        <span className="text-[11px] font-bold text-white/40 tracking-wider uppercase">상품 목록</span>
        <span className="text-[11px] font-bold" style={{ color: AMBER }}>{products.length}개</span>
      </div>
      {products.map((lp: any) => {
        const dp = lp.livePrice
          ? Math.round(((lp.product.basePrice - Number(lp.livePrice)) / lp.product.basePrice) * 100)
          : 0;
        const price = Number(lp.livePrice) || lp.product.basePrice;
        return (
          <div
            key={lp.id}
            onClick={() => onBuyClick?.(lp.product.id)}
            className={`w-full text-left flex gap-3 px-4 py-3.5 border-b border-white/[0.06] transition-all hover:bg-white/[0.04] cursor-pointer ${lp.isActive ? "border-l-[3px]" : "border-l-[3px] border-l-transparent"}`}
            style={lp.isActive ? { borderLeftColor: AMBER } : {}}
          >
            <div className="relative flex-shrink-0">
              {/* 썸네일 배경은 밝게 유지 — no-image.png 등 투명 PNG 는 어두운 회색 선화라
                  어두운 배경 위에 올리면 거의 보이지 않는다 (불투명 사진은 영향 없음) */}
              <div className="w-[68px] h-[68px] rounded-xl bg-gray-100 border border-white/10 overflow-hidden relative">
                {lp.product.thumbnail
                  ? <img
                      src={lp.product.thumbnail}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="eager"
                      onError={e => { e.currentTarget.src = '/no-image.png'; }}
                    />
                  : <span className="absolute inset-0 flex items-center justify-center"><Package size={20} className="text-white/30" /></span>
                }
              </div>
              {lp.isActive && isLive && (
                <span className="absolute -top-1.5 -left-1.5 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md leading-none" style={{ backgroundColor: "#ff3b5c" }}>LIVE</span>
              )}
              <span className="absolute -top-1.5 -right-1.5 text-white text-[9px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center leading-none" style={{ backgroundColor: AMBER }}>#{lp.sortOrder + 1}</span>
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-[13px] text-white font-semibold line-clamp-2 leading-[1.45]">{lp.product.name}</p>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                {dp > 0 && <span className="text-[14px] font-bold" style={{ color: "#ff3b5c" }}>{dp}%</span>}
                <span className="text-[14px] font-bold text-white">{price.toLocaleString()}원</span>
              </div>
              {lp.livePrice && lp.product.basePrice !== Number(lp.livePrice) && (
                <span className="text-[11px] text-white/30 line-through mt-0.5">{lp.product.basePrice.toLocaleString()}원</span>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5"><Truck size={9} /> 무료배송</span>
              </div>
            </div>
            <div className="self-center flex-shrink-0">
              <button
                onClick={e => { e.stopPropagation(); onAddToCart?.(lp.product.id); }}
                className="w-9 h-9 rounded-full flex items-center justify-center text-black shadow-md hover:opacity-80 transition-opacity"
                style={{ backgroundColor: AMBER }}
                title="장바구니 담기"
              >
                <ShoppingCart size={14} />
              </button>
            </div>
          </div>
        );
      })}
      {products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-white/20">
          <Package size={36} className="mb-3" />
          <p className="text-[13px]">등록된 상품이 없습니다</p>
        </div>
      )}
    </div>
  );

  // ── 쿠폰 렌더 ──────────────────────────────────────────────────
  const renderCoupons = () => (
    <div className="px-4 py-4 space-y-4 min-h-0">
      {coupons && coupons.length > 0 ? coupons.map((coupon: any) => {
        const isSoldOut = coupon.maxCount !== null && coupon.issuedCount >= coupon.maxCount;
        const isClaimed = couponClaimed[coupon.id];
        return (
          <div key={coupon.id} className="relative overflow-hidden border-2 border-dashed rounded-2xl p-4"
            style={{ borderColor: isSoldOut ? "#ffffff15" : AMBER }}>
            <div className="absolute right-3 top-3 opacity-[0.06]"><Ticket size={52} style={{ color: AMBER }} /></div>
            <div className="mb-2">
              <span className="text-[24px] font-black" style={{ color: isSoldOut ? "#ffffff25" : AMBER }}>
                {coupon.discountValue.toLocaleString()}{coupon.discountType === "PERCENT" ? "%" : "원"}
              </span>
              <span className="text-sm text-white/40 ml-1.5">할인</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 mb-3">
              <code className="text-sm font-mono font-bold text-white/80 flex-1 tracking-wider">{coupon.code}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(coupon.code); }}
                className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                style={{ color: AMBER, backgroundColor: AMBER_BG }}
              >
                <Copy size={11} /> 복사
              </button>
            </div>
            <div className="space-y-0.5 mb-3">
              <p className="text-[11px] text-white/30">· 유효기간: 라이브 종료 후 {coupon.validDays}일</p>
              {coupon.minOrderAmount != null && coupon.minOrderAmount > 0 && (
                <p className="text-[11px] text-white/30">· 최소 주문금액: {coupon.minOrderAmount.toLocaleString()}원 이상</p>
              )}
              {coupon.maxCount != null && (
                <p className="text-[11px] text-white/30">· 발급: {coupon.issuedCount}/{coupon.maxCount}개 {isSoldOut && <span className="text-red-400 font-medium">매진</span>}</p>
              )}
            </div>
            {isSoldOut ? (
              <div className="w-full py-2.5 text-center text-sm font-bold text-white/25 bg-white/5 rounded-xl">매진</div>
            ) : isClaimed ? (
              <div className="w-full py-2.5 text-center text-sm font-bold flex items-center justify-center gap-1.5 rounded-xl" style={{ color: AMBER, backgroundColor: AMBER_BG }}>
                <CheckCircle size={15} /> 발급 완료
              </div>
            ) : (
              <button
                onClick={() => onClaimCoupon?.(coupon.id)}
                disabled={couponClaimLoading === coupon.id}
                className="w-full py-2.5 text-sm font-bold text-black rounded-xl transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-1.5"
                style={{ backgroundColor: AMBER }}
              >
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

  // ── 소개 렌더 ──────────────────────────────────────────────────
  const renderIntro = () => (
    <div className="px-4 py-4 space-y-5 min-h-0">
      <div>
        <h3 className="text-[13px] font-bold text-white/60 mb-2 flex items-center gap-1.5">
          <Info size={13} style={{ color: AMBER }} /> 라이브 소개
        </h3>
        <div className="bg-white/5 rounded-xl p-4">
          <p className="text-[13px] text-white/70 leading-relaxed whitespace-pre-wrap">{liveStream?.description || "라이브 소개가 없습니다."}</p>
        </div>
      </div>
      <div>
        <h3 className="text-[13px] font-bold text-white/60 mb-2 flex items-center gap-1.5">
          <ShoppingBag size={13} style={{ color: AMBER }} /> 셀러 정보
        </h3>
        <Link href={`/shop/${seller?.slug}`} className="flex items-center gap-3 p-4 bg-white/5 rounded-xl hover:bg-white/[0.08] transition-colors">
          <div className="w-12 h-12 rounded-full bg-gray-800 border border-white/10 overflow-hidden flex-shrink-0 relative">
            {seller?.shopLogo
              ? <img src={seller.shopLogo} alt="" className="absolute inset-0 w-full h-full object-cover"
                  loading="eager" onError={e => { e.currentTarget.src = '/default-profile.png'; }} />
              : <span className="absolute inset-0 flex items-center justify-center font-bold text-lg" style={{ color: AMBER }}>{seller?.shopName?.charAt(0)}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-white">{seller?.shopName}</p>
            <p className="text-[11px] text-white/40 mt-0.5">팔로워 {fmt(seller?._count?.followers ?? 0)}명 · 라이브 {seller?._count?.liveStreams ?? 0}회</p>
          </div>
          <ChevronRight size={16} className="text-white/20 flex-shrink-0" />
        </Link>
      </div>
      <div>
        <h3 className="text-[13px] font-bold text-white/60 mb-2 flex items-center gap-1.5">
          <Eye size={13} style={{ color: AMBER }} /> 방송 통계
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "시청자", value: fmt(liveStream?.viewerCount ?? 0), color: AMBER },
            { label: "최고 시청", value: fmt(liveStream?.peakViewerCount ?? 0), color: "#ffffff" },
            { label: "좋아요", value: fmt(liveStream?.likeCount ?? 0), color: "#ff3e3e" },
          ].map((s, i) => (
            <div key={i} className="text-center p-3 bg-white/5 rounded-xl">
              <p className="text-[17px] font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[11px] text-white/40 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── 혜택 렌더 ──────────────────────────────────────────────────
  const renderBenefits = () => (
    <div className="px-4 py-4 space-y-3 min-h-0">
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

  // ──────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden honeycomb-bg">

      {/* ── LEFT: 아이콘 레일 (64px) ──────────────────────────── */}
      <div className="w-16 flex-shrink-0 flex flex-col items-center py-4 gap-1 border-r border-white/[0.07]" style={{ background: "rgba(5,5,5,0.85)" }}>
        {/* 뒤로 */}
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all mb-3"
          title="뒤로"
        >
          <ArrowLeft size={18} />
        </button>

        {/* 라이브 상태 뱃지 */}
        {isLive && (
          <div className="mb-2">
            <span className="text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 animate-glow-pulse" style={{ backgroundColor: "#FF2D55" }}>
              <span className="w-1 h-1 bg-white rounded-full animate-pulse" />LIVE
            </span>
          </div>
        )}

        <div className="flex-1 flex flex-col items-center gap-1 w-full">
          {railItems.map(({ tab, icon, label }) => (
            <button
              key={tab}
              onClick={() => setRightTab(tab)}
              title={label}
              className={`relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                rightTab === tab ? "text-amber-400 bg-amber-400/10" : "text-white/60 hover:text-white/90 hover:bg-white/10"
              }`}
            >
              {icon}
              {rightTab === tab && <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full" style={{ backgroundColor: AMBER }} />}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center gap-1 mt-auto">
          {/* 장바구니 */}
          <button onClick={onOpenCart} title="장바구니" className="relative w-11 h-11 rounded-2xl flex items-center justify-center text-white/60 hover:text-white/90 hover:bg-white/10 transition-all">
            <ShoppingCart size={20} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border border-[#050505]">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </button>
          {/* 공지 */}
          <button onClick={onOpenNotices} title="공지사항" className="w-11 h-11 rounded-2xl flex items-center justify-center text-white/60 hover:text-white/90 hover:bg-white/10 transition-all">
            <Bell size={20} />
          </button>
          {/* 공유 */}
          <button onClick={onShare} title="공유" className="w-11 h-11 rounded-2xl flex items-center justify-center text-white/60 hover:text-white/90 hover:bg-white/10 transition-all">
            <Share2 size={20} />
          </button>
          {/* 샵 */}
          <Link href={`/shop/${seller?.slug}`} title="셀러 샵" className="w-11 h-11 rounded-2xl flex items-center justify-center text-white/60 hover:text-white/90 hover:bg-white/10 transition-all">
            <Store size={20} />
          </Link>
        </div>
      </div>

      {/* ── CENTER: 9:16 비디오 영역 ──────────────────────────── */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden" style={{ background: "#020202" }}>
        {/* 9:16 컨테이너 */}
        <div className="relative h-full" style={{ aspectRatio: "9/16", maxWidth: "100%" }}>
          {youtubeUrl ? (
            <iframe
              ref={frameRef}
              src={youtubeUrl}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={liveStream?.title ?? "라이브 방송"}
            />
          ) : externalLinkUrl ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black">
              <Radio size={48} className="text-white/10" />
              <button
                onClick={() => window.open(externalLinkUrl, "_blank", "noopener,noreferrer")}
                className="flex items-center gap-2 px-5 py-3 text-black font-bold rounded-xl text-sm shadow-lg hover:opacity-90"
                style={{ backgroundColor: AMBER }}
              >
                <ExternalLink size={16} />
                {liveStream?.platform === "INSTAGRAM" ? "Instagram" : liveStream?.platform === "TIKTOK" ? "TikTok" : "외부"} 라이브 보기
              </button>
              <p className="text-white/30 text-xs">외부 플랫폼에서 라이브가 진행됩니다</p>
            </div>
          ) : (
            <div className="absolute inset-0 bg-black flex items-center justify-center">
              <Radio size={48} className="text-white/10" />
            </div>
          )}

          {/* 그라디언트 오버레이 */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70 pointer-events-none" />

          {/* 비방송 상태 */}
          {!isLive && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {isScheduled && (
                <div className="text-center glass-dark rounded-2xl p-6">
                  <Clock size={40} className="text-white/60 mx-auto mb-2" />
                  <p className="text-white text-lg font-bold">방송 예정</p>
                  <p className="text-white/40 text-xs mt-1">곧 라이브가 시작됩니다</p>
                </div>
              )}
              {isEnded && (
                <div className="text-center glass-dark rounded-2xl p-6">
                  <p className="text-white text-lg font-bold">{liveStream?.isVodSaved ? "다시보기" : "방송 종료"}</p>
                  <p className="text-white/40 text-xs mt-1">최고 시청자 {fmt(liveStream?.peakViewerCount ?? 0)}명</p>
                </div>
              )}
            </div>
          )}

          {/* 방송 제목 오버레이 */}
          {liveStream?.title && (
            <div className="absolute top-14 left-3 right-3 pointer-events-none z-10">
              <p className="text-white/80 text-[11px] font-medium drop-shadow bg-black/30 backdrop-blur-[2px] px-2.5 py-1 rounded-lg inline-block max-w-full truncate">{liveStream.title}</p>
            </div>
          )}

          {/* 상단: LIVE 뱃지 + 시청자 */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            {isLive && (
              <div className="flex items-center rounded-full overflow-hidden shadow-lg">
                <span className="text-white text-[10px] font-bold px-2.5 py-1 flex items-center gap-1" style={{ backgroundColor: "#FF2D55" }}>
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
                </span>
                <span className="glass-dark text-white text-[10px] px-2.5 py-1 flex items-center gap-1">
                  <Eye size={10} /> {fmt(liveStream?.viewerCount ?? 0)}
                </span>
              </div>
            )}
            {isEnded && <span className="glass-dark text-white text-[10px] font-medium px-3 py-1 rounded-full">종료됨</span>}
            {isScheduled && <span className="bg-blue-500/60 text-white text-[10px] font-medium px-3 py-1 rounded-full backdrop-blur-sm">방송 예정</span>}
          </div>

          {/* 우측 하단: 액션 버튼 (상품바와 겹치지 않게 위치 조정) */}
          <div className="absolute right-4 flex flex-col items-center gap-4" style={{ bottom: exposedProduct ? "5.5rem" : "2rem" }}>
            {/* 좋아요 */}
            <button onClick={onLike} className="relative flex flex-col items-center gap-1">
              <div className="w-11 h-11 rounded-full glass-dark flex items-center justify-center text-white hover:bg-black/60 transition-colors border border-white/10">
                <Heart size={20} fill={liked ? "currentColor" : "none"} className={liked ? "text-red-400" : ""} />
              </div>
              {likeAnim.map(id => (
                <Heart key={id} size={14} fill="currentColor" className="absolute text-red-400 pointer-events-none" style={{ animation: "float-up 1.4s ease-out forwards" }} />
              ))}
              <span className="text-white/60 text-[9px]">{fmt(liveStream?.likeCount ?? 0)}</span>
            </button>
          </div>

          {/* 하단 좌: 비디오 컨트롤 (상품바와 겹치지 않게 위치 조정) */}
          <div className="absolute left-4 flex items-center gap-2" style={{ bottom: exposedProduct ? "5.5rem" : "2rem" }}>
            <button
              onClick={onMuteToggle}
              className="w-10 h-10 rounded-full glass-dark flex items-center justify-center text-white hover:bg-black/60 transition-colors border border-white/10"
              title={muted ? "소리 켜기" : "소리 끄기"}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button
              onClick={onPauseToggle}
              className="w-10 h-10 rounded-full glass-dark flex items-center justify-center text-white hover:bg-black/60 transition-colors border border-white/10"
              title={isPaused ? "재생" : "일시정지"}
            >
              {isPaused ? <Play size={18} /> : <Pause size={18} />}
            </button>
          </div>

          {/* 방송화면 하단 상품바 (isActive 상품이 있을 때만 표시) */}
          {exposedProduct && (() => {
            const lp = exposedProduct;
            const lpPrice = Number(lp.livePrice) || lp.product.basePrice;
            const lpDiscount = lp.livePrice && lp.product.basePrice
              ? Math.round(((lp.product.basePrice - Number(lp.livePrice)) / lp.product.basePrice) * 100)
              : 0;
            return (
              <div className="absolute bottom-3 left-3 right-3 rounded-2xl p-3 flex items-center gap-3 border border-white/10" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
                {/* 투명 PNG 가시성 확보를 위해 밝은 배경 (상품 목록 썸네일과 동일) */}
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden relative">
                  {lp.product.thumbnail
                    ? <img
                        src={lp.product.thumbnail}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="eager"
                        onError={e => { e.currentTarget.src = '/no-image.png'; }}
                      />
                    : <span className="absolute inset-0 flex items-center justify-center"><Package size={16} className="text-white/30" /></span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-[12px] line-clamp-1">{lp.product.name}</p>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    {lpDiscount > 0 && <span className="text-[11px] font-bold" style={{ color: "#ff3b5c" }}>{lpDiscount}%</span>}
                    <span className="text-[13px] font-bold text-white">{lpPrice.toLocaleString()}원</span>
                  </div>
                </div>
                <button
                  onClick={() => onAddToCart?.(lp.product.id)}
                  className="text-amber-400 flex-shrink-0 hover:text-amber-300 transition-colors"
                  title="장바구니 담기"
                >
                  <ShoppingCart size={18} />
                </button>
                <button
                  onClick={() => onBuyClick?.(lp.product.id)}
                  className="bg-amber-500 text-black font-bold px-4 py-1.5 rounded-full text-sm whitespace-nowrap flex-shrink-0 hover:bg-amber-400 transition-colors"
                >
                  구매하기
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── RIGHT PANEL (360px) ───────────────────────────────── */}
      <div className="w-[360px] flex-shrink-0 flex flex-col h-screen border-l border-white/[0.07]" style={{ background: "#0E0F15" }}>

        {/* 셀러 헤더 - compact */}
        <div className="px-4 py-2 flex items-center gap-2.5 flex-shrink-0 border-b border-white/[0.07] h-12">
          <Link href={`/shop/${seller?.slug}`} className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gray-800 ring-2 ring-amber-400/20 overflow-hidden relative">
              {seller?.shopLogo
                ? <img
                    src={getImageUrl(seller.shopLogo)}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="eager"
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                  />
                : <span className="absolute inset-0 flex items-center justify-center font-bold text-xs" style={{ color: AMBER }}>{seller?.shopName?.charAt(0)}</span>
              }
            </div>
          </Link>
          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            <Link href={`/shop/${seller?.slug}`} className="text-white font-bold text-[13px] hover:underline truncate">{seller?.shopName}</Link>
            {isLive && (
              <span className="text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 flex-shrink-0 whitespace-nowrap" style={{ backgroundColor: "#FF2D55" }}>
                <span className="w-1 h-1 bg-white rounded-full animate-pulse" /> ON AIR
              </span>
            )}
          </div>
          <button
            onClick={onFollowToggle}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex-shrink-0 ${followed ? "bg-white/10 text-white/60" : "text-black"}`}
            style={followed ? {} : { backgroundColor: AMBER }}
          >
            {followed ? "Pick완료" : "+ Pick"}
          </button>
        </div>

        {/* 방송 제목 */}
        <div className="px-4 py-1.5 border-b border-white/[0.07] flex-shrink-0">
          <p className="text-white/60 text-[12px] leading-snug line-clamp-1">{liveStream?.title}</p>
        </div>

        {/* 탭 (chat 탭 제거, '소개' → '라이브 소개') */}
        <div className="flex border-b border-white/[0.07] flex-shrink-0">
          {(["products", "coupon", "intro", "benefits"] as const).map(tab => {
            const labels: Record<RailTab, string> = {
              products: "상품",
              coupon: "쿠폰",
              intro: "라이브 소개",
              benefits: "혜택",
            };
            return (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={`flex-1 py-2.5 text-[11px] font-bold transition-all ${rightTab === tab ? "text-amber-400 border-b-2 border-amber-400" : "text-white/40 hover:text-white/70"}`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* 탭 콘텐츠 (고정 높이 280px — 어떤 탭이든 채팅창 위치 고정) */}
        <div
          className="flex-shrink-0 overflow-y-auto"
          style={{ height: "280px", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}
        >
          {rightTab === "products" && renderProducts()}
          {rightTab === "coupon" && renderCoupons()}
          {rightTab === "intro" && renderIntro()}
          {rightTab === "benefits" && renderBenefits()}
        </div>

        {/* 채팅 섹션 (flex-1, 남은 공간 채우기) */}
        <div className="flex-1 min-h-0 flex flex-col border-t border-white/[0.07]">
          {/* 채팅 메시지 목록 */}
          <div
            className="flex-1 overflow-y-auto px-4 py-2.5 space-y-1.5"
            style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}
          >
            {chatMessages.length === 0 && (
              <p className="text-[11px] text-white/20 text-center py-1">첫 채팅을 입력해보세요</p>
            )}
            {/* chatMessages 는 최신순(desc) — 최신 20개를 시간순으로 표시 */}
            {[...chatMessages].slice(0, 20).reverse().map((msg: any) => (
              <div key={msg.id} className="text-[12px] leading-relaxed">
                {msg.isSystem ? (
                  <span className="text-white/20 text-[11px]">{msg.message}</span>
                ) : msg.isManager ? (
                  <div className="inline-block px-2.5 py-1 rounded-md" style={{ backgroundColor: AMBER_BG }}>
                    <span className="font-bold text-[10px]" style={{ color: AMBER }}>매니저</span>
                    <span className="text-white/90 ml-1">{msg.message}</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-1.5">
                    {/* 출처 배지: YouTube 실시간 채팅 vs 바닐라폼 앱 채팅 */}
                    {msg.isYoutube ? (
                      <span title="YouTube 채팅" className="inline-flex items-center justify-center h-[15px] px-1 rounded bg-[#FF0000] flex-shrink-0 mt-[1px]">
                        <Youtube size={10} className="text-white" />
                      </span>
                    ) : (
                      <img src="/favicon.svg" alt="바닐라폼" title="바닐라폼 채팅" className="w-[15px] h-[15px] rounded-[3px] flex-shrink-0 mt-[1px]" />
                    )}
                    <div className="min-w-0">
                      <span className="font-semibold text-white/60">{msg.nickname}</span>
                      <span className="text-white/80 ml-1">{msg.message}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* 시청자 참여 게임 버튼 */}
          {activeGame && (
            <div className="flex-shrink-0 px-4 py-2 border-t border-white/[0.07]">
              <a
                href={`/game/${activeGame.id}/join`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2 rounded-full text-black text-[11px] font-bold hover:opacity-90 transition-opacity"
                style={{ backgroundColor: AMBER }}
              >
                <Gamepad2 size={13} />
                게임 참여하기 · {activeGame.title}
              </a>
            </div>
          )}

          {/* 채팅 입력창 (항상 하단 고정) */}
          <div className="border-t border-white/[0.07] flex-shrink-0 px-4 py-3 flex items-center gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleChat()}
            placeholder="채팅 입력..."
            className="flex-1 text-[12px] rounded-full px-4 py-2 focus:outline-none text-white placeholder-white/30"
            style={{ backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
          />
          <button
            onClick={handleChat}
            className="w-9 h-9 rounded-full text-black flex items-center justify-center flex-shrink-0 hover:opacity-90"
            style={{ backgroundColor: AMBER }}
          >
            <Send size={14} />
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
