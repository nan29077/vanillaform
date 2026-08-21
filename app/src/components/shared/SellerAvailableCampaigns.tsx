"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useEffect } from "react";
import {Loader2, AlertCircle, X, Package} from 'lucide-react';
import SafeImage from "./SafeImage";

interface AvailableCampaign {
  id: string; title: string; status: string; campaignPrice: number; originalPrice: number;
  startDate: string; endDate: string; goalQuantity: number | null;
  currentQuantity: number; participantCount: number; description: string | null;
  bannerImage: string | null;
  product: {
    id: string; name: string; thumbnail: string | null; basePrice: number;
    brand: { brandName: string; brandLogo: string | null } | null;
    category: { name: string } | null;
  };
  createdBySeller: string;
  isMyProduct: boolean;
  alreadyJoined: boolean;
  isMyCampaign: boolean;
}

export default function SellerAvailableCampaigns() {
  const [campaigns, setCampaigns] = useState<AvailableCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [joinLoading, setJoinLoading] = useState<string | null>(null);
  // ★ 참여 확인 팝업 상태
  const [confirmTarget, setConfirmTarget] = useState<AvailableCampaign | null>(null);
  // ★ 성공 토스트
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const formatPrice = (n: number) => n.toLocaleString("ko-KR") + "원";
  const formatDate = (d: string) => new Date(d).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });

  useEffect(() => {
    fetch("/api/seller/available-campaigns")
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setCampaigns(d.campaigns || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleJoinConfirm = async () => {
    if (!confirmTarget) return;
    const campaignId = confirmTarget.id;
    setJoinLoading(campaignId);
    setConfirmTarget(null);
    try {
      const res = await fetch("/api/seller/available-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(prev => prev.map(c =>
          c.id === campaignId ? { ...c, alreadyJoined: true } : c
        ));
        setSuccessToast(data.message || "공동구매 참여가 완료되었습니다!");
        setTimeout(() => {
          setSuccessToast(null);
          window.location.reload();
        }, 1800);
      } else {
        const data = await res.json();
        setSuccessToast(data.error || "참여에 실패했습니다.");
        setTimeout(() => setSuccessToast(null), 2500);
      }
    } catch {
      setSuccessToast("오류가 발생했습니다.");
      setTimeout(() => setSuccessToast(null), 2500);
    }
    setJoinLoading(null);
  };

  const available = campaigns.filter(c => !c.isMyCampaign);

  if (loading) {
    return (
      <div className="mb-5 bg-gradient-to-r from-brand-50 to-purple-50 rounded-xl border border-brand-100 p-4">
        <div className="flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin text-brand-500" />
          <span className="text-xs text-brand-600">브랜드 공동구매 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (available.length === 0) return null;

  return (
    <>
      <div className="mb-5">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-brand-50 to-purple-50 rounded-xl border border-brand-100 hover:border-brand-200 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Icon name="Cart" size={16} className="text-brand-600" />
            <span className="text-sm font-bold text-brand-700">참여 가능한 브랜드 공동구매</span>
            <span className="text-[10px] bg-brand-600 text-white px-1.5 py-0.5 rounded-full font-bold">{available.length}</span>
          </div>
          {expanded ? <Icon name="ChevronDown" size={16} className="text-brand-400 rotate-180" /> : <Icon name="ChevronDown" size={16} className="text-brand-400" />}
        </button>

        {/* Content */}
        {expanded && (
          <div className="mt-2 space-y-2">
            {available.map(c => {
              const discount = c.originalPrice > 0
                ? Math.round(((c.originalPrice - c.campaignPrice) / c.originalPrice) * 100)
                : 0;
              return (
                <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-3 hover:border-brand-200 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                      <SafeImage src={c.product.thumbnail} alt={c.product.name} width={48} height={48} fallbackText="P" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {c.product.brand && (
                          <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{c.product.brand.brandName}</span>
                        )}
                        <span className="text-[10px] text-gray-400">{c.product.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-brand-600">{formatPrice(c.campaignPrice)}</span>
                        {discount > 0 && (
                          <>
                            <span className="text-[10px] line-through text-gray-300">{formatPrice(c.originalPrice)}</span>
                            <span className="text-[10px] text-red-500 font-bold">-{discount}%</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                        <span><Icon name="Users" size={9} className="inline" /> {c.participantCount}명</span>
                        <span><Icon name="Clock" size={9} className="inline" /> {formatDate(c.startDate)}~{formatDate(c.endDate)}</span>
                      </div>
                    </div>

                    {/* Join button */}
                    <div className="flex-shrink-0">
                      {c.alreadyJoined ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-green-600 bg-green-50 px-2.5 py-1.5 rounded-lg font-medium">
                          <Icon name="Check" size={12} /> 참여중
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmTarget(c)}
                          disabled={joinLoading === c.id}
                          className="inline-flex items-center gap-1 text-xs text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-colors"
                        >
                          {joinLoading === c.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Icon name="Plus" size={12} />
                          )}
                          참여
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ★ 공동구매 참여 확인 팝업 */}
      {confirmTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmTarget(null)} />
          <div className="relative bg-white w-full max-w-[340px] rounded-2xl shadow-2xl overflow-hidden animate-popup-in">
            {/* 헤더 아이콘 영역 */}
            <div className="bg-gradient-to-br from-brand-50 via-purple-50 to-indigo-50 pt-8 pb-5 flex flex-col items-center relative">
              <button
                onClick={() => setConfirmTarget(null)}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/60 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white transition-all"
              >
                <X size={14} />
              </button>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center mb-3.5 shadow-lg shadow-brand-200">
                <Icon name="Cart" size={24} className="text-white" />
              </div>
              <h3 className="text-[16px] font-bold text-gray-900 mb-1">공동구매 참여</h3>
              <p className="text-[12px] text-gray-500 text-center px-6 leading-relaxed">
                이 공동구매에 참여하시겠습니까?<br />
                <span className="text-brand-600 font-medium">내 공동구매 관리</span>에 추가됩니다.
              </p>
            </div>

            {/* 상품 정보 카드 */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                  <SafeImage src={confirmTarget.product.thumbnail} alt={confirmTarget.product.name} width={56} height={56} fallbackText="P" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-gray-900 truncate">{confirmTarget.title}</p>
                  <p className="text-[11px] text-gray-400 truncate">{confirmTarget.product.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[13px] font-bold text-brand-600">{formatPrice(confirmTarget.campaignPrice)}</span>
                    {confirmTarget.originalPrice > confirmTarget.campaignPrice && (
                      <span className="text-[10px] text-gray-400 line-through">{formatPrice(confirmTarget.originalPrice)}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 혜택 정보 */}
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2.5 text-[11px] text-gray-600">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <Icon name="Users" size={12} className="text-emerald-500" />
                  </div>
                  <span>현재 <span className="font-bold text-emerald-600">{confirmTarget.participantCount}명</span> 참여중</span>
                </div>
                <div className="flex items-center gap-2.5 text-[11px] text-gray-600">
                  <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Icon name="Clock" size={12} className="text-blue-500" />
                  </div>
                  <span>{formatDate(confirmTarget.startDate)} ~ {formatDate(confirmTarget.endDate)}</span>
                </div>
                <div className="flex items-center gap-2.5 text-[11px] text-gray-600">
                  <div className="w-6 h-6 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <Icon name="Certified" size={12} className="text-purple-500" />
                  </div>
                  <span>브랜드 공식 공동구매 · 정품 보장</span>
                </div>
              </div>
            </div>

            {/* 버튼 */}
            <div className="px-5 pb-5 flex gap-2.5">
              <button
                onClick={() => setConfirmTarget(null)}
                className="flex-1 py-3 text-[13px] font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleJoinConfirm}
                className="flex-[1.5] py-3 text-[13px] font-bold text-white bg-gradient-to-r from-brand-600 to-purple-600 rounded-xl hover:from-brand-700 hover:to-purple-700 transition-all shadow-lg shadow-brand-200/50 flex items-center justify-center gap-1.5"
              >
                <Icon name="Check" size={15} />
                참여하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ★ 성공 토스트 */}
      {successToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[70] animate-toast-slide-down">
          <div className="bg-gray-900 text-white text-[13px] font-medium px-5 py-3 rounded-full shadow-xl flex items-center gap-2">
            <Icon name="Check" size={16} className="text-emerald-400" />
            {successToast}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes popup-in {
          0% { opacity: 0; transform: scale(0.92) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-popup-in { animation: popup-in 0.25s ease-out; }
        @keyframes toast-slide-down {
          0% { opacity: 0; transform: translate(-50%, -20px); }
          100% { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-toast-slide-down { animation: toast-slide-down 0.3s ease-out; }
      `}</style>
    </>
  );
}
