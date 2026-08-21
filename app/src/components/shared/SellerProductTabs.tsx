"use client";

import { Icon } from '@/components/shared/Icon';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {Package, ShoppingBag, Radio, Loader2, X, LayoutList, Filter, MessageCircle, Ban, PencilLine, XCircle} from 'lucide-react';
import SafeImage from "@/components/shared/SafeImage";
import HexNumBadge from "@/components/shared/HexNumBadge";
import { DEFAULT_PRODUCT_IMAGE } from "@/lib/defaults";
import SellerProductRequest from "@/components/shared/SellerProductRequest";
import ProductDetailModal from "@/components/shared/ProductDetailModal";
import ProductItemActions from "@/components/shared/ProductItemActions";
import ProductChatPanel from "@/components/shared/ProductChatPanel";
import { useAppDialog } from "@/components/shared/AppDialog";
import { useFeatureFlags } from "@/components/shared/FeatureFlagsProvider";
import SellerDirectProducts from "@/components/shared/SellerDirectProducts";
import Pagination, { usePagination } from "@/components/shared/Pagination";

interface ProductInfo {
  id: string;
  name: string;
  thumbnail: string | null;
  basePrice: number;
  comparePrice?: number | null;
  isActive?: boolean;
  sellerId?: string | null;
  brand: { brandName: string } | null;
  category: { name: string } | null;
  reviewCount: number;
  description?: string | null;
  totalStock?: number;
}

interface ShopProductItem {
  id: string;
  isActive: boolean;
  isApproved?: boolean;
  rejectionReason?: string | null;
  commissionRate?: number;
  product: ProductInfo;
}

interface CampaignItem {
  id: string;
  title: string;
  status: string;
  campaignPrice: number;
  originalPrice: number;
  participantCount: number;
  currentQuantity: number;
  goalQuantity: number | null;
  startDate: string;
  endDate: string;
  product: ProductInfo;
}

interface LiveStreamItem {
  id: string;
  title: string;
  status: string;
  shareCode: string;
  viewerCount: number;
  startedAt: string | null;
  endedAt: string | null;
  products: {
    id: string;
    livePrice: number | null;
    sortOrder: number;
    product: ProductInfo;
  }[];
}

interface AvailableProduct {
  id: string;
  name: string;
  thumbnail: string | null;
  basePrice: number;
  // 셀러 노출 공급가 (공급가 + 중간관리자 마진). 판매가는 셀러가 직접 설정.
  supplyPrice?: number;
  // 제공 방식: SUPPLY(공급가 제공) / COMMISSION(수수료 제공)
  priceModel?: "SUPPLY" | "COMMISSION";
  commissionRate?: number | null;
  brandId?: string | null;
  brandName: string | null;
  categoryName: string | null;
  // 외부 최저가 참고용
  coupangLowestPrice?: number | null;
  naverLowestPrice?: number | null;
}

interface TabData {
  shopProducts: ShopProductItem[];
  campaigns: CampaignItem[];
  liveStreams: LiveStreamItem[];
  brands?: { id: string; brandName: string }[];
  currentUserId?: string;
  currentSellerId?: string;
  availableProductsCount?: number;
  directProductCount?: number;
}

const formatPrice = (n: number) => n.toLocaleString("ko-KR") + "원";

// 상품 신청 탭: 서버 페이지네이션 페이지당 개수
const REQUEST_PAGE_SIZE = 20;

const statusColors: Record<string, { label: string; bg: string; text: string }> = {
  ACTIVE: { label: "진행중", bg: "bg-emerald-50", text: "text-emerald-600" },
  SCHEDULED: { label: "예정", bg: "bg-blue-50", text: "text-blue-600" },
  ENDED: { label: "종료", bg: "bg-gray-100", text: "text-gray-500" },
  CANCELLED: { label: "취소", bg: "bg-red-50", text: "text-red-500" },
  LIVE: { label: "라이브중", bg: "bg-red-50", text: "text-red-600" },
  SUCCESS: { label: "성공", bg: "bg-green-50", text: "text-green-600" },
};

