"use client";

import { Icon } from '@/components/shared/Icon';
import { sanitizeHtml } from "@/lib/sanitize";
import { useState, useEffect, useRef } from "react";
import {X, Loader2, Eye, Bold, Italic, Heading, List, ShoppingBag, Users, Hash, Percent, ImagePlus, Link as LinkIcon, Upload, Radio, Package, Tag, Circle, ArrowRight} from 'lucide-react';
import ImageUploader from "@/components/shared/ImageUploader";
import { useAppDialog } from "@/components/shared/AppDialog";
import { useFeatureFlags } from "@/components/shared/FeatureFlagsProvider";
import { computeBrandUnitMargin, MARGIN_BASE_LABEL } from "@/lib/margin";
import OptionGroupEditor, { type OptionGroup as OG } from "@/components/shared/OptionGroupEditor";
import BulkProductRegister from "@/components/shared/BulkProductRegister";

interface Category { id: string; name: string; slug: string; parentId: string | null; }
// 마진 정책: 브랜드별 중간관리자 마진 산정 방식
type MarginPolicy = { method: "PERCENTAGE" | "SUPPLY_BASE"; base: "SUPPLY" | "SALE"; rate: number };
interface Brand { id: string; brandName: string; marginPolicy?: MarginPolicy | null }
interface Props {
  brands: Brand[];
  mode: "admin" | "brand" | "seller" | "middle";
  buttonLabel?: string;
  hideGroupBuy?: boolean;
  // 브랜드 모드: 해당 브랜드의 마진 정책 (관리자 모드는 brands[].marginPolicy 로 브랜드 선택 시 반영)
  marginPolicy?: MarginPolicy | null;
}

type ProductType = "normal" | "groupbuy" | "live";

// 단계 정의
const NORMAL_STEPS = ["type", "basic", "detail", "options"] as const;
const GROUPBUY_STEPS = ["type", "basic", "detail", "options", "groupbuy"] as const;
const LIVE_STEPS = ["type", "basic", "detail", "options"] as const;

type StepId = "type" | "basic" | "detail" | "options" | "groupbuy";

const STEP_INFO: Record<StepId, { label: string; icon: any; desc: string }> = {
  type: { label: "상품유형", icon: Package, desc: "상품 유형을 선택하세요" },
  basic: { label: "기본정보", icon: Tag, desc: "상품 기본 정보를 입력하세요" },
  detail: { label: "상세설명", icon: Eye, desc: "상세 설명을 작성하세요" },
  options: { label: "이미지/옵션", icon: ImagePlus, desc: "이미지와 옵션을 설정하세요" },
  groupbuy: { label: "공동구매", icon: ShoppingBag, desc: "공동구매 설정을 입력하세요" },
};

