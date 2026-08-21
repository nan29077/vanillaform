"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import Link from "next/link";
import {ChevronRight} from 'lucide-react';
import SafeImage from "@/components/shared/SafeImage";
import HexNumBadge from "@/components/shared/HexNumBadge";
import { DEFAULT_PRODUCT_IMAGE } from "@/lib/defaults";
import ProductBottomSheet from "@/components/shared/ProductBottomSheet";

interface ProductInfo {
  id: string;
  name: string;
  thumbnail: string | null;
  basePrice: number;
  comparePrice?: number | null;
}

interface LiveProduct {
  id: string;
  livePrice: number | null;
  sortOrder?: number;
  product: ProductInfo;
}

interface LiveInfo {
  id: string;
  title: string;
  description: string | null;
  thumbnailImage: string | null;
  shareCode: string;
  viewerCount?: number;
  peakViewerCount?: number;
  likeCount?: number;
  isVodSaved?: boolean;
  scheduledAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  products: LiveProduct[];
}

interface ManualProduct {
  id: string;
  name: string;
  thumbnail: string | null;
  basePrice: number;
  comparePrice?: number | null;
}

interface DirectProduct {
  id: string;
  name: string;
  price: number;
  shippingFee: number;
  images: string[];
  stock: number;
}

interface TabData {
  campaigns: any[];
  products: { id: string; name: string; thumbnail: string | null; basePrice: number; comparePrice?: number | null; category: string | null; images: any[]; shopNumber?: number | null }[];
  directExpose?: boolean;
  numbering?: boolean;
  directExposureOn?: boolean;
  directProducts?: DirectProduct[];
  currentLive: LiveInfo | null;
  scheduledLives: LiveInfo[];
  endedLives: LiveInfo[];
  themeColor: string;
  features: { groupBuy: boolean; liveCommerce: boolean };
  hasLive: boolean;
  isLive: boolean;
  sellerProfileImage?: string | null;
  manualLiveProducts: ManualProduct[];
  manualPastProducts: ManualProduct[];
}

/** 방송 카드 썸네일: 방송 썸네일 → 첫 상품 썸네일 → 셀러 프로필 이미지 폴백 */
function liveThumb(live: LiveInfo, sellerImg?: string | null): string | null {
  return live.thumbnailImage || live.products[0]?.product.thumbnail || sellerImg || null;
}

/** 방송 대표 가격(최저가) */
function liveMinPrice(live: LiveInfo): number | null {
  const prices = live.products.map((p) => p.livePrice ?? p.product.basePrice).filter((n) => n > 0);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

function formatBroadcastDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "방송일 미정";
  return new Date(dateStr).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
}

function formatThumbnailDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "라이브";
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 라이브`;
}

export default function SellerShopTabs({
  data, sellerSlug, sellerName, sellerId,
}: {
  data: TabData; sellerSlug: string; sellerName: string; sellerId?: string;
}) {
  const { campaigns, products, directExpose, numbering, directExposureOn, directProducts = [], currentLive, scheduledLives, endedLives, themeColor, features, hasLive, isLive, sellerProfileImage, manualLiveProducts, manualPastProducts } = data;

  const showLiveTab = hasLive || features.liveCommerce || manualLiveProducts.length > 0;
  // 지난 방송 상품 탭은 showPastInShop=true인 종료 방송이 있을 때만 표시.
  // manualPastProducts(isManualLive OFF 시 자동 이동)는 탭 자체의 노출 여부를 결정하지 않음.
  // — 셀러가 PastBroadcastToggles에서 모두 OFF 하면 탭이 사라지는 것이 올바른 동작.
  const showPastTab = endedLives.length > 0;

  const tabs = [
    ...(directExpose && products.length > 0 ? [{ id: "products", label: "상품", count: products.length }] : []),
    ...(showLiveTab ? [{ id: "live", label: "현재 라이브 중 상품", count: (currentLive ? 1 : 0) + scheduledLives.length, isLive: isLive || manualLiveProducts.length > 0 }] : []),
    ...(showPastTab ? [{ id: "past", label: "지난 방송 상품", count: endedLives.length }] : []),
    ...(features.groupBuy && campaigns.length > 0 ? [{ id: "campaigns", label: "공동구매", count: campaigns.length }] : []),
    ...(directExposureOn ? [{ id: "direct", label: "일반상품", count: directProducts.length }] : []),
  ];

  const [activeTab, setActiveTab] = useState(tabs[0]?.id || "live");
  const [openLiveId, setOpenLiveId] = useState<string | null>(null);
  // 바텀시트: 선택된 상품 ID
  const [bottomSheetProductId, setBottomSheetProductId] = useState<string | null>(null);

  if (tabs.length === 0) {
    return (
      <div className="mt-4 px-4 py-16 text-center text-gray-400 bg-gray-50 rounded-xl mx-4">
        <Icon name="Cart" size={36} strokeWidth={1.5} className="mx-auto mb-2 opacity-30" />
        <p className="text-xs">아직 준비 중인 샵입니다</p>
      </div>
    );
  }

  return (
    <>
    <div className="mt-4">
      {/* ───── 탭 네비게이션 ───── */}
      <div className="sticky top-14 z-20 bg-white border-b border-gray-100">
        <div className="flex overflow-x-auto scrollbar-hide">
          {tabs.map((tab: any) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-fit text-center px-3 py-3 text-[13px] font-medium transition-all border-b-2 whitespace-nowrap relative ${
                activeTab === tab.id
                  ? "border-current font-bold"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
              style={activeTab === tab.id ? { color: themeColor, borderBottomColor: themeColor } : {}}
            >
              {tab.isLive && (
                <span className="inline-flex items-center gap-0.5 mr-1">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                </span>
              )}
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1 text-[10px] font-bold opacity-60">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ───── 탭 콘텐츠 ───── */}
      <div className="px-4 py-5">
        {/* ── 상품 탭 (샵에 바로 노출하기) ── */}
        {activeTab === "products" && (
          <div className="animate-fade-in">
            <div className="grid grid-cols-2 gap-3">
              {products.map((p) => {
                const dp = p.comparePrice && p.comparePrice > p.basePrice
                  ? Math.round((1 - p.basePrice / p.comparePrice) * 100) : 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setBottomSheetProductId(p.id)}
                    className="group rounded-xl overflow-hidden bg-white border border-gray-100 hover:shadow-md transition-all text-left"
                  >
                    <div className="aspect-square overflow-hidden bg-gray-100 relative">
                      <SafeImage src={p.thumbnail} placeholder={DEFAULT_PRODUCT_IMAGE} alt={p.name} width={200} height={200} fallbackText={p.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      {numbering && p.shopNumber != null && (
                        <span className="absolute top-1.5 left-1.5 min-w-[22px] h-[22px] px-1 text-white text-[11px] font-bold rounded-full flex items-center justify-center shadow-sm" style={{ backgroundColor: themeColor }}>
                          {p.shopNumber}
                        </span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-[12px] font-medium text-gray-900 line-clamp-1">{p.name}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {dp > 0 && <span className="text-[12px] font-bold text-red-500">{dp}%</span>}
                        <span className="text-[13px] font-bold text-gray-900">{p.basePrice.toLocaleString()}원</span>
                      </div>
                      {dp > 0 && p.comparePrice && (
                        <span className="text-[9px] text-gray-400 line-through">{p.comparePrice.toLocaleString()}원</span>
                      )}
                      <div
                        className="mt-2 w-full py-1.5 rounded-lg text-[11px] font-semibold text-center transition-colors"
                        style={{ backgroundColor: themeColor + "18", color: themeColor }}
                      >
                        구매하기
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 현재 라이브 중 상품 탭 ── */}
        {activeTab === "live" && (
          <div className="space-y-6 animate-fade-in">
            {/* 수동 라이브 노출 상품 (isManualLive ON 상태, 라이브커머스 없을 때만) */}
            {manualLiveProducts.length > 0 && !currentLive && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <h2 className="text-[15px] font-bold text-gray-900">지금 라이브 중!</h2>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {manualLiveProducts.map((p, idx) => (
                    <Link
                      key={p.id}
                      href={`/products/${p.id}?${sellerId ? `sellerId=${sellerId}&` : ""}ref=${sellerSlug}`}
                      prefetch={true}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-red-50 border border-red-100 hover:bg-red-100 transition-colors"
                    >
                      <div className="relative flex-shrink-0">
                        <SafeImage src={p.thumbnail} placeholder={DEFAULT_PRODUCT_IMAGE} alt={p.name} width={56} height={56} fallbackText={p.name} className="w-14 h-14 rounded-lg object-cover" />
                        <HexNumBadge size={20} fontSize={9} className="absolute -top-1 -left-1">
                          {idx + 1}
                        </HexNumBadge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-gray-900 line-clamp-2">{p.name}</p>
                        <span className="text-[11px] font-bold text-gray-900 mt-1 block">
                          {p.basePrice.toLocaleString()}원
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 현재 라이브 중 - 상품 목록 (실제 라이브 커머스) */}
            {currentLive && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <h2 className="text-[15px] font-bold text-gray-900">지금 라이브 중!</h2>
                  <span className="text-[10px] text-gray-400">
                    <Icon name="Eye" size={9} className="inline mr-0.5" />{currentLive.viewerCount || 0}명 시청
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-3">{currentLive.title}</p>
                {currentLive.products.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    {currentLive.products.map((lp, idx) => {
                      const dp = lp.livePrice && lp.product.basePrice
                        ? Math.round(((lp.product.basePrice - lp.livePrice) / lp.product.basePrice) * 100) : 0;
                      const displayNum = (lp.sortOrder !== undefined && lp.sortOrder !== null) ? lp.sortOrder + 1 : idx + 1;
                      return (
                        <Link
                          key={lp.id}
                          href={`/products/${lp.product.id}?${sellerId ? `sellerId=${sellerId}&` : ""}ref=${sellerSlug}`}
                          prefetch={true}
                          className="flex items-center gap-2.5 p-2.5 rounded-xl bg-red-50 border border-red-100 hover:bg-red-100 transition-colors"
                        >
                          <div className="relative flex-shrink-0">
                            <SafeImage src={lp.product.thumbnail} placeholder={DEFAULT_PRODUCT_IMAGE} alt={lp.product.name} width={56} height={56} fallbackText={lp.product.name} className="w-14 h-14 rounded-lg object-cover" />
                            <HexNumBadge size={20} fontSize={9} className="absolute -top-1 -left-1">
                              {displayNum}
                            </HexNumBadge>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-gray-900 line-clamp-2">{lp.product.name}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              {dp > 0 && <span className="text-[11px] font-bold text-red-500">{dp}%</span>}
                              <span className="text-[11px] font-bold text-gray-900">
                                {(lp.livePrice || lp.product.basePrice).toLocaleString()}원
                              </span>
                            </div>
                            {lp.livePrice && (
                              <span className="text-[9px] text-gray-400 line-through">
                                {lp.product.basePrice.toLocaleString()}원
                              </span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-4">등록된 상품이 없습니다</p>
                )}
              </div>
            )}

            {/* 예정 라이브 */}
            {scheduledLives.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="Live" size={14} className="text-blue-500" />
                  <h2 className="text-[15px] font-bold text-gray-900">예정된 라이브</h2>
                </div>
                <div className="space-y-2">
                  {scheduledLives.map((live) => (
                    <div
                      key={live.id}
                      className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100"
                    >
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Icon name="Live" size={16} className="text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{live.title}</p>
                        <p className="text-[10px] text-blue-500 mt-0.5">
                          {live.scheduledAt ? new Date(live.scheduledAt).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "시간 미정"}
                        </p>
                        {live.products.length > 0 && (
                          <p className="text-[10px] text-gray-400 mt-0.5">상품 {live.products.length}개</p>
                        )}
                      </div>
                      <span className="text-[10px] bg-blue-200 text-blue-700 px-2 py-0.5 rounded-full font-medium">예정</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 라이브 없음 */}
            {!currentLive && scheduledLives.length === 0 && manualLiveProducts.length === 0 && (
              <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl">
                <Icon name="Live" size={36} strokeWidth={1.5} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">현재 진행 중이거나 예정된 라이브가 없습니다</p>
                {showPastTab && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("past")}
                    className="mt-3 text-[11px] font-semibold underline"
                    style={{ color: themeColor }}
                  >
                    지난 방송 상품 보기 →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 지난 방송 상품 탭 ── */}
        {activeTab === "past" && (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="Calendar" size={14} className="text-gray-500" />
              <h2 className="text-[15px] font-bold text-gray-900">지난 방송 상품</h2>
              <span className="text-[10px] text-gray-400">{endedLives.length}회 방송</span>
            </div>

            {/* 실제 라이브 커머스 지난 방송 */}
            {endedLives.map((live) => {
              const isOpen = openLiveId === live.id;
              const minPrice = liveMinPrice(live);
              return (
                <div key={live.id} className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
                  <button
                    type="button"
                    onClick={() => setOpenLiveId(isOpen ? null : live.id)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-amber-100 flex-shrink-0">
                      {live.thumbnailImage ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={live.thumbnailImage} alt={live.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                        </>
                      ) : (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/favicon.svg" alt="라이브 방송" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-amber-600/70 to-transparent" />
                        </>
                      )}
                      <div className="absolute bottom-1 left-0 right-0 text-center text-white font-bold text-[7px] drop-shadow leading-tight px-0.5">
                        {formatThumbnailDate(live.endedAt || live.startedAt)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                        <Icon name="Calendar" size={10} />
                        <span>{formatBroadcastDate(live.endedAt || live.startedAt)}</span>
                      </div>
                      <p className="text-[13px] font-bold text-gray-900 truncate mt-0.5">{live.title}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <Icon name="Video" size={10} /> 상품 {live.products.length}개
                        </span>
                        <span className="text-[10px] text-gray-300 flex items-center gap-0.5">
                          <Icon name="Eye" size={10} /> {(live.peakViewerCount || live.viewerCount || 0).toLocaleString()}명
                        </span>
                      </div>
                      {minPrice !== null && (
                        <p className="text-[12px] font-bold text-gray-900 mt-1">
                          <span className="text-[9px] font-normal text-gray-400 mr-0.5">최저</span>
                          {minPrice.toLocaleString()}원~
                        </p>
                      )}
                    </div>
                    <Icon name="ChevronDown" size={18} className={`text-gray-300 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-50 px-3 pb-3 pt-1 animate-fade-in">
                      {live.products.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2.5 mt-2">
                          {live.products.map((lp, idx) => {
                            const dp = lp.livePrice && lp.product.basePrice
                              ? Math.round(((lp.product.basePrice - lp.livePrice) / lp.product.basePrice) * 100) : 0;
                            const displayNum = (lp.sortOrder !== undefined && lp.sortOrder !== null) ? lp.sortOrder + 1 : idx + 1;
                            return (
                              <Link
                                key={lp.id}
                                href={`/products/${lp.product.id}?${sellerId ? `sellerId=${sellerId}&` : ""}ref=${sellerSlug}`}
                                prefetch={true}
                                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-red-50 border border-red-100 hover:bg-red-100 transition-colors"
                              >
                                <div className="relative flex-shrink-0">
                                  <SafeImage src={lp.product.thumbnail} placeholder={DEFAULT_PRODUCT_IMAGE} alt={lp.product.name} width={56} height={56} fallbackText={lp.product.name} className="w-14 h-14 rounded-lg object-cover" />
                                  <HexNumBadge size={20} fontSize={9} className="absolute -top-1 -left-1">
                                    {displayNum}
                                  </HexNumBadge>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-medium text-gray-900 line-clamp-2">{lp.product.name}</p>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    {dp > 0 && <span className="text-[11px] font-bold text-red-500">{dp}%</span>}
                                    <span className="text-[11px] font-bold text-gray-900">
                                      {(lp.livePrice || lp.product.basePrice).toLocaleString()}원
                                    </span>
                                  </div>
                                  {lp.livePrice && (
                                    <span className="text-[9px] text-gray-400 line-through">
                                      {lp.product.basePrice.toLocaleString()}원
                                    </span>
                                  )}
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[10px] text-gray-400 py-4 text-center">등록된 상품이 없습니다</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── 공구 탭 ── */}
        {activeTab === "campaigns" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: themeColor }} />
              <h2 className="text-[15px] font-bold text-gray-900">진행 중인 공구</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {campaigns.map((campaign: any) => (
                <Link
                  key={campaign.id}
                  href={`/campaigns/${campaign.id}`}
                  prefetch={true}
                  className="group block rounded-xl overflow-hidden bg-white border border-gray-100 hover:shadow-md transition-all"
                >
                  <div className="aspect-[4/5] overflow-hidden bg-gray-100 relative">
                    <SafeImage
                      src={campaign.product?.thumbnail}
                      alt={campaign.product?.name || campaign.title}
                      width={220}
                      height={275}
                      fallbackText={campaign.product?.name || "상품"}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {campaign.status === "ACTIVE" && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">진행중</span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-medium text-gray-900 truncate">{campaign.product?.name || campaign.title}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {campaign.originalPrice > campaign.campaignPrice && (
                        <span className="text-xs font-bold text-red-500">
                          {Math.round(((campaign.originalPrice - campaign.campaignPrice) / campaign.originalPrice) * 100)}%
                        </span>
                      )}
                      <span className="text-sm font-bold text-gray-900">{campaign.campaignPrice.toLocaleString()}원</span>
                    </div>
                    {campaign.originalPrice > campaign.campaignPrice && (
                      <span className="text-[10px] text-gray-400 line-through">{campaign.originalPrice.toLocaleString()}원</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── 일반상품 탭 (셀러 직접 등록) ── */}
        {activeTab === "direct" && (
          <div className="animate-fade-in">
            {directProducts.length === 0 ? (
              <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
                <Icon name="Package" size={36} strokeWidth={1.5} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">등록된 상품이 없습니다</p>
              </div>
            ) : (
            <div className="grid grid-cols-2 gap-3">
              {directProducts.map((p) => (
                <div
                  key={p.id}
                  className="group rounded-xl overflow-hidden bg-white border border-gray-100 hover:shadow-md transition-all"
                >
                  <div className="aspect-square overflow-hidden bg-gray-100 relative">
                    <SafeImage src={p.images[0] || null} placeholder={DEFAULT_PRODUCT_IMAGE} alt={p.name} width={200} height={200} fallbackText={p.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                  <div className="p-2.5">
                    <p className="text-[12px] font-medium text-gray-900 line-clamp-1">{p.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[13px] font-bold text-gray-900">{p.price.toLocaleString()}원</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {p.shippingFee > 0 ? `배송비 ${p.shippingFee.toLocaleString()}원` : "무료배송"}
                    </p>
                    {/* 일반상품(DirectProduct) 구매 — type=direct 로 체크아웃 진입.
                        비로그인 상태면 체크아웃 페이지가 로그인으로 리다이렉트한다. */}
                    {p.stock <= 0 || !sellerId ? (
                      <button
                        type="button"
                        disabled
                        className="mt-2 w-full py-1.5 rounded-lg text-[11px] font-semibold text-center bg-gray-100 text-gray-400 cursor-not-allowed"
                      >
                        품절
                      </button>
                    ) : (
                      <Link
                        href={`/checkout?type=direct&productId=${p.id}&sellerId=${sellerId}&quantity=1`}
                        className="mt-2 block w-full py-1.5 rounded-lg text-[11px] font-semibold text-center transition-colors"
                        style={{ backgroundColor: themeColor + "18", color: themeColor }}
                      >
                        구매하기
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        )}

      </div>
    </div>
    <ProductBottomSheet
      productId={bottomSheetProductId}
      sellerId={sellerId || null}
      sellerSlug={sellerSlug}
      themeColor={themeColor}
      onClose={() => setBottomSheetProductId(null)}
    />
  </>
);
}
