"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useEffect, useMemo } from "react";
import {Save, Users, Link2, Loader2, X, Square} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";
import SavedPopup from "@/components/shared/SavedPopup";
import Pagination, { usePagination } from "@/components/shared/Pagination";
import SafeImage from "@/components/shared/SafeImage";
import { pickSellerAvatar } from "@/lib/defaults";

interface SellerRate {
  id: string; shopName: string; shopLogo: string | null; slug: string;
  referralCode: string | null; referralCommissionRate: number; referralDiscountRate: number;
  pickDiscountRate: number; commissionRate: number; totalReferralEarnings: number; isApproved: boolean;
  _count: { referredBuyers: number; followers: number; channelVerifications: number };
}

export default function AdminSellerRatesPage() {
    const { appConfirm, appAlert } = useAppDialog();
const [sellers, setSellers] = useState<SellerRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, { referralCommissionRate: number; referralDiscountRate: number; pickDiscountRate: number }>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkValues, setBulkValues] = useState({ referralCommissionRate: "", referralDiscountRate: "", pickDiscountRate: "" });
  const [bulkSaving, setBulkSaving] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [mentorCommissionRate, setMentorCommissionRate] = useState<number>(1);
  const [mentorRateSaving, setMentorRateSaving] = useState(false);
  const [mentorRateSaved, setMentorRateSaved] = useState(false);
  const [showSavedPopup, setShowSavedPopup] = useState(false);

  useEffect(() => {
    fetch("/api/admin/mentor-commission-rate")
      .then((r) => r.json())
      .then((data) => setMentorCommissionRate(Number(data.mentorCommissionRate ?? 1)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/admin/seller-rates")
      .then((r) => r.json())
      .then((data) => {
        setSellers(data.sellers || []);
        const values: any = {};
        (data.sellers || []).forEach((s: SellerRate) => {
          values[s.id] = { referralCommissionRate: s.referralCommissionRate, referralDiscountRate: s.referralDiscountRate, pickDiscountRate: s.pickDiscountRate };
        });
        setEditValues(values);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sellers;
    const q = searchQuery.toLowerCase();
    return sellers.filter((s) => s.shopName.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q));
  }, [sellers, searchQuery]);

  const { pageItems, page, setPage, totalPages } = usePagination(filtered, 20);

  const handleSave = async (sellerId: string) => {
    const values = editValues[sellerId];
    if (!values) return;
    setSaving(sellerId);
    try {
      const res = await fetch("/api/admin/seller-rates", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId, ...values }),
      });
      if (res.ok) { setSaved(sellerId); setTimeout(() => setSaved(null), 2000); setShowSavedPopup(true); }
    } catch { appAlert("저장에 실패했습니다."); }
    finally { setSaving(null); }
  };

  const updateValue = (sellerId: string, field: string, value: number) => {
    setEditValues((prev) => ({ ...prev, [sellerId]: { ...prev[sellerId], [field]: value } }));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const toggleSelectAll = () => {
    const filteredIds = filtered.map(s => s.id);
    const allSelected = filteredIds.every(id => selectedIds.has(id));
    if (allSelected) { setSelectedIds(new Set()); } 
    else { setSelectedIds(new Set(filteredIds)); }
  };

  const handleBulkApply = async () => {
    if (selectedIds.size === 0) { appAlert("라이브 셀러를 선택하세요"); return; }
    setBulkSaving(true);
    try {
      for (const id of selectedIds) {
        const newValues = { ...editValues[id] };
        if (bulkValues.referralCommissionRate) newValues.referralCommissionRate = Number(bulkValues.referralCommissionRate);
        if (bulkValues.referralDiscountRate) newValues.referralDiscountRate = Number(bulkValues.referralDiscountRate);
        if (bulkValues.pickDiscountRate) newValues.pickDiscountRate = Number(bulkValues.pickDiscountRate);
        setEditValues((prev) => ({ ...prev, [id]: newValues }));
        await fetch("/api/admin/seller-rates", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sellerId: id, ...newValues }),
        });
      }
      appAlert(`${selectedIds.size}명의 라이브 셀러에게 할인율이 적용되었습니다.`);
      setSelectedIds(new Set());
      setBulkValues({ referralCommissionRate: "", referralDiscountRate: "", pickDiscountRate: "" });
      window.location.reload();
    } catch { appAlert("일괄 적용 실패"); }
    finally { setBulkSaving(false); }
  };

  const saveMentorRate = async () => {
    setMentorRateSaving(true);
    try {
      const res = await fetch("/api/admin/mentor-commission-rate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentorCommissionRate }),
      });
      if (res.ok) { setMentorRateSaved(true); setTimeout(() => setMentorRateSaved(false), 2000); }
      else { appAlert("저장에 실패했습니다."); }
    } catch { appAlert("저장에 실패했습니다."); }
    finally { setMentorRateSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-gray-400" /></div>;

  const allFilteredSelected = filtered.length > 0 && filtered.every(s => selectedIds.has(s.id));

  return (
    <div className="animate-fade-in">
      <SavedPopup show={showSavedPopup} onClose={() => setShowSavedPopup(false)} />
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Icon name="Settings" size={20} className="text-brand-600" />
          <h1 className="text-xl font-bold text-gray-900">멘티추천커미션·기타 할인율 설정</h1>
        </div>
        <p className="text-sm text-gray-500">멘토 추천인 커미션율 및 인플루언서별 할인율을 설정합니다</p>
      </div>

      {/* 멘토 추천인 커미션율 설정 */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-blue-500" />
          <div>
            <p className="text-sm font-bold text-gray-800">추천인 커미션율 (멘토-멘티)</p>
            <p className="text-[11px] text-gray-500">이 요율로 멘토 셀러의 추천인 커미션이 자동 적립됩니다</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white rounded-lg border border-blue-100 px-3 py-2 flex-1">
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={mentorCommissionRate}
              onChange={(e) => setMentorCommissionRate(Number(e.target.value))}
              className="flex-1 text-sm font-bold text-center bg-transparent outline-none"
            />
            <span className="text-sm font-medium text-gray-500">%</span>
          </div>
          <button
            onClick={saveMentorRate}
            disabled={mentorRateSaving}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
              mentorRateSaved
                ? "bg-green-100 text-green-700"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
          >
            {mentorRateSaving ? <Loader2 size={13} className="animate-spin" /> : mentorRateSaved ? <><Icon name="Check" size={13} /> 저장됨</> : <><Save size={13} /> 저장</>}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-2">
          예: 멘티 셀러 판매 100,000원 × {mentorCommissionRate}% = <b>{Math.round(100000 * mentorCommissionRate / 100).toLocaleString()}원</b>이 멘토 셀러에게 적립됩니다 (플랫폼 수수료에서 차감)
        </p>
      </div>

      {/* ★ 상세 설명 가이드 토글 */}
      <button
        onClick={() => setShowGuide(!showGuide)}
        className="w-full flex items-center justify-between px-4 py-3 mb-4 bg-gradient-to-r from-brand-50 to-indigo-50 rounded-xl border border-brand-100 hover:border-brand-200 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon name="Info" size={16} className="text-brand-600" />
          <span className="text-sm font-bold text-brand-700">할인/수수료 상세 가이드 및 예시 플로우</span>
        </div>
        {showGuide ? <Icon name="ChevronDown" size={16} className="text-brand-500 rotate-180" /> : <Icon name="ChevronDown" size={16} className="text-brand-500" />}
      </button>

      {showGuide && (
        <div className="mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* 1. 추천인 커미션 */}
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                <Icon name="Wallet" size={16} className="text-brand-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">① 추천인 커미션 (referralCommissionRate)</h3>
                <p className="text-[11px] text-gray-400">기본값: 3% | 범위: 0~20%</p>
              </div>
            </div>
            <div className="bg-brand-50 rounded-xl p-4 mb-3">
              <p className="text-xs text-gray-700 leading-relaxed">
                <b>정의:</b> 인플루언서가 자신의 추천 코드로 가입한 회원이 상품을 구매할 때, 해당 인플루언서에게 지급되는 수수료율입니다.
              </p>
              <p className="text-xs text-gray-600 leading-relaxed mt-2">
                <b>계산:</b> 추천 회원이 100,000원 상품 구매 시 → 100,000원 × 3% = <b className="text-brand-600">3,000원</b>이 인플루언서에게 적립됩니다.
              </p>
            </div>
            {/* 예시 플로우 */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-[11px] font-bold text-gray-600 mb-2.5">📋 예시 플로우</p>
              <div className="space-y-2.5">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon name="InviteFriend" size={10} className="text-blue-600" />
                  </div>
                  <div className="text-[11px] text-gray-600">
                    <b>1단계:</b> 라이브 셀러 "하늘 Pick"이 추천 코드 <span className="font-mono bg-white px-1 py-0.5 rounded text-brand-600 text-[10px]">HANEUL2024</span>를 팬에게 공유
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon name="InviteFriend" size={10} className="text-green-600" />
                  </div>
                  <div className="text-[11px] text-gray-600">
                    <b>2단계:</b> 팬 "김민수"가 추천 코드를 입력하여 바닐라폼에 회원가입 (회원가입 시 <b className="text-purple-600">추천인 할인 5%</b> 즉시 적용)
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon name="Cart" size={10} className="text-emerald-600" />
                  </div>
                  <div className="text-[11px] text-gray-600">
                    <b>3단계:</b> 김민수가 "실크 블라우스" 100,000원 상품 구매 → 추천인 할인 5% 적용 = <b>95,000원</b> 결제
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon name="Wallet" size={10} className="text-brand-600" />
                  </div>
                  <div className="text-[11px] text-gray-600">
                    <b>4단계:</b> 주문 완료 시 "하늘 Pick"에게 100,000원 × 3% = <b className="text-brand-600">3,000원 추천인 커미션</b> 자동 적립
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon name="Gift" size={10} className="text-orange-600" />
                  </div>
                  <div className="text-[11px] text-gray-600">
                    <b>5단계:</b> 추후 김민수가 다시 구매할 때마다 "하늘 Pick"에게 3%의 추천인 커미션이 계속 적립 (영구 연결)
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. 추천인 할인 */}
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <Icon name="Discount" size={16} className="text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">② 추천인 할인 (referralDiscountRate)</h3>
                <p className="text-[11px] text-gray-400">기본값: 5% | 범위: 0~10%</p>
              </div>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 mb-3">
              <p className="text-xs text-gray-700 leading-relaxed">
                <b>정의:</b> 인플루언서의 추천 코드로 가입한 신규 회원이 받는 할인율입니다. 가입 즉시 적용되며, 이후 모든 구매에 적용됩니다.
              </p>
              <p className="text-xs text-gray-600 leading-relaxed mt-2">
                <b>구매자 혜택:</b> 100,000원 상품을 <b className="text-purple-600">5% 할인된 95,000원</b>에 구매 가능합니다.
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-[11px] font-bold text-gray-600 mb-2">💡 추천인 할인 플로우</p>
              <div className="flex items-center gap-2 text-[11px] text-gray-500 flex-wrap">
                <span className="bg-white px-2 py-1 rounded-lg border border-gray-200">추천 코드 입력하여 가입</span>
                <Icon name="ArrowRight" size={12} className="text-gray-300" />
                <span className="bg-white px-2 py-1 rounded-lg border border-gray-200">BuyerProfile에 추천셀러 연결</span>
                <Icon name="ArrowRight" size={12} className="text-gray-300" />
                <span className="bg-purple-100 px-2 py-1 rounded-lg border border-purple-200 text-purple-700 font-medium">구매 시 자동 할인 적용</span>
              </div>
              <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                <p className="text-[10px] text-amber-700">
                  ⚠️ <b>중요:</b> 추천인 할인과 Pick+채널인증 할인은 중복 적용되지 않습니다. 둘 다 해당하는 경우 <b>더 높은 할인율</b>이 자동 적용됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* 3. Pick 채널인증 할인 */}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center">
                <Icon name="Wishlist" size={16} className="text-pink-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">③ Pick + 채널인증 할인 (pickDiscountRate)</h3>
                <p className="text-[11px] text-gray-400">기본값: 3% | 범위: 0~5%</p>
              </div>
            </div>
            <div className="bg-pink-50 rounded-xl p-4 mb-3">
              <p className="text-xs text-gray-700 leading-relaxed">
                <b>정의:</b> 구매자가 특정 셀러를 "Pick"(팔로우)하고, SNS 채널 구독 인증을 완료한 경우 적용되는 추가 할인율입니다.
              </p>
              <p className="text-xs text-gray-600 leading-relaxed mt-2">
                <b>조건:</b> ① 라이브 셀러 Pick(팔로우) 완료 <b>+</b> ② 해당 라이브 셀러의 유튜브/인스타 등 SNS 채널 구독 인증 완료 → 두 조건 모두 충족 시 할인 적용
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-[11px] font-bold text-gray-600 mb-2">📋 Pick+채널인증 할인 예시 플로우</p>
              <div className="space-y-2.5">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon name="Wishlist" size={10} className="text-pink-600" />
                  </div>
                  <div className="text-[11px] text-gray-600">
                    <b>1단계:</b> 구매자 "김민수"가 라이브 셀러 "수아 뷰티랩"을 <b>Pick</b>(팔로우) → SellerFollower 레코드 생성
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon name="Phone" size={10} className="text-blue-600" />
                  </div>
                  <div className="text-[11px] text-gray-600">
                    <b>2단계:</b> 김민수가 수아 뷰티랩의 유튜브 채널 구독 인증 → <b>ChannelVerification</b> (status: VERIFIED)
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon name="Cart" size={10} className="text-emerald-600" />
                  </div>
                  <div className="text-[11px] text-gray-600">
                    <b>3단계:</b> 김민수가 수아 뷰티랩의 상품 50,000원 구매 시 → 3% 할인 = <b className="text-pink-600">1,500원 할인</b> → <b>48,500원</b> 결제
                  </div>
                </div>
              </div>
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-[10px] text-blue-700">
                  ℹ️ Pick+채널인증 할인은 <b>해당 라이브 셀러의 상품 구매 시에만</b> 적용됩니다. 다른 라이브 셀러의 상품에는 적용되지 않습니다.
                </p>
              </div>
            </div>
          </div>

          {/* 수익 분배 종합 예시 */}
          <div className="p-5 bg-gradient-to-br from-gray-50 to-brand-50 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 mb-3">💰 종합 수익 분배 예시</h3>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs text-gray-500 mb-3">상품가격 100,000원 | 라이브 셀러 기본 수수료 10% | 추천인 커미션 3% | 추천인 할인 5%</p>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-600">상품 정가</span>
                  <span className="font-bold">100,000원</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-purple-600">추천인 할인 (5%)</span>
                  <span className="font-bold text-purple-600">-5,000원</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-600">구매자 실 결제액</span>
                  <span className="font-bold">95,000원</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-blue-600">라이브 셀러 기본 커미션 (10%)</span>
                  <span className="font-bold text-blue-600">10,000원</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-brand-600">추천인 커미션 (3%)</span>
                  <span className="font-bold text-brand-600">3,000원</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-600">플랫폼 수익</span>
                  <span className="font-bold text-gray-600">약 82,000원 (공급원가에서 분배)</span>
                </div>
                <div className="flex justify-between py-2 bg-brand-50 rounded-lg px-2 mt-2">
                  <span className="font-bold text-brand-700">브랜드/공급자 정산</span>
                  <span className="font-extrabold text-brand-700">약 70,000~80,000원</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search + Bulk Select */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="라이브 셀러명 검색..." className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white" />
          {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
        </div>
        <button onClick={toggleSelectAll}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${allFilteredSelected ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
          {allFilteredSelected ? <Icon name="Check" size={14} /> : <Square size={14} />} 전체선택
        </button>
      </div>

      {/* Bulk Apply Panel */}
      {selectedIds.size > 0 && (
        <div className="mb-4 bg-brand-50 rounded-xl border border-brand-200 p-4">
          <p className="text-xs font-bold text-brand-700 mb-3">{selectedIds.size}명 선택됨 - 일괄 적용</p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-[10px] font-semibold text-brand-600 mb-1">추천인 커미션 (%)</label>
              <input type="number" min={0} max={20} step={0.5} value={bulkValues.referralCommissionRate}
                onChange={(e) => setBulkValues({ ...bulkValues, referralCommissionRate: e.target.value })}
                className="input-field text-sm py-2 text-center font-medium" placeholder="미변경" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-purple-600 mb-1">추천인 할인 (%)</label>
              <input type="number" min={0} max={10} step={0.5} value={bulkValues.referralDiscountRate}
                onChange={(e) => setBulkValues({ ...bulkValues, referralDiscountRate: e.target.value })}
                className="input-field text-sm py-2 text-center font-medium" placeholder="미변경" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-pink-600 mb-1">Pick 할인 (%)</label>
              <input type="number" min={0} max={5} step={0.5} value={bulkValues.pickDiscountRate}
                onChange={(e) => setBulkValues({ ...bulkValues, pickDiscountRate: e.target.value })}
                className="input-field text-sm py-2 text-center font-medium" placeholder="미변경" />
            </div>
          </div>
          <button onClick={handleBulkApply} disabled={bulkSaving}
            className="btn-primary w-full py-2.5 text-sm font-bold flex items-center justify-center gap-1.5">
            {bulkSaving ? <><Loader2 size={14} className="animate-spin" /> 적용 중...</> : <><Icon name="Discount" size={14} /> {selectedIds.size}명에게 일괄 적용</>}
          </button>
        </div>
      )}

      {/* Description */}
      <div className="bg-gradient-to-r from-brand-50 to-purple-50 rounded-xl border border-brand-100 p-4 mb-6">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div><p className="text-[10px] text-brand-600 font-semibold mb-0.5">추천인 커미션</p><p className="text-[10px] text-gray-500">추천 코드 구매 시 인플루언서 적립</p></div>
          <div><p className="text-[10px] text-purple-600 font-semibold mb-0.5">추천인 할인</p><p className="text-[10px] text-gray-500">추천 코드 가입 회원 할인</p></div>
          <div><p className="text-[10px] text-pink-600 font-semibold mb-0.5">Pick 채널인증 할인</p><p className="text-[10px] text-gray-500">Pick+구독인증 회원 할인</p></div>
        </div>
      </div>

      <div className="space-y-3">
        {pageItems.map((seller) => {
          const values = editValues[seller.id] || { referralCommissionRate: seller.referralCommissionRate, referralDiscountRate: seller.referralDiscountRate, pickDiscountRate: seller.pickDiscountRate };
          const isChanged = values.referralCommissionRate !== seller.referralCommissionRate || values.referralDiscountRate !== seller.referralDiscountRate || values.pickDiscountRate !== seller.pickDiscountRate;
          const isSelected = selectedIds.has(seller.id);

          return (
            <div key={seller.id} className={`bg-white rounded-xl border overflow-hidden transition-all ${isSelected ? "border-brand-300 ring-1 ring-brand-200" : "border-gray-100"}`}>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                <button onClick={() => toggleSelect(seller.id)} className="flex-shrink-0">
                  {isSelected ? <Icon name="Check" size={18} className="text-brand-600" /> : <Square size={18} className="text-gray-300" />}
                </button>
                <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                  <SafeImage src={seller.shopLogo} alt={seller.shopName} width={40} height={40} placeholder={pickSellerAvatar(seller.id)} fallbackText={seller.shopName.charAt(0)} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-900">{seller.shopName}</p>
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${seller.isApproved ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>
                      {seller.isApproved ? "승인됨" : "대기중"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-0.5">
                    <span className="flex items-center gap-0.5"><Link2 size={10} /> 추천 {seller._count.referredBuyers}명</span>
                    <span className="flex items-center gap-0.5"><Icon name="Wishlist" size={10} /> Pick {seller._count.followers}명</span>
                    <span className="flex items-center gap-0.5"><Icon name="Wallet" size={10} /> {seller.totalReferralEarnings.toLocaleString()}원</span>
                  </div>
                </div>
                <button onClick={() => handleSave(seller.id)} disabled={!isChanged || saving === seller.id}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    saved === seller.id ? "bg-emerald-50 text-emerald-600" : isChanged ? "bg-brand-600 text-white hover:bg-brand-700" : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}>
                  {saving === seller.id ? <Loader2 size={12} className="animate-spin" /> : saved === seller.id ? <><Icon name="Check" size={12} /> 저장됨</> : <><Save size={12} /> 저장</>}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 px-4 py-3">
                <div>
                  <label className="block text-[10px] font-semibold text-brand-600 mb-1">추천인 커미션 (%)</label>
                  <input type="number" min={0} max={20} step={0.5} value={values.referralCommissionRate}
                    onChange={(e) => updateValue(seller.id, "referralCommissionRate", Number(e.target.value))} className="input-field text-sm py-2 text-center font-medium" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-purple-600 mb-1">추천인 할인 (%)</label>
                  <input type="number" min={0} max={10} step={0.5} value={values.referralDiscountRate}
                    onChange={(e) => updateValue(seller.id, "referralDiscountRate", Number(e.target.value))} className="input-field text-sm py-2 text-center font-medium" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-pink-600 mb-1">Pick 할인 (%)</label>
                  <input type="number" min={0} max={5} step={0.5} value={values.pickDiscountRate}
                    onChange={(e) => updateValue(seller.id, "pickDiscountRate", Number(e.target.value))} className="input-field text-sm py-2 text-center font-medium" />
                </div>
              </div>
              {seller.referralCode && <div className="px-4 pb-3"><p className="text-[10px] text-gray-400">추천인 코드: <span className="font-mono text-gray-600">{seller.referralCode}</span></p></div>}
            </div>
          );
        })}
      </div>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