export default function ProductRegisterForm({ brands, mode, buttonLabel, hideGroupBuy, marginPolicy }: Props) {
  const { appAlert } = useAppDialog();
  // 상품 등록 탭 노출은 최고관리자 권한설정(기능 토글)을 따른다.
  // - 일반상품: flags.regNormal / 공동구매: flags.regGroupBuy / 라이브커머스: 항상 노출
  const flags = useFeatureFlags();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    name: "", basePrice: "", comparePrice: "", description: "", detailContent: "",
    brandId: "", categoryId: "", thumbnail: "", images: [] as string[],
    supplyPrice: "", middleAdminMargin: "", // 공급가 / 중간관리자 단가 마진
    stock: "", // 단일 상품 재고 수량 (옵션 미사용 시)
    variants: [] as { name: string; price: string; stock: string }[],
  });
  // 다차원 옵션 그룹
  const [optionMode, setOptionMode] = useState<"flat" | "group">("flat");
  const [optionGroups, setOptionGroups] = useState<OG[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const detailRef = useRef<HTMLTextAreaElement>(null);
  const detailImgRef = useRef<HTMLInputElement>(null);
  const [detailImgUploading, setDetailImgUploading] = useState(false);
  const [productType, setProductType] = useState<ProductType>("normal");
  const [badges, setBadges] = useState<string[]>([]);
  const [groupBuy, setGroupBuy] = useState({
    title: "", campaignPrice: "", goalQuantity: "", minOrderQuantity: "1",
    maxOrderQuantity: "", limitPerPerson: "10", startDate: "", endDate: "",
    description: "", bannerImage: "", estimatedDelivery: "",
    minSalePrice: "", // 최저판매가 (드라이브)
  });
  // 배송 설정
  const [shipping, setShipping] = useState({ fee: "", freeShipping: false, freeThreshold: "", remoteFee: "" });
  // 인플루언서 커미션 (브랜드/관리자용)
  const [commissionRate, setCommissionRate] = useState("");
  // 제공 방식: SUPPLY(공급가로 제공) / COMMISSION(수수료로 제공)
  const [priceModel, setPriceModel] = useState<"SUPPLY" | "COMMISSION">("SUPPLY");
  // 수수료 제공 시: 판매가(소비자 정가) / 셀러 수수료율(%)
  const [commissionSalePrice, setCommissionSalePrice] = useState("");
  const [sellerCommissionRate, setSellerCommissionRate] = useState("");
  // 상품 문의/채팅
  const [chatMessages, setChatMessages] = useState<{ from: string; text: string; time: string }[]>([]);
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    if (showForm) {
      fetch("/api/products/register").then(r => r.json()).then(d => setCategories(d.categories || [])).catch(() => {});
    }
  }, [showForm]);

  const topCategories = categories.filter(c => !c.parentId);
  const subCategories = (pid: string) => categories.filter(c => c.parentId === pid);

  // 브랜드는 공급가만 입력 (판매가·마진·커미션은 중간관리자가 결정)
  const isBrandOnly = mode === "brand";
  // 공급가/마진 입력 노출 여부 (셀러는 판매가만 입력). 중간관리자 직접 등록도 공급가/마진 입력.
  const showSupplyFields = mode === "admin" || mode === "brand" || mode === "middle";
  // 관리자/브랜드/중간관리자 등록 상품의 판매가는 셀러가 직접 입력한다 → 등록 폼에서 판매가 필드 제거
  const sellerSetsPrice = mode === "admin" || mode === "brand" || mode === "middle";
  // 현재 적용할 마진 정책: 브랜드 모드는 prop, 관리자 모드는 선택된 브랜드의 정책
  const activeMarginPolicy: MarginPolicy | null =
    mode === "brand"
      ? marginPolicy ?? null
      : mode === "admin"
        ? (brands.find(b => b.id === form.brandId)?.marginPolicy ?? null)
        : null;
  // PERCENTAGE: 마진 자동계산(읽기전용) / SUPPLY_BASE 또는 정책없음: 직접입력
  const isPercentagePolicy = activeMarginPolicy?.method === "PERCENTAGE";
  // 퍼센트 정책일 때 실시간 산출 마진
  const computedMargin = isPercentagePolicy && activeMarginPolicy
    ? computeBrandUnitMargin({
        method: "PERCENTAGE",
        base: activeMarginPolicy.base,
        rate: activeMarginPolicy.rate,
        salePrice: parseFloat(form.basePrice) || 0,
        supplyPrice: parseFloat(form.supplyPrice) || 0,
      })
    : 0;

  const addVariant = () => setForm({ ...form, variants: [...form.variants, { name: "", price: form.basePrice, stock: "0" }] });
  const removeVariant = (i: number) => setForm({ ...form, variants: form.variants.filter((_, idx) => idx !== i) });
  const updateVariant = (i: number, k: string, v: string) => {
    const nv = [...form.variants]; (nv[i] as any)[k] = v; setForm({ ...form, variants: nv });
  };

  const handleDetailImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDetailImgUploading(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        const url = data.urls?.[0];
        if (url && detailRef.current) {
          const ta = detailRef.current;
          const s = ta.selectionStart;
          const ins = `<img src="${url}" style="max-width:100%;height:auto;" alt="상세이미지" />`;
          const nc = form.detailContent.substring(0, s) + ins + form.detailContent.substring(s);
          setForm({ ...form, detailContent: nc });
        }
      }
    } catch {} finally { setDetailImgUploading(false); if (detailImgRef.current) detailImgRef.current.value = ""; }
  };

  const insertHtmlTag = (tag: string) => {
    const ta = detailRef.current; if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd, sel = form.detailContent.substring(s, e);
    let ins = "";
    switch (tag) {
      case "bold": ins = `<strong>${sel || "굵은 텍스트"}</strong>`; break;
      case "italic": ins = `<em>${sel || "기울임"}</em>`; break;
      case "h3": ins = `<h3>${sel || "소제목"}</h3>`; break;
      case "list": ins = `<ul>\n  <li>${sel || "항목"}</li>\n</ul>`; break;
      default: return;
    }
    const nc = form.detailContent.substring(0, s) + ins + form.detailContent.substring(e);
    setForm({ ...form, detailContent: nc });
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + ins.length; }, 0);
  };

  const isGroupBuy = productType === "groupbuy";
  const isLive = productType === "live";

  useEffect(() => { if (isGroupBuy && form.name && !groupBuy.title) setGroupBuy(p => ({ ...p, title: `${form.name} 공동구매` })); }, [isGroupBuy, form.name]);
  useEffect(() => { if (isGroupBuy && form.basePrice && !groupBuy.campaignPrice) setGroupBuy(p => ({ ...p, campaignPrice: form.basePrice })); }, [isGroupBuy, form.basePrice]);

  const allProductTypeTabs: { id: ProductType; label: string; icon: any; color: string; desc: string }[] = [
    { id: "normal", label: "일반상품", icon: Package, color: "bg-gray-900", desc: "일반 판매 상품" },
    { id: "groupbuy", label: "공동구매", icon: ShoppingBag, color: "bg-emerald-500", desc: "공동구매 캠페인 상품" },
    { id: "live", label: "라이브커머스", icon: Radio, color: "bg-red-500", desc: "라이브 방송 판매 상품" },
  ];
  // 권한설정 토글에 따라 노출할 유형 탭만 남긴다. (라이브커머스는 항상 노출)
  const productTypeTabs = allProductTypeTabs.filter((pt) => {
    if (pt.id === "normal") return flags.regNormal;
    if (pt.id === "groupbuy") return flags.regGroupBuy && !hideGroupBuy;
    return true;
  });
  const defaultProductType: ProductType = productTypeTabs[0]?.id ?? "live";

  // 고를 수 있는 유형이 하나뿐이면 선택할 게 없으므로 유형 단계를 건너뛴다.
  const skipTypeStep = productTypeTabs.length <= 1;
  const steps: StepId[] = (isGroupBuy ? [...GROUPBUY_STEPS] : isLive ? [...LIVE_STEPS] : [...NORMAL_STEPS])
    .filter((s) => !(skipTypeStep && s === "type"));
  const currentStepId = steps[currentStep] || "type";
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  // 가격 역전 검사 — 정가(comparePrice)는 판매가 위에 취소선으로 붙는 비교가라
  // 판매가보다 낮으면 "할인인데 더 비싼" 표시가 되어버린다. 둘 다 입력된 경우만 검사.
  const isPriceInverted = (): boolean => {
    const usesCommissionPrice = sellerSetsPrice && priceModel === "COMMISSION";
    const sale = parseFloat(usesCommissionPrice ? commissionSalePrice : form.basePrice);
    const compare = parseFloat(form.comparePrice);
    if (!Number.isFinite(sale) || !Number.isFinite(compare)) return false;
    return compare < sale;
  };

  const canGoNext = (): boolean => {
    switch (currentStepId) {
      case "type": return true;
      case "basic":
        if (!form.name) return false;
        // 정가(comparePrice)는 취소선으로 표시되는 비교가이므로 판매가보다 낮을 수 없다.
        if (isPriceInverted()) return false;
        if (sellerSetsPrice) {
          // 수수료 제공: 판매가 필수 / 공급가 제공: 공급가 필수
          return priceModel === "COMMISSION" ? !!commissionSalePrice : !!form.supplyPrice;
        }
        return !!form.basePrice;
      case "detail": return true;
      case "options": return true;
      case "groupbuy": return !!groupBuy.campaignPrice && !!groupBuy.startDate && !!groupBuy.endDate;
      default: return true;
    }
  };

  const getNextValidationMsg = (): string => {
    switch (currentStepId) {
      case "basic":
        if (!form.name) return "상품명을 입력해주세요";
        if (sellerSetsPrice) {
          if (priceModel === "COMMISSION" && !commissionSalePrice) return "판매가(소비자 정가)를 입력해주세요";
          if (priceModel !== "COMMISSION" && !form.supplyPrice) return "공급가를 입력해주세요";
        } else if (!form.basePrice) {
          return "판매가를 입력해주세요";
        }
        if (isPriceInverted()) return "정가는 판매가보다 낮을 수 없습니다";
        return "필수 항목을 확인해주세요";
      case "groupbuy":
        return "공동구매 가격, 시작일, 종료일을 모두 입력해주세요";
      default:
        return "필수 항목을 입력해주세요";
    }
  };

  const handleNext = () => {
    if (isLastStep) { handleSubmit(); return; }
    if (canGoNext()) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    } else {
      appAlert({ title: "필수 항목 확인", message: getNextValidationMsg(), type: "honeybee" });
    }
  };
  const handlePrev = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  // 수수료 제공 여부 (브랜드/관리자 등록 시에만 유효)
  const isCommissionModel = sellerSetsPrice && priceModel === "COMMISSION";

  const handleSubmit = async () => {
    // 제공 방식별 basePrice 결정
    // - 수수료 제공(COMMISSION): 브랜드/관리자가 입력한 판매가(소비자 정가)를 basePrice로 확정
    // - 공급가 제공(SUPPLY): 공급가로 임시 저장(셀러가 샵 추가 시 판매가 확정)
    // - 셀러 직접 등록: 셀러가 입력한 판매가
    const effectiveBasePrice = isCommissionModel
      ? commissionSalePrice
      : (sellerSetsPrice ? form.supplyPrice : form.basePrice);
    // 필수값 누락 시 조용히 종료하지 않고 사용자에게 안내 (등록이 안 되는 것처럼 보이는 문제 방지)
    if (!form.name) { appAlert("상품명을 입력해주세요"); return; }
    if (!effectiveBasePrice) {
      appAlert(
        isCommissionModel ? "판매가(소비자 정가)를 입력해주세요"
        : sellerSetsPrice ? "공급가를 입력해주세요"
        : "판매가를 입력해주세요"
      );
      return;
    }
    if (isGroupBuy && (!groupBuy.campaignPrice || !groupBuy.startDate || !groupBuy.endDate)) {
      appAlert("공동구매: 가격, 시작일, 종료일 필수"); return;
    }
    setLoading(true);
    try {
      const body: any = {
        ...form, basePrice: parseFloat(effectiveBasePrice),
        comparePrice: form.comparePrice ? parseFloat(form.comparePrice) : null,
        brandId: form.brandId || null, categoryId: form.categoryId || null,
        thumbnail: form.thumbnail || form.images[0] || null,
        variants: form.variants.filter(v => v.name), images: form.images.filter(Boolean),
        badges: badges.length > 0 ? badges : null,
        productType, allowGroupBuy: isGroupBuy, allowLiveCommerce: isLive,
        shippingFee: shipping.freeShipping ? 0 : (shipping.fee ? parseFloat(shipping.fee) : 0),
        freeShipping: shipping.freeShipping,
        freeShippingThreshold: !shipping.freeShipping && shipping.freeThreshold ? parseFloat(shipping.freeThreshold) : null,
        remoteAreaFee: shipping.remoteFee ? parseFloat(shipping.remoteFee) : 0,
        // 다차원 옵션 그룹 메타데이터
        optionGroups: optionMode === "group" && optionGroups.length > 0
          ? JSON.stringify(optionGroups)
          : null,
      };
      // 제공 방식 (브랜드/관리자 전용, 셀러 직접 등록은 항상 SUPPLY)
      body.priceModel = sellerSetsPrice ? priceModel : "SUPPLY";
      if (isCommissionModel) {
        // 수수료로 제공: 판매가는 basePrice로 확정, 공급가 개념 없음
        body.supplyPrice = null;
        body.middleAdminMargin = null;
        body.sellerCommissionRate = sellerCommissionRate ? parseFloat(sellerCommissionRate) : null;
      } else if (showSupplyFields) {
        // 공급가 / 중간관리자 마진 (브랜드/관리자 전용)
        body.supplyPrice = form.supplyPrice ? parseFloat(form.supplyPrice) : null;
        // 퍼센트 정책은 서버에서 재계산하므로 전달 불필요. 직접입력일 때만 전달.
        body.middleAdminMargin = isPercentagePolicy
          ? null
          : (form.middleAdminMargin ? parseFloat(form.middleAdminMargin) : null);
      }
      // 커미션 정보 (관리자 인플루언서 커미션 — 기존 동작 유지)
      if ((mode === "admin" || mode === "brand") && commissionRate) {
        body.commissionRate = parseFloat(commissionRate);
      }
      if (isGroupBuy) {
        body.isGroupBuy = true;
        body.groupBuy = {
          title: groupBuy.title || `${form.name} 공동구매`,
          campaignPrice: parseFloat(groupBuy.campaignPrice),
          goalQuantity: groupBuy.goalQuantity ? parseInt(groupBuy.goalQuantity) : null,
          minOrderQuantity: parseInt(groupBuy.minOrderQuantity) || 1,
          maxOrderQuantity: groupBuy.maxOrderQuantity ? parseInt(groupBuy.maxOrderQuantity) : null,
          limitPerPerson: parseInt(groupBuy.limitPerPerson) || 10,
          startDate: groupBuy.startDate, endDate: groupBuy.endDate,
          description: groupBuy.description || null, bannerImage: groupBuy.bannerImage || null,
          estimatedDelivery: groupBuy.estimatedDelivery || null,
          minSalePrice: groupBuy.minSalePrice ? parseFloat(groupBuy.minSalePrice) : null,
        };
      }
      // 채팅 메시지 전달
      if (chatMessages.length > 0) {
        body.chatMessages = chatMessages;
      }
      const res = await fetch("/api/products/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { setShowForm(false); window.location.reload(); }
      else {
        const d = await res.json().catch(() => ({}));
        await appAlert(d.error || `등록 실패 (${res.status})`);
      }
    } catch (err) {
      // 네트워크 오류 등 예외를 조용히 삼키지 않고 사용자에게 안내
      await appAlert("등록 중 오류가 발생했습니다. 네트워크 상태를 확인 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const discountPercent = isGroupBuy && groupBuy.campaignPrice && form.basePrice
    ? Math.round(((parseFloat(form.basePrice) - parseFloat(groupBuy.campaignPrice)) / parseFloat(form.basePrice)) * 100) : 0;

  // 현재 선택된 유형이 숨겨진 경우(또는 폼 열림 시) 노출 가능한 첫 유형으로 교정.
  useEffect(() => {
    if (!productTypeTabs.some((pt) => pt.id === productType)) {
      setProductType(defaultProductType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flags.regNormal, flags.regGroupBuy, hideGroupBuy, showForm]);

  const resetForm = () => {
    setForm({ name: "", basePrice: "", comparePrice: "", description: "", detailContent: "", brandId: "", categoryId: "", thumbnail: "", images: [], supplyPrice: "", middleAdminMargin: "", stock: "", variants: [] });
    setGroupBuy({ title: "", campaignPrice: "", goalQuantity: "", minOrderQuantity: "1", maxOrderQuantity: "", limitPerPerson: "10", startDate: "", endDate: "", description: "", bannerImage: "", estimatedDelivery: "", minSalePrice: "" });
    setBadges([]); setCurrentStep(0); setProductType(defaultProductType); setCommissionRate(""); setChatMessages([]); setChatInput("");
    setShipping({ fee: "", freeShipping: false, freeThreshold: "", remoteFee: "" });
    setPriceModel("SUPPLY"); setCommissionSalePrice(""); setSellerCommissionRate("");
    setOptionMode("flat"); setOptionGroups([]);
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    setChatMessages(prev => [...prev, {
      from: mode === "seller" ? "라이브 셀러" : mode === "brand" ? "브랜드" : "관리자",
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    }]);
    setChatInput("");
  };

  const accentColor = isGroupBuy ? "emerald" : isLive ? "red" : "brand";

  return (
    <>
      <div className="flex items-center gap-2">
        {/* 대량 등록: 엑셀 일괄 등록. 상품 등록 화면에서는 계정(역할)과 무관하게 항상 노출한다.
            (일반상품 탭 토글 flags.regNormal 과 무관 — 대량 등록은 별도 기능이므로 게이트하지 않음) */}
        <BulkProductRegister mode={mode} brands={brands} />
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary text-sm flex items-center gap-1 !px-3 !py-2 sm:!px-4 sm:!py-2.5 whitespace-nowrap">
          <Icon name="Plus" size={16} /> <span className="hidden sm:inline">{buttonLabel || "내상품등록"}</span><span className="sm:hidden">등록</span>
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full sm:max-w-xl sm:rounded-2xl sm:shadow-2xl sm:my-6 min-h-screen sm:min-h-0 flex flex-col max-h-screen sm:max-h-[90vh]">

            {/* Header */}
            <div className="flex-shrink-0 px-4 sm:px-6 pt-5 pb-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {!isFirstStep && (
                    <button onClick={handlePrev} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all">
                      <Icon name="ChevronDown" size={18} className="rotate-90" />
                    </button>
                  )}
                  <h3 className="text-lg font-bold text-gray-900">{buttonLabel || "내상품등록"}</h3>
                </div>
                <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all">
                  <X size={18} />
                </button>
              </div>

              {/* 위자드 스텝 인디케이터 */}
              <div className="flex items-center gap-1 mb-1">
                {steps.map((step, idx) => {
                  const info = STEP_INFO[step];
                  const isActive = idx === currentStep;
                  const isCompleted = idx < currentStep;
                  return (
                    <button
                      key={step}
                      onClick={() => idx <= currentStep && setCurrentStep(idx)}
                      className="flex-1 flex flex-col items-center gap-1 relative"
                    >
                      <div className={`w-full h-1 rounded-full transition-all ${
                        isCompleted ? (isGroupBuy ? "bg-emerald-500" : isLive ? "bg-red-500" : "bg-brand-600") 
                        : isActive ? (isGroupBuy ? "bg-emerald-300" : isLive ? "bg-red-300" : "bg-brand-300") 
                        : "bg-gray-200"
                      }`} />
                      <span className={`text-[9px] font-medium transition-colors ${
                        isActive ? "text-gray-900" : isCompleted ? "text-gray-500" : "text-gray-300"
                      }`}>{info.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="px-4 sm:px-6 py-5 space-y-5">

                {/* STEP: 상품 유형 선택 */}
                {currentStepId === "type" && (
                  <div className="space-y-4 animate-fade-in">
                    <div>
                      <h4 className="text-sm font-bold text-gray-800 mb-1">상품 유형 선택</h4>
                      <p className="text-xs text-gray-400">등록할 상품의 유형을 선택하세요</p>
                    </div>
                    <div className="space-y-2.5">
                      {productTypeTabs.map(pt => (
                        <button
                          key={pt.id}
                          type="button"
                          onClick={() => { setProductType(pt.id); setCurrentStep(0); }}
                          className={`w-full flex items-center gap-3.5 px-4 py-4 rounded-2xl border-2 transition-all text-left ${
                            productType === pt.id
                              ? `border-gray-900 bg-gray-50 shadow-sm`
                              : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50/50"
                          }`}
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${productType === pt.id ? pt.color : "bg-gray-100"}`}>
                            <pt.icon size={20} className={productType === pt.id ? "text-white" : "text-gray-400"} />
                          </div>
                          <div className="flex-1">
                            <span className={`text-sm font-bold ${productType === pt.id ? "text-gray-900" : "text-gray-500"}`}>{pt.label}</span>
                            <p className="text-[11px] text-gray-400 mt-0.5">{pt.desc}</p>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            productType === pt.id ? "border-gray-900 bg-gray-900" : "border-gray-200"
                          }`}>
                            {productType === pt.id && <Icon name="Check" size={12} className="text-white" />}
                          </div>
                        </button>
                      ))}
                    </div>
                    {isLive && (
                      <div className="bg-red-50 rounded-xl p-3.5 flex items-start gap-2">
                        <Icon name="Live" size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-red-700">라이브커머스 상품</p>
                          <p className="text-[11px] text-red-600 mt-0.5">라이브 방송에서 판매할 수 있도록 등록됩니다.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP: 기본 정보 */}
                {currentStepId === "basic" && (
                  <div className="space-y-5 animate-fade-in">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5"><Icon name="ProductName_icon" size={16} /> 상품명 <span className="text-red-500">*</span></label>
                      <input type="text" className="input-field text-sm" placeholder="상품명을 입력하세요" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </div>

                    {/* 제공 방식 선택 — 브랜드/관리자 전용 */}
                    {sellerSetsPrice && (
                      <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1.5 block">제공 방식 <span className="text-red-500">*</span></label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setPriceModel("SUPPLY")}
                            className={`text-left px-3 py-3 rounded-xl border-2 transition-all ${
                              priceModel === "SUPPLY" ? "border-gray-900 bg-gray-50" : "border-gray-100 bg-white hover:border-gray-200"
                            }`}
                          >
                            <span className={`text-xs font-bold ${priceModel === "SUPPLY" ? "text-gray-900" : "text-gray-500"}`}>공급가로 제공</span>
                            <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">셀러가 판매가 직접 설정</p>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPriceModel("COMMISSION")}
                            className={`text-left px-3 py-3 rounded-xl border-2 transition-all ${
                              priceModel === "COMMISSION" ? "border-gray-900 bg-gray-50" : "border-gray-100 bg-white hover:border-gray-200"
                            }`}
                          >
                            <span className={`text-xs font-bold ${priceModel === "COMMISSION" ? "text-gray-900" : "text-gray-500"}`}>수수료로 제공</span>
                            <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">판매가 + 수수료율 지정</p>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 수수료 제공 시: 판매가(소비자 정가) + 셀러 수수료율 */}
                    {isCommissionModel && (
                      <div className="border border-brand-200 rounded-xl p-4 space-y-3.5 bg-brand-50/40">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[11px] font-medium text-gray-700 mb-1 flex items-center gap-1"><Icon name="PriceTag_icon" size={14} /> 판매가 (소비자 정가) <span className="text-red-500">*</span></label>
                            <div className="relative">
                              <input type="number" min="0" className="input-field text-sm pr-8 !bg-white" placeholder="0"
                                value={commissionSalePrice} onChange={e => setCommissionSalePrice(e.target.value)} />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] font-medium text-gray-700 mb-1 block">셀러 수수료율</label>
                            <div className="relative">
                              <input type="number" min="0" max="100" step="0.1" className="input-field text-sm pr-8 !bg-white" placeholder="0"
                                value={sellerCommissionRate} onChange={e => setSellerCommissionRate(e.target.value)} />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                            </div>
                          </div>
                        </div>
                        {commissionSalePrice && sellerCommissionRate && (
                          <p className="text-[10px] text-brand-600">
                            셀러 마진 예상: {Math.round((parseFloat(commissionSalePrice) || 0) * (parseFloat(sellerCommissionRate) || 0) / 100).toLocaleString()}원
                            (판매가 {Number(commissionSalePrice).toLocaleString()}원 × {sellerCommissionRate}%)
                          </p>
                        )}
                        <p className="text-[10px] text-gray-400">셀러는 지정된 판매가로만 판매하며, 마진은 수수료율로 자동 계산됩니다.</p>
                      </div>
                    )}

                    {/* 판매가 — 관리자/브랜드는 입력하지 않음(셀러가 직접 판매가 입력) */}
                    {sellerSetsPrice ? (
                      // 공급가 제공 방식일 때만 "셀러가 직접 입력" 안내 표시
                      priceModel === "SUPPLY" && (
                        <div>
                          <label className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5"><Icon name="PriceTag_icon" size={16} /> 판매가</label>
                          <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                            셀러가 직접 입력
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5"><Icon name="PriceTag_icon" size={16} /> 판매가 <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <input type="number" className="input-field text-sm pr-8" placeholder="0" value={form.basePrice} onChange={e => setForm({ ...form, basePrice: e.target.value })} />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5"><Icon name="OriginalPrice_icon" size={16} /> 정가 <span className="text-gray-400">(선택)</span></label>
                          <div className="relative">
                            <input type="number" className="input-field text-sm pr-8" placeholder="0" value={form.comparePrice} onChange={e => setForm({ ...form, comparePrice: e.target.value })} />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 공급가 / 중간관리자 마진 — 브랜드/관리자 전용 (구매자 비공개). 수수료 제공 방식에서는 숨김 */}
                    {showSupplyFields && priceModel === "SUPPLY" && (
                      <div className="border border-gray-200 rounded-xl p-4 space-y-3.5 bg-gray-50/50">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                            <Icon name="Wallet" size={13} /> {isBrandOnly ? "공급가" : "공급가 · 중간관리자 마진"}
                          </label>
                          <span className="text-[10px] text-gray-400">권한자 전용 · 구매자 비공개</span>
                        </div>
                        <div className={isBrandOnly ? "" : "grid grid-cols-2 gap-4"}>
                          <div>
                            <label className="text-[11px] font-medium text-gray-500 mb-1 block">
                              공급가{isBrandOnly && <span className="text-red-500 ml-0.5">*</span>}
                            </label>
                            <div className="relative">
                              <input type="number" min="0" className="input-field text-sm pr-8 !bg-white" placeholder="0"
                                value={form.supplyPrice} onChange={e => setForm({ ...form, supplyPrice: e.target.value })} />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                            </div>
                          </div>
                          {/* 중간관리자 마진 — 브랜드는 입력하지 않음 */}
                          {!isBrandOnly && (
                            <div>
                              <label className="text-[11px] font-medium text-gray-500 mb-1 block">
                                중간관리자 마진
                                {isPercentagePolicy && <span className="text-[10px] text-brand-500 ml-1">(자동계산)</span>}
                              </label>
                              <div className="relative">
                                {isPercentagePolicy ? (
                                  // 퍼센트 정책: 읽기전용, 실시간 산출값 표시
                                  <input type="number" readOnly className="input-field text-sm pr-8 !bg-gray-100 text-gray-600 cursor-not-allowed"
                                    value={computedMargin} />
                                ) : (
                                  // 직접입력(SUPPLY_BASE) 또는 정책 없음
                                  <input type="number" min="0" className="input-field text-sm pr-8 !bg-white" placeholder="0"
                                    value={form.middleAdminMargin} onChange={e => setForm({ ...form, middleAdminMargin: e.target.value })} />
                                )}
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                              </div>
                            </div>
                          )}
                        </div>
                        {isBrandOnly ? (
                          <p className="text-[10px] text-gray-400">
                            공급가만 입력하세요. 판매가와 마진은 중간관리자가 설정하며, 등록 후 중간관리자 승인 시 셀러에게 공개됩니다.
                          </p>
                        ) : isPercentagePolicy && activeMarginPolicy ? (
                          <p className="text-[10px] text-gray-500">
                            마진 정책: {MARGIN_BASE_LABEL[activeMarginPolicy.base]} × {activeMarginPolicy.rate}% (자동 산출, 수정 불가)
                          </p>
                        ) : (
                          <p className="text-[10px] text-gray-400">
                            공급가와 중간관리자 마진을 직접 입력하세요. 마진은 중간관리자 정산으로 지급됩니다.
                          </p>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5"><Icon name="ProductCategory_icon" size={16} /> 카테고리</label>
                      <select className="input-field text-sm" value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}>
                        <option value="">카테고리 선택</option>
                        {topCategories.map(cat => (
                          <optgroup key={cat.id} label={cat.name}>
                            <option value={cat.id}>{cat.name} (전체)</option>
                            {subCategories(cat.id).map(sub => <option key={sub.id} value={sub.id}>&nbsp;&nbsp;{sub.name}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    {/* 브랜드 선택 — 관리자만 표시. 브랜드 계정(BRAND_ADMIN)은 본인이 브랜드이므로 숨기고 서버에서 세션 brandId를 자동 사용 */}
                    {mode === "admin" && (
                      <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1.5 block">브랜드</label>
                        <select className="input-field text-sm" value={form.brandId} onChange={e => setForm({ ...form, brandId: e.target.value })}>
                          <option value="">브랜드 선택</option>{brands.map(b => <option key={b.id} value={b.id}>{b.brandName}</option>)}
                        </select>
                      </div>
                    )}
                    {/* 인플루언서 커미션 (관리자 전용 — 브랜드는 설정하지 않음) */}
                    {mode === "admin" && (
                      <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1.5 block flex items-center gap-1">
                          <Icon name="Wallet" size={12} /> 인플루언서 커미션 (%)
                        </label>
                        <div className="relative">
                          <input type="number" className="input-field text-sm pr-8" placeholder="10" value={commissionRate} onChange={e => setCommissionRate(e.target.value)} min="0" max="100" step="0.1" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">라이브 셀러가 이 상품을 판매할 때 적용되는 커미션 비율입니다</p>
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5"><Icon name="ShortDescription_icon" size={16} /> 간단 설명</label>
                      <textarea className="input-field h-20 resize-none text-sm" placeholder="상품에 대한 간단한 설명을 입력하세요" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5"><Icon name="ProductTag_icon" size={16} /> 배지</label>
                      <div className="flex flex-wrap gap-2">
                        {[{ v: "FREE_SHIPPING", l: "무료배송", c: "bg-blue-50 text-blue-600 border-blue-200", icon: "BadgeFreeShipping_icon" }, { v: "NEW", l: "신상품", c: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: "BadgeNew_icon" },
                          { v: "BEST", l: "베스트", c: "bg-orange-50 text-orange-600 border-orange-200", icon: "BadgeBest_icon" }, { v: "HOT_DEAL", l: "특가", c: "bg-red-50 text-red-600 border-red-200", icon: "BadgeSale_icon" },
                          { v: "LIMITED", l: "한정판", c: "bg-purple-50 text-purple-600 border-purple-200", icon: "BadgeLimited_icon" }, { v: "HANDMADE", l: "핸드메이드", c: "bg-amber-50 text-amber-600 border-amber-200", icon: "BadgeRecommend_icon" },
                        ].map(b => (
                          <button key={b.v} type="button" onClick={() => setBadges(p => p.includes(b.v) ? p.filter(x => x !== b.v) : [...p, b.v])}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${badges.includes(b.v) ? b.c + " border-current shadow-sm" : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"}`}>
                            <Icon name={b.icon} size={12} />
                            {badges.includes(b.v) && "✓ "}{b.l}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 배송 설정 */}
                    <div className="border border-gray-200 rounded-xl p-4 space-y-3.5">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <Icon name="Truck" size={13} /> 배송 설정
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" className="w-4 h-4 rounded accent-brand-600"
                          checked={shipping.freeShipping}
                          onChange={e => setShipping(s => ({ ...s, freeShipping: e.target.checked }))} />
                        <span className="text-xs font-medium text-gray-700">무료배송</span>
                      </label>

                      {!shipping.freeShipping && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-medium text-gray-500 mb-1 block">배송료</label>
                            <div className="relative">
                              <input type="number" min="0" className="input-field text-sm pr-8" placeholder="0"
                                value={shipping.fee} onChange={e => setShipping(s => ({ ...s, fee: e.target.value }))} />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] font-medium text-gray-500 mb-1 block">무료배송 기준금액 <span className="text-gray-300">(선택)</span></label>
                            <div className="relative">
                              <input type="number" min="0" className="input-field text-sm pr-8" placeholder="예: 50000"
                                value={shipping.freeThreshold} onChange={e => setShipping(s => ({ ...s, freeThreshold: e.target.value }))} />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-[11px] font-medium text-gray-500 mb-1 block">도서산간 추가배송비 <span className="text-gray-300">(선택)</span></label>
                        <div className="relative max-w-[50%]">
                          <input type="number" min="0" className="input-field text-sm pr-8" placeholder="예: 3000"
                            value={shipping.remoteFee} onChange={e => setShipping(s => ({ ...s, remoteFee: e.target.value }))} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                        </div>
                      </div>

                      {!shipping.freeShipping && shipping.freeThreshold && (
                        <p className="text-[10px] text-gray-400">{Number(shipping.freeThreshold).toLocaleString()}원 이상 구매 시 무료배송으로 표시됩니다.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP: 상세 설명 */}
                {currentStepId === "detail" && (
                  <div className="space-y-5 animate-fade-in">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"><Icon name="DetailDescription_icon" size={16} /> 상세 콘텐츠 (HTML)</label>
                        <button type="button" onClick={() => setShowPreview(!showPreview)} className="text-[11px] text-brand-600 hover:text-brand-700 font-medium">
                          <Icon name="Eye" size={12} className="inline mr-0.5" />{showPreview ? "편집 모드" : "미리보기"}
                        </button>
                      </div>
                      <div className="flex items-center gap-1 mb-1 p-1.5 bg-gray-50 rounded-t-lg border border-b-0 border-gray-200">
                        {[{ t: "bold", i: <Bold size={14} />, tip: "굵게" }, { t: "italic", i: <Italic size={14} />, tip: "기울임" }, { t: "h3", i: <Heading size={14} />, tip: "소제목" }, { t: "list", i: <List size={14} />, tip: "목록" }].map(b => (
                          <button key={b.t} type="button" onClick={() => insertHtmlTag(b.t)} title={b.tip}
                            className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0">{b.i}</button>
                        ))}
                        <div className="w-px h-5 bg-gray-200 mx-0.5" />
                        <input ref={detailImgRef} type="file" accept="image/*" className="hidden" onChange={handleDetailImageUpload} />
                        <button type="button" onClick={() => detailImgRef.current?.click()} title="이미지 삽입" disabled={detailImgUploading}
                          className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0 flex items-center gap-1 text-[11px]">
                          {detailImgUploading ? <Loader2 size={14} className="animate-spin" /> : <Icon name="Upload" size={14} />}
                          이미지
                        </button>
                      </div>
                      {showPreview ? (
                        <div className="border border-gray-200 rounded-b-lg p-4 min-h-[200px] bg-white">
                          {form.detailContent ? <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: sanitizeHtml(form.detailContent) }} /> : <p className="text-xs text-gray-400 text-center mt-16">미리보기 내용이 없습니다</p>}
                        </div>
                      ) : (
                        <textarea ref={detailRef} className="input-field h-48 resize-y font-mono text-xs rounded-t-none" placeholder="HTML 형식의 상세 정보를 입력하세요" value={form.detailContent} onChange={e => setForm({ ...form, detailContent: e.target.value })} />
                      )}
                    </div>
                    {/* 상품 문의/채팅 */}
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-2 block flex items-center gap-1">
                        <Icon name="Message" size={12} /> 상품 문의 (브랜드/관리자 소통)
                      </label>
                      <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                        <div className="max-h-[120px] overflow-y-auto p-3 space-y-1.5">
                          {chatMessages.length === 0 ? (
                            <p className="text-[11px] text-gray-400 text-center py-2">상품에 대한 문의사항을 입력하세요</p>
                          ) : chatMessages.map((msg, i) => (
                            <div key={i} className="flex flex-col gap-0.5">
                              <span className="text-[9px] text-gray-400">{msg.from} · {msg.time}</span>
                              <span className="text-[11px] text-gray-700 bg-white rounded-lg px-2 py-1 border border-gray-100">{msg.text}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-1.5 p-2 border-t border-gray-200">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSendChat(); } }}
                            className="input-field text-xs py-1.5 flex-1"
                            placeholder="문의 내용 입력..."
                          />
                          <button type="button" onClick={handleSendChat} className="px-3 py-1.5 bg-brand-600 text-white text-xs rounded-lg hover:bg-brand-700">전송</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP: 이미지 / 옵션(재고) */}
                {currentStepId === "options" && (
                  <div className="space-y-5 animate-fade-in">
                    {/* 썸네일 이미지 */}
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                        <Icon name="ProductThumbnail_icon" size={20} /> 썸네일 이미지 <span className="text-gray-400 font-normal">(대표 이미지, 1장)</span>
                      </label>
                      <p className="text-[11px] text-gray-400 mb-2">상품 목록·카드에서 보이는 대표 이미지입니다.</p>
                      <ImageUploader
                        images={form.thumbnail ? [form.thumbnail] : []}
                        onChange={(imgs) => setForm({ ...form, thumbnail: imgs[0] || "" })}
                        maxImages={1}
                      />
                    </div>

                    {/* 상세 이미지 */}
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                        <Icon name="ProductGallery_icon" size={20} /> 상세 이미지 <span className="text-gray-400 font-normal">(갤러리, 최대 8장)</span>
                      </label>
                      <p className="text-[11px] text-gray-400 mb-2">상품 상세페이지 상단 갤러리에 표시됩니다.</p>
                      <ImageUploader
                        images={form.images}
                        onChange={(imgs) => setForm({ ...form, images: imgs })}
                        maxImages={8}
                      />
                    </div>

                    {/* 재고 (옵션 없을 때) */}
                    {form.variants.length === 0 && (
                      <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1.5 block flex items-center gap-1">
                          <Icon name="Package" size={13} /> 재고 수량
                        </label>
                        <div className="relative max-w-[50%]">
                          <input
                            type="number"
                            min="0"
                            className="input-field text-sm pr-8"
                            placeholder="0"
                            value={form.stock}
                            onChange={e => setForm({ ...form, stock: e.target.value })}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">개</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">옵션을 추가하면 옵션별 재고로 관리됩니다.</p>
                      </div>
                    )}

                    {/* 옵션 (다차원 그룹 or 단순) */}
                    <div>
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-2">
                        <Icon name="ProductOption_icon" size={16} /> 상품 옵션
                        <span className="text-gray-400 font-normal ml-1">(색상, 사이즈 등)</span>
                      </label>
                      <OptionGroupEditor
                        optionMode={optionMode}
                        variants={form.variants}
                        optionGroups={optionGroups}
                        basePrice={form.basePrice || form.supplyPrice || "0"}
                        onChange={(patch) => {
                          if (patch.optionMode !== undefined) setOptionMode(patch.optionMode);
                          if (patch.optionGroups !== undefined) setOptionGroups(patch.optionGroups);
                          if (patch.variants !== undefined) setForm(f => ({ ...f, variants: patch.variants! }));
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-t border-gray-100">
              <div className="flex gap-2">
                {currentStep > 0 && (
                  <button type="button" onClick={() => setCurrentStep(s => s - 1)} className="btn-outline flex-1 py-2.5 text-sm">
                    ← 이전
                  </button>
                )}
                {currentStep < steps.length - 1 ? (
                  <button type="button" onClick={handleNext} className="btn-primary flex-1 py-2.5 text-sm">
                    다음 →
                  </button>
                ) : (
                  <button type="button" onClick={handleSubmit} disabled={loading} className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {loading ? "등록 중..." : "상품 등록"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
    
      )}
    </>
  );
}
