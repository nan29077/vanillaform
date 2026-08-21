"use client";

import { useState, useRef, useEffect, useCallback, RefObject } from "react";
import Link from "next/link";
import {
  Heart, Share2, ShoppingCart, Send, Radio,
  Eye, Loader2,
  VolumeX, Volume2, Package,
  Gift, Info,
  ShoppingBag,
  ArrowLeft, Ticket, CheckCircle,
  ExternalLink, Clock, User, Youtube, Gamepad2,
} from "lucide-react";
import { PCDirectorSuiteProps } from "./PCDirectorSuiteComponent";

// 같은 Props 타입 재사용
type MobileImmersiveProps = PCDirectorSuiteProps & {
  onOpenMobilePurchase?: () => void;
  onOpenMobileInfoSheet?: (type: "coupon" | "intro" | "benefits") => void;
  onOpenMyPage?: () => void;
};

const AMBER = "#4C8E6B";
const AMBER_BG = "rgba(245,166,35,0.12)";

const fmt = (n: number) =>
  n >= 10000 ? `${(n / 10000).toFixed(1)}만` : n >= 1000 ? `${(n / 1000).toFixed(1)}천` : n.toLocaleString();

const getImageUrl = (url: string | null | undefined): string => {
  if (!url || url.trim() === '') return '';
  if (url.startsWith('http') || url.startsWith('blob') || url.startsWith('data')) return url;
  return url.startsWith('/') ? url : `/${url}`;
};