export default function SellerProductTabs({ data }: { data: TabData }) {
  const { shopProducts, campaigns, liveStreams, brands = [], currentUserId, currentSellerId, availableProductsCount, directProductCount } = data;
  const { appConfirm, appAlert } = useAppDialog();
  const router = useRouter();
  // 상품신청 메뉴 노출은 최고관리자 권한설정(productRequest 토글)을 따른다.
  const flags = useFeatureFlags();
  // 단일 5탭: 승인대기 / 판매중 / 판매중지 / 상품 신청 / 일반상품
  const [tab, setTab] = useState<"pending" | "active" | "paused" | "request" | "direct">("active");
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [showGroupBuyApply, setShowGroupBuyApply] = useState(false);
  const [showLiveApply, setShowLiveApply] = useState(false);
  const [applyLoading, setApplyLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // ★ 상품신청 영역 검색 + 뷰모드
  const [requestSearch, setRequestSearch] = useState("");
  const [requestViewMode, setRequestViewMode] = useState<"card" | "list">("list");
  // ★ 상품신청 브랜드별 필터
  const [requestBrandFilter, setRequestBrandFilter] = useState("");
  // ★ 상품신청 제공 방식 필터 (전체/공급가/수수료)
  const [priceModelFilter, setPriceModelFilter] = useState<"ALL" | "SUPPLY" | "COMMISSION">("ALL");
  // ★ 상세 보기 모달
  const [detailProduct, setDetailProduct] = useState<ShopProductItem | null>(null);
  // ★ 내 분양몰 추가 로딩
  const [addToShopLoading, setAddToShopLoading] = useState<string | null>(null);
  // ★ 바닐라 플라워 팝업 상태
  const [beePopup, setBeePopup] = useState<{ show: boolean; isLive: boolean }>({ show: false, isLive: false });
  // 해당 상품이 셀러 본인이 직접 등록한 상품인지 판별
  const isOwnProduct = (sp: ShopProductItem) => !!currentSellerId && sp.product.sellerId === currentSellerId;

  const activeProducts = shopProducts.filter((sp) => sp.isActive && sp.isApproved);
  const pausedProducts = shopProducts.filter((sp) => !sp.isActive && sp.isApproved);
  // 반려된 신청 (사유 있음) 과 순수 승인 대기 분리
  const rejectedProducts = shopProducts.filter((sp) => !sp.isApproved && !!sp.rejectionReason);
  const pendingProducts = shopProducts.filter((sp) => !sp.isApproved && !sp.rejectionReason);

  // 검색 필터
  const filteredActive = activeProducts.filter(sp =>
    !searchQuery.trim() || sp.product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredPending = pendingProducts.filter(sp =>
    !searchQuery.trim() || sp.product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredRejected = rejectedProducts.filter(sp =>
    !searchQuery.trim() || sp.product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredPaused = pausedProducts.filter(sp =>
    !searchQuery.trim() || sp.product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 탭별 리스트 페이지네이션 (페이지당 20개) — 카드/리스트 뷰 공용
  const activePg = usePagination(filteredActive, 20);
  const pendingPg = usePagination(filteredPending, 20);
  const rejectedPg = usePagination(filteredRejected, 20);
  const pausedPg = usePagination(filteredPaused, 20);

  // ★ 상품 신청 탭 — 검색/필터/페이지네이션 모두 서버(GET /api/products/request)에서 처리한다.
  //    전체 목록을 클라이언트로 내려받지 않으므로 상품 수가 늘어나도 페이지 이동이 정상 동작한다.
  const [requestSearchDebounced, setRequestSearchDebounced] = useState("");
  const [requestPage, setRequestPage] = useState(1);
  const [requestItems, setRequestItems] = useState<AvailableProduct[]>([]);
  const [requestTotalPages, setRequestTotalPages] = useState(1);
  const [requestTotal, setRequestTotal] = useState(0);
  const [requestLoading, setRequestLoading] = useState(false);
  // 최초 응답 수신 여부 — 로딩과 "결과 없음"을 구분하기 위함
  const [requestLoaded, setRequestLoaded] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  // 검색어 디바운스 (입력할 때마다 조회하지 않도록)
  useEffect(() => {
    const timer = setTimeout(() => setRequestSearchDebounced(requestSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [requestSearch]);

  // 검색어/필터가 바뀌면 1페이지로 되돌린다
  useEffect(() => {
    setRequestPage(1);
  }, [requestSearchDebounced, requestBrandFilter, priceModelFilter]);

  // 상품 신청 목록 조회 — 탭을 열었을 때만 요청한다
  useEffect(() => {
    if (tab !== "request" || !flags.productRequest) return;

    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(requestPage),
      pageSize: String(REQUEST_PAGE_SIZE),
    });
    if (requestSearchDebounced) params.set("search", requestSearchDebounced);
    if (requestBrandFilter) params.set("brandId", requestBrandFilter);
    if (priceModelFilter !== "ALL") params.set("priceModel", priceModelFilter);

    setRequestLoading(true);
    setRequestError(null);

    fetch(`/api/products/request?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "조회 실패");
        return res.json();
      })
      .then((d) => {
        setRequestItems(d.products ?? []);
        setRequestTotal(d.total ?? 0);
        setRequestTotalPages(d.totalPages ?? 1);
        // 서버가 범위를 벗어난 페이지를 보정한 경우 동기화
        if (typeof d.page === "number" && d.page !== requestPage) setRequestPage(d.page);
        setRequestLoaded(true);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setRequestItems([]);
        setRequestTotal(0);
        setRequestTotalPages(1);
        setRequestError(err?.message || "조회 실패");
        setRequestLoaded(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRequestLoading(false);
      });

    return () => controller.abort();
  }, [tab, flags.productRequest, requestPage, requestSearchDebounced, requestBrandFilter, priceModelFilter]);

  // 내 상품 목록 (AvailableProduct 형태로 변환)
  const myProductsForModal: AvailableProduct[] = shopProducts.map(sp => ({
    id: sp.product.id,
    name: sp.product.name,
    thumbnail: sp.product.thumbnail,
    basePrice: sp.product.basePrice,
    brandName: sp.product.brand?.brandName || null,
    categoryName: sp.product.category?.name || null,
  }));
  const myProductIds = new Set(shopProducts.map(sp => sp.product.id));

  const handleApplyProduct = async (productId: string, type: "groupbuy" | "live", isOwn: boolean) => {
    setApplyLoading(productId);
    try {
      await new Promise(r => setTimeout(r, 500));
      if (isOwn) {
        await appAlert(`${type === "groupbuy" ? "공동구매" : "라이브커머스"} 상품이 추가되었습니다.`);
      } else {
        await appAlert(`${type === "groupbuy" ? "공동구매" : "라이브커머스"} 상품 신청이 완료되었습니다. 브랜드 승인 후 판매가 가능합니다.`);
      }
      if (type === "groupbuy") setShowGroupBuyApply(false);
      else setShowLiveApply(false);
    } catch {} finally { setApplyLoading(null); }
  };

  // ★ 내 분양몰에 추가 핸들러 (바닐라 플라워 팝업)
  const handleAddToMyShop = async (productId: string) => {
    setAddToShopLoading(productId);
    try {
      await new Promise(r => setTimeout(r, 600));
      // 라이브 진행 중 + 해당 상품이 라이브에 포함되어 있으면 라이브 메시지
      const activeLive = liveStreams.find(ls => ls.status === "LIVE");
      const isInLive = activeLive
        ? activeLive.products.some(lp => lp.product.id === productId)
        : false;
      setBeePopup({ show: true, isLive: !!(activeLive && isInLive) });
      setDetailProduct(null);
    } catch {} finally { setAddToShopLoading(null); }
  };

  // ★ 판매중지/재시작/삭제 핸들러
  const [shopActionLoading, setShopActionLoading] = useState<string | null>(null);
  const handleShopProductAction = async (shopProductId: string, productId: string, action: "pauseSale" | "startSale" | "delete", productName?: string) => {
    if (action === "delete") {
      // 되돌릴 수 없는 동작이므로 어떤 상품인지 함께 보여준다.
      const target = productName ? `“${productName}”\n\n` : "";
      if (!await appConfirm({ message: `${target}정말 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`, type: "warning", confirmText: "삭제" })) return;
    }
    setShopActionLoading(shopProductId);
    try {
      const res = await fetch("/api/products/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, shopProductId, action }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        appAlert({ message: data.error || "작업 실패", type: "warning" });
      }
    } catch {
      await appAlert("오류가 발생했습니다.");
    }
    setShopActionLoading(null);
  };

  // ★ 신청 취소 (승인 대기 중인 타인 등록 상품 신청건 삭제)
  const [cancelLoading, setCancelLoading] = useState<string | null>(null);
  const handleCancelRequest = async (shopProductId: string) => {
    if (!await appConfirm({ message: "상품 신청을 취소하시겠습니까?", type: "warning", confirmText: "신청 취소" })) return;
    setCancelLoading(shopProductId);
    try {
      const res = await fetch(`/api/seller/shop-products/${shopProductId}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        await appAlert({ message: data.error || "신청 취소에 실패했습니다.", type: "warning" });
        setCancelLoading(null);
      }
    } catch {
      await appAlert("오류가 발생했습니다.");
      setCancelLoading(null);
    }
  };

  // 단일 5탭 구성 (상품 신청 탭은 최고관리자 권한설정 토글에 따라 노출)
  const tabItems: { key: typeof tab; label: string; count: number | null }[] = [
    { key: "pending", label: "승인대기", count: pendingProducts.length },
    { key: "active", label: "판매중", count: activeProducts.length },
    { key: "paused", label: "판매중지", count: pausedProducts.length },
    // 탭 배지는 필터와 무관한 신청 가능 전체 수를 보여준다 (서버에서 별도 count)
    ...(flags.productRequest ? [{ key: "request" as const, label: "상품 신청", count: availableProductsCount ?? 0 }] : []),
    { key: "direct", label: "일반상품(빠른상품 등록)", count: directProductCount ?? null },
  ];

  return (
    <div>
      {/* ── 단일 5탭 바 ── */}
      <div className="flex items-center gap-1 mb-5 border-b border-gray-100 overflow-x-auto">
        {tabItems.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === key ? "border-brand-500 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {label}
            {count !== null && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none ${
                tab === key ? "bg-brand-100 text-brand-600" : "bg-gray-100 text-gray-400"
              }`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── 일반상품 탭 (셀러 직접 등록) ── */}
      {tab === "direct" && <SellerDirectProducts />}

      {/* ── 승인대기 / 판매중 / 판매중지 탭 (검색·뷰토글 공유) ── */}
      {(tab === "pending" || tab === "active" || tab === "paused") && (
        <div className="space-y-5 animate-fade-in">

          {/* ★ 검색 + 뷰 토글 */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="상품명 검색..."
                className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-200 bg-white"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>
            {/* ★ 리스트/카드 뷰 토글 */}
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
              <button
                onClick={() => setViewMode("card")}
                className={`p-2 transition-colors ${viewMode === "card" ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:text-gray-600"}`}
                title="카드 보기"
              >
                <Icon name="Category" size={16} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 transition-colors ${viewMode === "list" ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:text-gray-600"}`}
                title="리스트 보기"
              >
                <LayoutList size={16} />
              </button>
            </div>
          </div>

          {/* 판매중지 상품 */}
          {tab === "paused" && (filteredPaused.length > 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <Icon name="Pause" size={16} strokeWidth={1.5} className="text-amber-500" />
                <h2 className="text-sm font-bold text-amber-700">판매중지</h2>
                <span className="text-[10px] bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full font-medium">{filteredPaused.length}개</span>
              </div>
              
              {viewMode === "card" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {pausedPg.pageItems.map((sp) => (
                    <div key={sp.product.id} className="bg-amber-50 rounded-lg border border-amber-100 overflow-hidden opacity-80">
                      <div className="h-28 bg-gray-100 relative overflow-hidden">
                        <SafeImage src={sp.product.thumbnail} placeholder={DEFAULT_PRODUCT_IMAGE} alt={sp.product.name} width={200} height={200} fallbackText="P" className="w-full h-full object-contain grayscale-[30%]" />
                        <span className="absolute top-1 left-1 text-[9px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full leading-none">중지</span>
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-medium text-gray-900 truncate">{sp.product.name}</p>
                        <p className="text-xs font-bold text-gray-900 mt-0.5">{formatPrice(sp.product.basePrice)}</p>
                        {/* 노출 스위치 */}
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-[10px] text-gray-400">비노출</span>
                          <div className="flex items-center gap-1">
                            {shopActionLoading === sp.id ? (
                              <Loader2 size={10} className="animate-spin text-gray-400" />
                            ) : (
                              <button
                                onClick={() => handleShopProductAction(sp.id, sp.product.id, "startSale")}
                                className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors bg-gray-300"
                                title="노출로 전환"
                              >
                                <span className="inline-block h-3 w-3 transform rounded-full bg-white transition-transform translate-x-0.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleShopProductAction(sp.id, sp.product.id, "delete", sp.product.name)}
                              className="text-[10px] py-1 px-1.5 bg-red-50 text-red-500 rounded-lg font-medium hover:bg-red-100 transition-colors flex items-center justify-center"
                              title="삭제"
                            >
                              <Icon name="Delete" size={14} />
                            </button>
                          </div>
                        </div>
                        {/* ★ 셀러 본인 등록 상품: 상품수정 버튼 (카드 하단) */}
                        {isOwnProduct(sp) && (
                          <button
                            onClick={() => router.push(`/seller/products/${sp.product.id}/edit`)}
                            className="mt-1 w-full text-[10px] py-1.5 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
                          >
                            <PencilLine size={11} /> 상품수정
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-amber-50 rounded-xl border border-amber-100 overflow-hidden">
                  <div className="divide-y divide-amber-100">
                    {pausedPg.pageItems.map((sp) => (
                      <div key={sp.product.id} className="flex items-center gap-2.5 sm:gap-3 p-3 sm:p-4">
                        <div className="w-6 h-6 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          <SafeImage src={sp.product.thumbnail} placeholder={DEFAULT_PRODUCT_IMAGE} alt={sp.product.name} width={64} height={64} fallbackText="No Img" className={!sp.product.thumbnail || sp.product.thumbnail === '/no-image.png' ? 'w-6 h-6 object-contain' : 'w-full h-full object-cover'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] sm:text-sm font-medium text-gray-900 truncate">{sp.product.name}</p>
                          <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                            {sp.product.brand && <span className="text-[10px] text-gray-400">{sp.product.brand.brandName}</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[13px] sm:text-sm font-semibold">{formatPrice(sp.product.basePrice)}</p>
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600">
                            <Icon name="Pause" size={10} />
                            판매중지
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* 셀러 본인 등록 상품: 수정 버튼 */}
                          {isOwnProduct(sp) && (
                            <button
                              onClick={() => router.push(`/seller/products/${sp.product.id}/edit`)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400 hover:text-blue-600 transition-colors"
                              title="상품 수정"
                            >
                              <PencilLine size={15} />
                            </button>
                          )}
                          {/* 노출 스위치 (비노출 상태) */}
                          {shopActionLoading === sp.id ? (
                            <Loader2 size={14} className="animate-spin text-gray-400" />
                          ) : (
                            <button
                              onClick={() => handleShopProductAction(sp.id, sp.product.id, "startSale")}
                              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors bg-gray-300"
                              title="노출로 전환"
                            >
                              <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform translate-x-0.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleShopProductAction(sp.id, sp.product.id, "delete", sp.product.name)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                            title="삭제"
                          >
                            <Icon name="Delete" size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Pagination currentPage={pausedPg.page} totalPages={pausedPg.totalPages} onPageChange={pausedPg.setPage} />
            </div>
          ) : (
            <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
              <Icon name="Package" size={40} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">판매중지된 상품이 없습니다.</p>
            </div>
          ))}

          {/* 승인 대기 + 반려 */}
          {tab === "pending" && (filteredPending.length === 0 && filteredRejected.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
              <Icon name="Package" size={40} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">승인 대기 중인 상품이 없습니다.</p>
            </div>
          ) : (
          <>
          {filteredPending.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <Icon name="Clock" size={16} strokeWidth={1.5} className="text-yellow-600" />
                <h2 className="text-sm font-bold text-yellow-700">승인 대기</h2>
                <span className="text-[10px] bg-yellow-200 text-yellow-700 px-2 py-0.5 rounded-full font-medium">{filteredPending.length}개</span>
              </div>
              
              {viewMode === "card" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {pendingPg.pageItems.map((sp) => (
                    <div key={sp.product.id} className="bg-yellow-50 rounded-lg border border-yellow-100 overflow-hidden">
                      <div className="h-28 bg-gray-100 relative overflow-hidden">
                        <SafeImage src={sp.product.thumbnail} placeholder={DEFAULT_PRODUCT_IMAGE} alt={sp.product.name} width={200} height={200} fallbackText="P" className="w-full h-full object-contain" />
                        <span className="absolute top-1 left-1 text-[9px] font-bold bg-yellow-500 text-white px-1.5 py-0.5 rounded-full leading-none">대기</span>
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-medium text-gray-900 truncate">{sp.product.name}</p>
                        <p className="text-xs font-bold text-gray-900 mt-0.5">{formatPrice(sp.product.basePrice)}</p>
                        {/* 타인(브랜드/관리자) 등록 상품 신청건: 신청 취소 */}
                        {!isOwnProduct(sp) && (
                          cancelLoading === sp.id ? (
                            <div className="mt-1.5 flex items-center justify-center py-1.5">
                              <Loader2 size={12} className="animate-spin text-gray-400" />
                            </div>
                          ) : (
                            <button
                              onClick={() => handleCancelRequest(sp.id)}
                              className="mt-1.5 w-full text-[10px] py-1.5 bg-red-50 text-red-500 rounded-lg font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-1"
                            >
                              <XCircle size={11} /> 신청 취소
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-yellow-50 rounded-xl border border-yellow-100 overflow-hidden">
                  <div className="divide-y divide-yellow-100">
                    {pendingPg.pageItems.map((sp) => (
                      <div key={sp.product.id} className="flex items-center gap-3 p-3">
                        <div className="w-6 h-6 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                          <SafeImage src={sp.product.thumbnail} placeholder={DEFAULT_PRODUCT_IMAGE} alt={sp.product.name} width={40} height={40} fallbackText="P" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{sp.product.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {sp.product.brand && <span className="text-[10px] text-gray-400">{sp.product.brand.brandName}</span>}
                            <span className="text-[10px] text-yellow-600">승인 대기 중</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-bold text-gray-900">{formatPrice(sp.product.basePrice)}</p>
                          <span className="text-[9px] text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full">대기</span>
                        </div>
                        {/* 타인(브랜드/관리자) 등록 상품 신청건: 신청 취소 */}
                        {!isOwnProduct(sp) && (
                          cancelLoading === sp.id ? (
                            <Loader2 size={14} className="animate-spin text-gray-400 flex-shrink-0" />
                          ) : (
                            <button
                              onClick={() => handleCancelRequest(sp.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                              title="신청 취소"
                            >
                              <XCircle size={16} />
                            </button>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Pagination currentPage={pendingPg.page} totalPages={pendingPg.totalPages} onPageChange={pendingPg.setPage} />
            </div>
          )}

          {/* 반려됨 — 승인 주체가 반려한 신청 (사유 표시) */}
          {filteredRejected.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <Ban size={16} strokeWidth={1.5} className="text-red-500" />
                <h2 className="text-sm font-bold text-red-600">반려됨</h2>
                <span className="text-[10px] bg-red-200 text-red-700 px-2 py-0.5 rounded-full font-medium">{filteredRejected.length}개</span>
              </div>
              <div className="bg-white rounded-xl border border-red-100 overflow-hidden">
                <div className="divide-y divide-red-50">
                  {rejectedPg.pageItems.map((sp) => (
                    <div key={sp.id} className="flex items-start gap-3 p-3">
                      <div className="w-6 h-6 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 mt-0.5">
                        <SafeImage src={sp.product.thumbnail} placeholder={DEFAULT_PRODUCT_IMAGE} alt={sp.product.name} width={40} height={40} fallbackText="P" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{sp.product.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {sp.product.brand && <span className="text-[10px] text-gray-400">{sp.product.brand.brandName}</span>}
                          <span className="text-[10px] text-red-500 bg-red-100 px-1.5 py-0.5 rounded-full font-medium">반려</span>
                        </div>
                        {/* 반려 사유 */}
                        <div className="mt-1.5 flex items-start gap-1 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5" title={sp.rejectionReason || undefined}>
                          <Ban size={11} className="shrink-0 mt-0.5" />
                          <span className="leading-snug">반려 사유: {sp.rejectionReason}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-gray-900">{formatPrice(sp.product.basePrice)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Pagination currentPage={rejectedPg.page} totalPages={rejectedPg.totalPages} onPageChange={rejectedPg.setPage} />
            </div>
          )}
          </>
          ))}

          {/* ★ 판매중 상품 (기존 '활성 상품') */}
          {tab === "active" && (filteredActive.length > 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <Icon name="Check" size={16} strokeWidth={1.5} className="text-green-600" />
                <h2 className="text-sm font-bold text-green-700">판매중 상품</h2>
                <span className="text-[10px] bg-green-200 text-green-700 px-2 py-0.5 rounded-full font-medium">{filteredActive.length}개</span>
              </div>
              
              {viewMode === "card" ? (
                /* ★ 카드 뷰 — 5개/줄 */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {activePg.pageItems.map((sp) => (
                    <div key={sp.product.id} className="bg-white rounded-lg border border-gray-100 overflow-hidden hover:shadow-md transition-all group">
                      <div className="h-28 bg-gray-100 relative overflow-hidden">
                        <SafeImage src={sp.product.thumbnail} placeholder={DEFAULT_PRODUCT_IMAGE} alt={sp.product.name} width={200} height={200} fallbackText="No Img" className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" />
                        <span className="absolute top-1 left-1 flex items-center gap-0.5 text-[9px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                          <span className="w-1.5 h-1.5 bg-white rounded-full" /> 판매중
                        </span>
                        {sp.product.reviewCount > 0 && (
                          <span className="absolute top-1 right-1 flex items-center gap-0.5 text-[9px] bg-white/90 text-gray-600 px-1.5 py-0.5 rounded-full backdrop-blur-sm leading-none">
                            <Icon name="Star" size={8} className="fill-amber-400 text-amber-400" /> {sp.product.reviewCount}
                          </span>
                        )}
                      </div>
                      <div className="p-2">
                        <div className="flex items-center gap-0.5 mb-0.5">
                          {sp.product.brand && <span className="text-[10px] text-gray-400 truncate">{sp.product.brand.brandName}</span>}
                        </div>
                        <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-tight mb-0.5">{sp.product.name}</p>
                        <p className="text-sm font-bold text-gray-900">{formatPrice(sp.product.basePrice)}</p>
                        {/* ★ 상세보기 + 브랜드채팅 */}
                        <div className="mt-1.5 flex items-center gap-1">
                          <button
                            onClick={() => setDetailProduct(sp)}
                            className="flex-1 text-[10px] py-1.5 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-0.5"
                          >
                            <Icon name="Info" size={10} /> 상세
                          </button>
                          {currentUserId && (
                            <ProductChatPanel
                              productId={sp.product.id}
                              productName={sp.product.name}
                              currentUserId={currentUserId}
                              className="flex-1 text-[10px] py-1.5 bg-purple-50 text-purple-600 rounded-lg font-medium hover:bg-purple-100 transition-colors flex items-center justify-center gap-0.5"
                            />
                          )}
                        </div>
                        {/* 노출 스위치 */}
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-[10px] text-gray-400">{sp.isActive ? "노출중" : "비노출"}</span>
                          <div className="flex items-center gap-1">
                            {shopActionLoading === sp.id ? (
                              <Loader2 size={10} className="animate-spin text-gray-400" />
                            ) : (
                              <button
                                onClick={() => handleShopProductAction(sp.id, sp.product.id, sp.isActive ? "pauseSale" : "startSale")}
                                className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${sp.isActive ? "bg-brand-500" : "bg-gray-300"}`}
                                title={sp.isActive ? "비노출로 전환" : "노출로 전환"}
                              >
                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${sp.isActive ? "translate-x-3.5" : "translate-x-0.5"}`} />
                              </button>
                            )}
                            <button
                              onClick={() => handleShopProductAction(sp.id, sp.product.id, "delete", sp.product.name)}
                              className="text-[10px] py-1 px-1.5 bg-red-50 text-red-500 rounded-lg font-medium hover:bg-red-100 transition-colors flex items-center justify-center"
                              title="삭제"
                            >
                              <Icon name="Delete" size={14} />
                            </button>
                          </div>
                        </div>
                        {/* ★ 셀러 본인 등록 상품: 상품수정 버튼 (카드 하단) */}
                        {isOwnProduct(sp) && (
                          <button
                            onClick={() => router.push(`/seller/products/${sp.product.id}/edit`)}
                            className="mt-1 w-full text-[10px] py-1.5 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
                          >
                            <PencilLine size={11} /> 상품수정
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* ★ 리스트 뷰 */
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="divide-y divide-gray-50">
                    {activePg.pageItems.map((sp) => (
                      <div key={sp.product.id} className="flex items-center gap-2.5 sm:gap-3 p-3 sm:p-4 hover:bg-gray-50 transition-colors">
                        <div className="w-6 h-6 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          <SafeImage src={sp.product.thumbnail} placeholder={DEFAULT_PRODUCT_IMAGE} alt={sp.product.name} width={64} height={64} fallbackText="No Img" className={!sp.product.thumbnail || sp.product.thumbnail === '/no-image.png' ? 'w-6 h-6 object-contain' : 'w-full h-full object-cover'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] sm:text-sm font-medium text-gray-900 truncate">{sp.product.name}</p>
                          <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                            {sp.product.brand && <span className="text-[10px] text-gray-400">{sp.product.brand.brandName}</span>}
                            {sp.product.category && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{sp.product.category.name}</span>}
                            <span className="text-[10px] text-gray-400">리뷰 {sp.product.reviewCount}</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[13px] sm:text-sm font-semibold">{formatPrice(sp.product.basePrice)}</p>
                          <span className="inline-flex items-center gap-1 text-[10px] text-green-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            판매중
                          </span>
                          {sp.commissionRate !== undefined && (
                            <span className="block text-[9px] text-brand-500 font-bold mt-0.5">커미션 {sp.commissionRate}%</span>
                          )}
                        </div>
                        {/* ★ 상세 + 브랜드채팅 + 판매관리 버튼 */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => setDetailProduct(sp)}
                            className="text-[10px] px-2 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 flex items-center gap-0.5"
                          >
                            <Icon name="Info" size={10} /> 상세
                          </button>
                          {currentUserId && (
                            <ProductChatPanel
                              productId={sp.product.id}
                              productName={sp.product.name}
                              currentUserId={currentUserId}
                            />
                          )}
                          {/* 셀러 본인 등록 상품: 수정 버튼 */}
                          {isOwnProduct(sp) && (
                            <button
                              onClick={() => router.push(`/seller/products/${sp.product.id}/edit`)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400 hover:text-blue-600 transition-colors"
                              title="상품 수정"
                            >
                              <PencilLine size={15} />
                            </button>
                          )}
                          {/* 노출 스위치 */}
                          {shopActionLoading === sp.id ? (
                            <Loader2 size={14} className="animate-spin text-gray-400" />
                          ) : (
                            <button
                              onClick={() => handleShopProductAction(sp.id, sp.product.id, sp.isActive ? "pauseSale" : "startSale")}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${sp.isActive ? "bg-brand-500" : "bg-gray-300"}`}
                              title={sp.isActive ? "비노출로 전환" : "노출로 전환"}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${sp.isActive ? "translate-x-4" : "translate-x-0.5"}`} />
                            </button>
                          )}
                          <button
                            onClick={() => handleShopProductAction(sp.id, sp.product.id, "delete", sp.product.name)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                            title="삭제"
                          >
                            <Icon name="Delete" size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Pagination currentPage={activePg.page} totalPages={activePg.totalPages} onPageChange={activePg.setPage} />
            </div>
          ) : (
            <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
              <Icon name="Package" size={40} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">판매중인 상품이 없습니다.</p>
            </div>
          ))}
        </div>
      )}

      {/* ── 상품 신청 탭 — 최고관리자 권한설정(상품신청 토글)이 켜진 경우에만 노출 ── */}
      {tab === "request" && flags.productRequest && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-2.5">
              <Icon name="Plus" size={16} strokeWidth={1.5} className="text-brand-500" />
              <h2 className="text-sm font-bold text-gray-700">상품 신청</h2>
            </div>
            <p className="text-xs text-gray-400 mb-3">아래 상품을 선택하면 브랜드 승인 후 샵에 추가됩니다.</p>

            {/* ★ 제공 방식 필터 (전체/공급가/수수료) */}
            <div className="flex gap-2 mb-3">
              {([
                { value: "ALL", label: "전체 상품" },
                { value: "SUPPLY", label: "공급가 제공" },
                { value: "COMMISSION", label: "수수료 제공" },
              ] as const).map((f) => (
                <button
                  key={f.value}
                  onClick={() => setPriceModelFilter(f.value)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    priceModelFilter === f.value
                      ? "bg-amber-400 text-white border-amber-400"
                      : "text-gray-600 border-gray-200 hover:border-amber-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* ★ 검색바 + 뷰 토글 */}
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={requestSearch}
                  onChange={e => setRequestSearch(e.target.value)}
                  placeholder="상품명, 브랜드 검색..."
                  className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-200 bg-white"
                />
                {requestSearch && (
                  <button onClick={() => setRequestSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
              {/* 브랜드별 필터 */}
              <select
                value={requestBrandFilter}
                onChange={e => setRequestBrandFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 flex-shrink-0"
              >
                <option value="">브랜드 선택</option>
                {brands.map(b => (
                  <option key={b.id} value={b.id}>{b.brandName}</option>
                ))}
              </select>
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                <button
                  onClick={() => setRequestViewMode("card")}
                  className={`p-2 transition-colors ${requestViewMode === "card" ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:text-gray-600"}`}
                  title="카드 보기"
                >
                  <Icon name="Category" size={16} />
                </button>
                <button
                  onClick={() => setRequestViewMode("list")}
                  className={`p-2 transition-colors ${requestViewMode === "list" ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:text-gray-600"}`}
                  title="리스트 보기"
                >
                  <LayoutList size={16} />
                </button>
              </div>
            </div>

            {/* 조회 결과 요약 / 로딩 표시 */}
            <div className="flex items-center gap-2 mb-2 h-4">
              {requestLoaded && !requestError && (
                <span className="text-[11px] text-gray-400">총 {requestTotal.toLocaleString("ko-KR")}개</span>
              )}
              {requestLoading && <Loader2 size={12} className="animate-spin text-gray-400" />}
            </div>

            {requestError ? (
              <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl">
                <XCircle size={32} strokeWidth={1.5} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">{requestError}</p>
              </div>
            ) : !requestLoaded ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : requestItems.length > 0 ? (
              requestViewMode === "list" ? (
                <div className={`space-y-2 transition-opacity ${requestLoading ? "opacity-50" : ""}`}>
                  {requestItems.map((product) => (
                    <SellerProductRequest key={product.id} product={product} />
                  ))}
                  <Pagination currentPage={requestPage} totalPages={requestTotalPages} onPageChange={setRequestPage} />
                </div>
              ) : (
                /* ★ 카드 뷰 (5개/줄) */
                <>
                <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 transition-opacity ${requestLoading ? "opacity-50" : ""}`}>
                  {requestItems.map((product) => (
                    <div key={product.id} className="bg-white rounded-lg border border-gray-100 overflow-hidden hover:shadow-md transition-all group">
                      <div className="h-28 bg-gray-100 relative overflow-hidden">
                        <SafeImage src={product.thumbnail} placeholder={DEFAULT_PRODUCT_IMAGE} alt={product.name} width={200} height={200} fallbackText="P" className="w-full h-full object-contain" />
                      </div>
                      <div className="p-2">
                        {product.brandName && <span className="text-[10px] text-gray-400 truncate block">{product.brandName}</span>}
                        <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-tight mb-0.5">{product.name}</p>
                        {product.priceModel === "COMMISSION" ? (
                          <>
                            <p className="text-[10px] text-gray-400 leading-tight">판매가</p>
                            <p className="text-sm font-bold text-gray-900">{formatPrice(product.basePrice)}</p>
                            <p className="text-[10px] text-brand-500 font-bold leading-tight mt-0.5">
                              {product.commissionRate != null ? `수수료 ${product.commissionRate}%` : "수수료 제공"}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-[10px] text-gray-400 leading-tight">공급가</p>
                            <p className="text-sm font-bold text-gray-900">{formatPrice(product.supplyPrice ?? product.basePrice)}</p>
                            <p className="text-[10px] text-gray-400 leading-tight mt-0.5">판매가는 직접 설정</p>
                          </>
                        )}
                        {(product.coupangLowestPrice || product.naverLowestPrice) && (
                          <div className="mt-1 flex flex-col gap-0.5">
                            {product.coupangLowestPrice && (
                              <span className="text-[9px] text-gray-400 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded truncate">
                                쿠팡 {formatPrice(product.coupangLowestPrice)}
                              </span>
                            )}
                            {product.naverLowestPrice && (
                              <span className="text-[9px] text-gray-400 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded truncate">
                                네이버 {formatPrice(product.naverLowestPrice)}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="mt-1.5 flex items-center gap-1">
                          <ProductDetailModal
                            productId={product.id}
                            productName={product.name}
                            triggerClassName="flex-1 text-[10px] py-1.5 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-0.5"
                            triggerLabel="자세히"
                          />
                          <button className="flex-1 text-[10px] py-1.5 bg-brand-50 text-brand-600 rounded-lg font-bold hover:bg-brand-100 transition-colors flex items-center justify-center gap-0.5">
                            <Icon name="Plus" size={10} /> 신청
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Pagination currentPage={requestPage} totalPages={requestTotalPages} onPageChange={setRequestPage} />
                </>
              )
            ) : (
              <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl">
                <Icon name="Search" size={32} strokeWidth={1.5} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">
                  {requestSearch || requestBrandFilter || priceModelFilter !== "ALL"
                    ? "검색 결과가 없습니다"
                    : "추가 가능한 상품이 없습니다"}
                </p>
              </div>
            )}
          </div>
          )}

      {/* ── ★ 상품 상세 보기 모달 (앱 스타일) ── */}
      {detailProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDetailProduct(null)} />
          <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col animate-slide-up sm:animate-scale-in overflow-hidden">
            {/* Handle bar (mobile) */}
            <div className="flex justify-center pt-2 sm:hidden">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                  <Icon name="Package" size={18} className="text-brand-600" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-gray-900">상품 상세정보</h3>
                  <p className="text-[10px] text-gray-400">상품 정보와 커미션을 확인하세요</p>
                </div>
              </div>
              <button onClick={() => setDetailProduct(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="px-5 pb-5 space-y-4">
                {/* 상품 이미지 */}
                <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden max-w-[260px] mx-auto">
                  <SafeImage
                    src={detailProduct.product.thumbnail}
                    alt={detailProduct.product.name}
                    width={280}
                    height={280}
                    fallbackText={detailProduct.product.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* 상품 정보 카드 */}
                <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                  {detailProduct.product.brand && (
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">{detailProduct.product.brand.brandName}</span>
                  )}
                  <p className="text-[15px] font-bold text-gray-900 leading-snug">{detailProduct.product.name}</p>
                  {detailProduct.product.category && (
                    <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full inline-block">{detailProduct.product.category.name}</span>
                  )}
                  <div className="flex items-baseline gap-2 pt-1">
                    {detailProduct.product.comparePrice && Number(detailProduct.product.comparePrice) > detailProduct.product.basePrice && (
                      <span className="text-sm text-gray-400 line-through">{formatPrice(Number(detailProduct.product.comparePrice))}</span>
                    )}
                    <span className="text-xl font-bold text-gray-900">{formatPrice(detailProduct.product.basePrice)}</span>
                  </div>
                </div>

                {/* 커미션 정보 */}
                {detailProduct.commissionRate !== undefined && (
                  <div className="bg-brand-50 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
                      <Icon name="Tag" size={16} className="text-brand-600" />
                    </div>
                    <div>
                      <p className="text-[11px] text-brand-500 font-medium">인플루언서 커미션</p>
                      <p className="text-lg font-bold text-brand-700">{detailProduct.commissionRate ?? 10}%</p>
                    </div>
                  </div>
                )}

                {/* 추가 정보 */}
                {detailProduct.product.description && (
                  <div className="text-xs text-gray-600 bg-gray-50 rounded-xl p-3.5 leading-relaxed">
                    {detailProduct.product.description}
                  </div>
                )}
                <div className="flex items-center gap-2.5 text-[11px] text-gray-500 flex-wrap">
                  <span className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full"><Icon name="Truck" size={11} /> 무료배송</span>
                  <span className="flex items-center gap-1 bg-green-50 text-green-600 px-2.5 py-1 rounded-full"><Icon name="Certified" size={11} /> 정품보장</span>
                  {detailProduct.product.totalStock !== undefined && (
                    <span className="flex items-center gap-1 bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full"><Icon name="Package" size={11} /> 재고 {detailProduct.product.totalStock}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <Icon name="Star" size={10} className="fill-amber-400 text-amber-400" />
                  <span className="text-gray-600">리뷰 {detailProduct.product.reviewCount}개</span>
                </div>
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 bg-gray-50/50 sm:rounded-b-2xl">
              <div className="flex gap-2">
                <Link
                  href={`/products/${detailProduct.product.id}`}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Icon name="Eye" size={14} /> 상세 페이지
                </Link>
                <button
                  onClick={() => handleAddToMyShop(detailProduct.product.id)}
                  disabled={addToShopLoading === detailProduct.product.id}
                  className="flex-1 py-3 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {addToShopLoading === detailProduct.product.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <><Icon name="Plus" size={16} /> 분양몰 추가</>
                  )}
                </button>
              </div>
            </div>
          </div>

          <style jsx>{`
            @keyframes slide-up { 0% { transform: translateY(100%); } 100% { transform: translateY(0); } }
            .animate-slide-up { animation: slide-up 0.3s ease-out; }
            @keyframes scale-in { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
            .animate-scale-in { animation: scale-in 0.2s ease-out; }
          `}</style>
        </div>
      )}

      {/* ── 바닐라 플라워 팝업 (분양몰 추가 완료) ── */}
      {beePopup.show && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setBeePopup({ show: false, isLive: false })} />
          <div className="relative w-full max-w-xs bg-gradient-to-b from-amber-50 to-yellow-100 border border-amber-300 rounded-3xl shadow-2xl p-6 flex flex-col items-center text-center animate-scale-in">
            {/* 바닐라 플라워 SVG */}
            <svg viewBox="0 0 40 40" className="w-16 h-16 mb-3">
              <ellipse cx="12" cy="16" rx="8" ry="4" fill="#93C5FD" opacity="0.8" transform="rotate(-20 12 16)"/>
              <ellipse cx="28" cy="16" rx="8" ry="4" fill="#93C5FD" opacity="0.8" transform="rotate(20 28 16)"/>
              <ellipse cx="20" cy="24" rx="8" ry="10" fill="#FDE047"/>
              <path d="M13 20 Q20 18 27 20" stroke="#1C1C1C" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <path d="M12 24 Q20 22 28 24" stroke="#1C1C1C" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <path d="M13 28 Q20 26 27 28" stroke="#1C1C1C" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <circle cx="20" cy="14" r="6" fill="#FDE047"/>
              <circle cx="17" cy="13" r="1.5" fill="#1C1C1C"/>
              <circle cx="23" cy="13" r="1.5" fill="#1C1C1C"/>
            </svg>
            <h3 className="text-base font-bold text-amber-800 mb-1.5">
              {beePopup.isLive ? "라이브에 추가 완료!" : "분양몰 추가 완료!"}
            </h3>
            <p className="text-sm text-amber-700 leading-relaxed">
              {beePopup.isLive
                ? "현재 라이브가 진행 중입니다!\n상품이 라이브에 추가되었습니다"
                : "내 분양몰에 상품이 추가되었습니다."}
            </p>
            <button
              onClick={() => setBeePopup({ show: false, isLive: false })}
              className="mt-5 w-full py-2.5 bg-amber-400 hover:bg-amber-500 text-white font-bold rounded-xl transition-colors text-sm"
            >
              확인
            </button>
          </div>
          <style jsx>{`
            @keyframes scale-in-bee { 0% { opacity: 0; transform: scale(0.85); } 100% { opacity: 1; transform: scale(1); } }
            .animate-scale-in { animation: scale-in-bee 0.25s ease-out; }
          `}</style>
        </div>
      )}
    </div>
  );
}

function ProductApplyModal({
  title, description, products, myProducts, myProductIds, type, onClose, onApply, loading, color,
}: {
  title: string;
  description: string;
  products: AvailableProduct[];
  myProducts: AvailableProduct[];
  myProductIds: Set<string>;
  type: "groupbuy" | "live";
  onClose: () => void;
  onApply: (productId: string, type: "groupbuy" | "live", isOwn: boolean) => void;
  loading: string | null;
  color: "emerald" | "red";
}) {
  const [search, setSearch] = useState("");
  const [showMyOnly, setShowMyOnly] = useState(false);

  const allProducts = [...myProducts, ...products];
  const displayProducts = showMyOnly ? myProducts : allProducts;
  const filtered = displayProducts.filter(p =>
    !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()) || (p.brandName && p.brandName.toLowerCase().includes(search.toLowerCase()))
  );

  const accentColor = color === "emerald" ? "#10b981" : "#ef4444";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal - slides up on mobile, centered on desktop */}
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col animate-slide-up sm:animate-scale-in">
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-2 sm:hidden">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${accentColor}15` }}
              >
                {type === "groupbuy" ? (
                  <Icon name="Cart" size={18} style={{ color: accentColor }} />
                ) : (
                  <Icon name="Live" size={18} style={{ color: accentColor }} />
                )}
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">{title}</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">{description}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="px-4 pb-3 border-b border-gray-100 space-y-2">
          <div className="relative">
            <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="상품명, 브랜드 검색..."
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-200 bg-gray-50"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMyOnly(false)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                !showMyOnly ? "text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
              style={!showMyOnly ? { backgroundColor: accentColor } : {}}
            >
              전체 ({allProducts.length})
            </button>
            <button
              onClick={() => setShowMyOnly(true)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                showMyOnly ? "text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
              style={showMyOnly ? { backgroundColor: accentColor } : {}}
            >
              <Icon name="MyPage" size={10} /> 내상품 ({myProducts.length})
            </button>
          </div>
        </div>

        {/* Product List */}
        <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-1.5">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Icon name="Package" size={36} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">{showMyOnly ? "등록한 내 상품이 없습니다" : "신청 가능한 상품이 없습니다"}</p>
              <p className="text-[11px] text-gray-300 mt-1">다른 키워드로 검색해보세요</p>
            </div>
          ) : (
            filtered.map(p => {
              const isOwn = myProductIds.has(p.id);
              return (
                <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-sm ${
                  isOwn ? "border-blue-200 bg-blue-50/30" : "border-gray-100 bg-white hover:border-gray-200"
                }`}>
                  <div className="relative flex-shrink-0">
                    {p.thumbnail ? (
                      <img src={p.thumbnail} alt={p.name} className="w-14 h-14 rounded-xl object-cover border border-gray-100" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center"><Icon name="Package" size={18} className="text-gray-300" /></div>
                    )}
                    {isOwn && (
                      <span className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-sm">
                        <Icon name="MyPage" size={9} />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13px] font-medium text-gray-900 truncate">{p.name}</p>
                      {isOwn && <span className="text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">내상품</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {p.brandName && <span className="text-[10px] text-gray-400">{p.brandName}</span>}
                      {p.categoryName && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{p.categoryName}</span>}
                    </div>
                    <p className="text-[12px] font-bold text-gray-700 mt-1">{p.basePrice.toLocaleString()}원</p>
                  </div>
                  <button
                    onClick={() => onApply(p.id, type, isOwn)}
                    disabled={loading === p.id}
                    className="text-[11px] px-3.5 py-2 rounded-xl font-bold flex items-center gap-1 flex-shrink-0 text-white transition-all disabled:opacity-50 shadow-sm active:scale-95"
                    style={{ backgroundColor: isOwn ? "#3b82f6" : accentColor }}
                  >
                    {loading === p.id ? <Loader2 size={12} className="animate-spin" /> : <Icon name="Plus" size={12} />}
                    {isOwn ? "바로 추가" : "신청"}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom action */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100 bg-gray-50/50 sm:rounded-b-2xl">
          <button onClick={onClose} className="w-full py-3 text-sm font-medium text-gray-600 bg-white rounded-xl hover:bg-gray-100 transition-colors border border-gray-200">
            닫기
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up { 0% { transform: translateY(100%); } 100% { transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
        @keyframes scale-in { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scale-in 0.2s ease-out; }
      `}</style>
    </div>
  );
}
