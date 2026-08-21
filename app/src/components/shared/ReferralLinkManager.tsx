"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import {Link2, TrendingUp, Percent, QrCode} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";

interface ReferralLinkManagerProps {
  slug: string;
  referralCode: string | null;
  referralCommissionRate: number;
  referralDiscountRate: number;
  pickDiscountRate: number;
  totalReferralEarnings: number;
  referredBuyersCount: number;
}

export default function ReferralLinkManager({
  slug,
  referralCode: initialCode,
  referralCommissionRate,
  referralDiscountRate,
  pickDiscountRate,
  totalReferralEarnings,
  referredBuyersCount,
}: ReferralLinkManagerProps) {
  const { appConfirm, appAlert } = useAppDialog();
  const [referralCode, setReferralCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const generateCode = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/seller/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.referralCode) setReferralCode(data.referralCode);
    } catch {
      appAlert("코드 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const referralLink = referralCode
    ? `${baseUrl}/auth/register?code=${referralCode}`
    : null;
  const shopLink = `${baseUrl}/shop/${slug}`;

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-brand-50 to-purple-50">
        <div className="flex items-center gap-2">
          <Link2 size={16} className="text-brand-600" />
          <h3 className="text-sm font-bold text-gray-900">추천인 시스템</h3>
        </div>
        <p className="text-[10px] text-gray-500 mt-0.5">추천인 링크로 가입한 회원이 구매 시 커미션이 적립됩니다</p>
      </div>

      <div className="p-4 space-y-4">
        {/* KPI */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <Icon name="Users" size={16} className="mx-auto text-brand-500 mb-1" />
            <p className="text-lg font-bold text-gray-900">{referredBuyersCount}</p>
            <p className="text-[9px] text-gray-400">추천 가입회원</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <Icon name="Wallet" size={16} className="mx-auto text-emerald-500 mb-1" />
            <p className="text-lg font-bold text-gray-900">{totalReferralEarnings.toLocaleString()}원</p>
            <p className="text-[9px] text-gray-400">총 커미션 수입</p>
          </div>
        </div>

        {/* 비율 정보 */}
        <div className="flex gap-2">
          <div className="flex-1 bg-brand-50 rounded-lg px-3 py-2">
            <p className="text-[9px] text-brand-600 font-medium">추천인 커미션</p>
            <p className="text-sm font-bold text-brand-700">{referralCommissionRate}%</p>
          </div>
          <div className="flex-1 bg-purple-50 rounded-lg px-3 py-2">
            <p className="text-[9px] text-purple-600 font-medium">추천인 할인</p>
            <p className="text-sm font-bold text-purple-700">{referralDiscountRate}%</p>
          </div>
          <div className="flex-1 bg-pink-50 rounded-lg px-3 py-2">
            <p className="text-[9px] text-pink-600 font-medium">Pick 할인</p>
            <p className="text-sm font-bold text-pink-700">{pickDiscountRate}%</p>
          </div>
        </div>

        {/* 추천인 코드 */}
        {referralCode ? (
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1.5">추천인 코드</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2.5 font-mono text-sm text-gray-800 tracking-wider">
                {referralCode}
              </div>
              <button
                onClick={() => copyToClipboard(referralCode, "code")}
                className="px-3 py-2.5 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {copied === "code" ? <Icon name="Check" size={16} className="text-emerald-500" /> : <Icon name="Copy" size={16} className="text-gray-500" />}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={generateCode}
            disabled={loading}
            className="btn-primary w-full py-2.5 text-sm"
          >
            {loading ? "생성 중..." : "추천인 코드 생성하기"}
          </button>
        )}

        {/* 추천인 링크 */}
        {referralLink && (
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1.5">추천인 가입 링크</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2.5 text-xs text-gray-600 truncate">
                {referralLink}
              </div>
              <button
                onClick={() => copyToClipboard(referralLink, "link")}
                className="px-3 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium flex items-center gap-1"
              >
                {copied === "link" ? <Icon name="Check" size={14} /> : <Icon name="Copy" size={14} />}
                {copied === "link" ? "복사됨" : "복사"}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              이 링크로 가입한 회원이 상품 구매 시 {referralCommissionRate}% 커미션이 적립됩니다
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