export default function MobileImmersiveComponent({
  channel,
  liveStream,
  products,
  coupons,
  youtubeUrl,
  onBack,
  onOpenCart,
  onAddToCart,
  onBuyClick,
  onShare,
  onFollowToggle,
  onLike,
  onChatSend,
  onMuteToggle,
  onOpenMobilePurchase,
  onOpenMobileInfoSheet,
  onOpenMyPage,
  cartCount = 0,
  cartLoading = null,
  chatMessages = [],
  liked = false,
  likeAnim = [],
  followed = false,
  muted = false,
  iframeRef,
}: MobileImmersiveProps) {
  const [chatInput, setChatInput] = useState("");
  const [sellerImgErr, setSellerImgErr] = useState(false);
  const [productImgErr, setProductImgErr] = useState(false);
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
  const discountPct = exposedProduct?.livePrice && exposedProduct?.product?.basePrice
    ? Math.round(((exposedProduct.product.basePrice - Number(exposedProduct.livePrice)) / exposedProduct.product.basePrice) * 100)
    : 0;
  const displayPrice = exposedProduct ? (Number(exposedProduct.livePrice) || exposedProduct.product.basePrice) : 0;

  const externalLinkUrl = !youtubeUrl && liveStream?.externalUrl ? liveStream.externalUrl : null;

  const handleChat = () => {
    if (!chatInput.trim()) return;
    onChatSend?.(chatInput.trim());
    setChatInput("");
  };

  return (
    <div className="bg-black" style={{ position: "fixed", inset: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div className="relative flex-1 min-h-0">

        {/* ── 전체화면 비디오 ──────────────────────────────────── */}
        {youtubeUrl ? (
          <iframe
            ref={frameRef}
            src={youtubeUrl}
            className="w-full h-full absolute inset-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={liveStream?.title ?? "라이브 방송"}
          />
        ) : externalLinkUrl ? (
          <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black flex flex-col items-center justify-center gap-4">
            <Radio size={40} className="text-gray-600" />
            <button
              onClick={() => window.open(externalLinkUrl, "_blank", "noopener,noreferrer")}
              className="flex items-center gap-2 px-5 py-3 text-black font-bold rounded-xl text-sm shadow-lg hover:opacity-90"
              style={{ backgroundColor: AMBER }}
            >
              <ExternalLink size={16} />
              {liveStream?.platform === "INSTAGRAM" ? "Instagram" : liveStream?.platform === "TIKTOK" ? "TikTok" : "외부"} 라이브 보기
            </button>
            <p className="text-white/40 text-xs">외부 플랫폼에서 라이브가 진행됩니다</p>
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
            <Radio size={48} className="text-gray-700" />
          </div>
        )}

        {/* 그라디언트 오버레이 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/35 pointer-events-none" />

        {/* ── 상단 바 ────────────────────────────────────────── */}
        <div className="absolute top-0 left-0 right-0 px-3 py-2.5" style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={onBack} className="w-8 h-8 flex items-center justify-center">
                <ArrowLeft size={20} className="text-white" />
              </button>
              <Link href={`/shop/${seller?.slug}`} className="flex items-center gap-2">
                {(seller?.shopLogo && !sellerImgErr)
                  ? <img
                      src={getImageUrl(seller.shopLogo)}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover ring-[1.5px] ring-white/30"
                      onError={() => setSellerImgErr(true)}
                    />
                  : <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-[11px] font-bold">{seller?.shopName?.charAt(0)}</div>
                }
                <div>
                  <span className="text-white font-bold text-[13px]">{seller?.shopName}</span>
                  <span className="text-white/40 text-[10px] block">{fmt(seller?._count?.followers ?? 0)}명</span>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-1.5">
              {isLive && (
                <div className="flex items-center rounded-full overflow-hidden mr-0.5">
                  <span className="text-white text-[9px] font-bold px-2 py-0.5 flex items-center gap-0.5 bg-[#ff3b5c]">
                    <span className="w-1 h-1 bg-white rounded-full animate-pulse" /> LIVE
                  </span>
                  <span className="bg-black/50 text-white text-[9px] px-2 py-0.5">{fmt(liveStream?.viewerCount ?? 0)}</span>
                </div>
              )}
              <button onClick={onOpenMyPage} className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white">
                <User size={16} />
              </button>
              <button onClick={onOpenCart} className="relative w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white">
                <ShoppingCart size={16} />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">{cartCount > 9 ? "9+" : cartCount}</span>
                )}
              </button>
              <button
                onClick={onFollowToggle}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${followed ? "bg-white/20 text-white/60" : "bg-white/20 text-white"}`}
              >
                {followed ? "Pick완료" : "+ Pick"}
              </button>
            </div>
          </div>
        </div>

        {/* ── 비방송 오버레이 ─────────────────────────────────── */}
        {!isLive && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {isScheduled && (
              <div className="text-center bg-black/50 backdrop-blur-md rounded-2xl px-8 py-6">
                <Clock size={36} className="text-white/70 mx-auto mb-2" />
                <p className="text-white text-lg font-bold">방송 예정</p>
              </div>
            )}
            {isEnded && (
              <div className="text-center bg-black/50 backdrop-blur-md rounded-2xl px-8 py-6">
                <p className="text-white text-lg font-bold">{liveStream?.isVodSaved ? "다시보기" : "방송 종료"}</p>
                <p className="text-white/40 text-sm mt-1">최고 {fmt(liveStream?.peakViewerCount ?? 0)}명</p>
              </div>
            )}
          </div>
        )}

        {/* ── 우측 세로 아이콘 ────────────────────────────────── */}
        <div className="absolute right-3 top-[18%] flex flex-col items-center gap-4 z-20">
          {/* 쿠폰 */}
          <button onClick={() => onOpenMobileInfoSheet?.("coupon")} className="flex flex-col items-center gap-0.5">
            <div className="w-10 h-10 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center text-white">
              <Ticket size={18} />
            </div>
            <span className="text-white/65 text-[9px] font-medium">쿠폰</span>
          </button>
          {/* 소개 */}
          <button onClick={() => onOpenMobileInfoSheet?.("intro")} className="flex flex-col items-center gap-0.5">
            <div className="w-10 h-10 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center text-white">
              <Info size={18} />
            </div>
            <span className="text-white/65 text-[9px] font-medium">소개</span>
          </button>
          {/* 혜택 */}
          <button onClick={() => onOpenMobileInfoSheet?.("benefits")} className="flex flex-col items-center gap-0.5">
            <div className="w-10 h-10 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center text-white">
              <Gift size={18} />
            </div>
            <span className="text-white/65 text-[9px] font-medium">혜택</span>
          </button>
          {/* 음소거 */}
          <button onClick={onMuteToggle} className="flex flex-col items-center gap-0.5">
            <div className="w-10 h-10 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center text-white">
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </div>
            <span className="text-white/65 text-[9px] font-medium">{muted ? "소리끔" : "소리켬"}</span>
          </button>
          {/* 장바구니 */}
          <button onClick={onOpenCart} className="relative flex flex-col items-center gap-0.5">
            <div className="w-10 h-10 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center text-white relative">
              <ShoppingCart size={18} />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">{cartCount > 9 ? "9+" : cartCount}</span>
              )}
            </div>
            <span className="text-white/65 text-[9px] font-medium">장바구니</span>
          </button>
          {/* 공유 */}
          <button onClick={onShare} className="flex flex-col items-center gap-0.5">
            <div className="w-10 h-10 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center text-white">
              <Share2 size={18} />
            </div>
            <span className="text-white/65 text-[9px] font-medium">공유</span>
          </button>
        </div>

        {/* ── 하단 영역 ────────────────────────────────────────── */}
        <div className="absolute bottom-0 left-0 right-0 z-50">
          {/* 채팅 메시지 */}
          <div className="px-3 mb-2">
            <div className="space-y-0.5 max-h-[110px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              {/* chatMessages 는 최신순(desc) — 최신 8개를 시간순으로 표시 */}
              {[...chatMessages].slice(0, 8).reverse().map((msg: any) => (
                <div key={msg.id} className="text-[11px] leading-snug">
                  {msg.isManager ? (
                    <span className="inline-block backdrop-blur-sm text-white px-2 py-0.5 rounded-md" style={{ backgroundColor: `${AMBER}CC` }}>
                      <span className="font-bold">{msg.nickname}</span>
                      <span className="ml-1">{msg.message}</span>
                    </span>
                  ) : msg.isSystem ? (
                    <span className="text-white/30">{msg.message}</span>
                  ) : (
                    <span className="inline-flex items-baseline gap-1">
                      {/* 출처 배지: YouTube 실시간 채팅 vs 바닐라폼 앱 채팅 */}
                      {msg.isYoutube ? (
                        <span title="YouTube 채팅" className="inline-flex items-center justify-center h-[13px] px-0.5 rounded bg-[#FF0000] flex-shrink-0 self-center">
                          <Youtube size={9} className="text-white" />
                        </span>
                      ) : (
                        <img src="/favicon.svg" alt="바닐라폼" title="바닐라폼 채팅" className="w-[13px] h-[13px] rounded-[3px] flex-shrink-0 self-center" />
                      )}
                      <span className="font-semibold text-white/70">{msg.nickname}</span>
                      <span className="text-white/50">{msg.message}</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 현재 방송 중인 상품 바 */}
          {exposedProduct && (
            <div
              className="bg-white px-3 py-2.5 flex items-center gap-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.18)] cursor-pointer"
              onClick={onOpenMobilePurchase}
            >
              <div className="flex-shrink-0 relative">
                {(exposedProduct.product.thumbnail && !productImgErr)
                  ? <img
                      src={getImageUrl(exposedProduct.product.thumbnail)}
                      alt=""
                      className="w-11 h-11 rounded-lg object-cover border border-gray-100"
                      onError={() => setProductImgErr(true)}
                    />
                  : <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center"><Package size={14} className="text-gray-300" /></div>
                }
                {products.length > 1 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 text-white text-[7px] font-bold rounded-full flex items-center justify-center" style={{ backgroundColor: AMBER }}>{products.length}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-gray-600 truncate">{exposedProduct.product.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {discountPct > 0 && <span className="text-[13px] font-bold" style={{ color: "#ff3b5c" }}>{discountPct}%</span>}
                  <span className="text-[13px] font-bold text-gray-900">{displayPrice.toLocaleString()}원</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => onAddToCart?.(exposedProduct.product.id)}
                  disabled={cartLoading === exposedProduct.product.id}
                  className="w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-60"
                  style={{ backgroundColor: AMBER_BG, color: AMBER }}
                >
                  {cartLoading === exposedProduct.product.id ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
                </button>
                <button
                  onClick={() => onBuyClick?.(exposedProduct.product.id)}
                  className="px-3.5 py-2 text-black text-[12px] font-bold rounded-lg"
                  style={{ backgroundColor: AMBER }}
                >
                  구매하기
                </button>
              </div>
            </div>
          )}

          {/* 채팅 입력창 + 라이브상품 버튼 (한 줄, 맨 하단) */}
          <div
            className="px-3 flex items-center gap-2"
            style={{ paddingTop: "0.5rem", paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
          >
            {/* 게임 참여 FAB */}
            {activeGame && (
              <a
                href={`/game/${activeGame.id}/join`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "#7c3aed" }}
                title={`게임 참여하기 · ${activeGame.title}`}
              >
                <Gamepad2 size={16} className="text-white" />
              </a>
            )}
            {/* 라이브상품 버튼 */}
            <button
              onClick={onOpenMobilePurchase}
              className="h-10 px-3 rounded-full flex items-center gap-1.5 text-white relative flex-shrink-0 shadow-lg"
              style={{ backgroundColor: AMBER }}
            >
              <ShoppingBag size={15} />
              <span className="text-[11px] font-bold whitespace-nowrap text-black">라이브상품</span>
              {products.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-[7px] font-bold rounded-full flex items-center justify-center" style={{ color: AMBER }}>{products.length}</span>
              )}
            </button>
            {/* 채팅 입력 */}
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleChat()}
              placeholder="채팅을 입력해주세요"
              className="flex-1 rounded-full px-4 py-2 text-[12px] text-white placeholder-white/60 caret-white outline-none"
              style={{ position: "relative", zIndex: 60, backgroundColor: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)", color: "white" }}
            />
            {/* 보내기 */}
            <button
              onClick={handleChat}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-lg bg-white/15 backdrop-blur-sm border border-white/15"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
