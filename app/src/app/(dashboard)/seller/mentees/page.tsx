"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, TrendingUp, Copy, Check, Calendar, Package } from "lucide-react";

interface Mentee {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  shopName: string | null;
  isApproved: boolean;
  slug: string | null;
  thisMonthCommission: number;
  thisMonthBase: number;
}

interface Summary {
  period: string;
  total: number;
  totalBase: number;
  count: number;
  allTimeTotal: number;
}

const PERIOD_OPTIONS = [
  { value: "day", label: "오늘" },
  { value: "week", label: "이번 주" },
  { value: "month", label: "이번 달" },
];

export default function SellerMenteesPage() {
  const [mentees, setMentees] = useState<Mentee[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralLink, setReferralLink] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [menteesRes, summaryRes, refRes] = await Promise.all([
        fetch("/api/seller/mentees"),
        fetch(`/api/seller/mentees/summary?period=${period}`),
        fetch("/api/seller/mentee-referral"),
      ]);
      const [menteesData, summaryData, refData] = await Promise.all([
        menteesRes.json(),
        summaryRes.json(),
        refRes.json(),
      ]);
      setMentees(menteesData.mentees || []);
      setSummary(summaryData);
      setReferralCode(refData.code || null);
      setReferralLink(refData.referralLink || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const copy = async (text: string, type: "code" | "link") => {
    try { await navigator.clipboard.writeText(text); } catch { }
    if (type === "code") { setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); }
    else { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }
  };

  const formatPrice = (n: number) => n.toLocaleString("ko-KR") + "원";
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-gray-900">멘티셀러 관리</h1>
        <p className="text-xs text-gray-400 mt-0.5">내 추천인코드로 가입한 셀러와 추천인 커미션을 관리합니다</p>
      </div>

      {/* 추천인코드/링크 카드 */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Users size={16} className="text-blue-500" /> 내 셀러가입 추천인코드
        </p>
        {referralCode ? (
          <>
            <div className="flex items-center gap-2 bg-white rounded-lg border border-blue-100 px-3 py-2.5">
              <span className="flex-1 font-mono font-bold text-gray-900 tracking-widest">{referralCode}</span>
              <button onClick={() => copy(referralCode, "code")}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                {copiedCode ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                {copiedCode ? "복사됨" : "복사"}
              </button>
            </div>
            {referralLink && (
              <div className="flex items-center gap-2 bg-white rounded-lg border border-blue-100 px-3 py-2.5">
                <span className="flex-1 text-[11px] text-gray-500 truncate">{referralLink}</span>
                <button onClick={() => copy(referralLink, "link")}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                  {copiedLink ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                  {copiedLink ? "복사됨" : "복사"}
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">추천인코드를 불러오는 중...</p>
        )}
      </div>

      {/* 커미션 합계 카드 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">멘티셀러 커미션</h2>
          <div className="flex gap-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                  period === opt.value
                    ? "bg-brand-500 text-black"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-[11px] text-gray-400 mb-1">기간 커미션</p>
            <p className="text-xl font-bold text-gray-900">{formatPrice(summary?.total ?? 0)}</p>
            <p className="text-[10px] text-gray-400 mt-1">판매기준 {formatPrice(summary?.totalBase ?? 0)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-[11px] text-gray-400 mb-1">기간 건수</p>
            <p className="text-xl font-bold text-gray-900">{(summary?.count ?? 0).toLocaleString()}건</p>
          </div>
          <div className="bg-amber-400 rounded-xl p-4">
            <p className="text-[11px] text-black/70 mb-1">누적 총 커미션</p>
            <p className="text-xl font-bold text-black">{formatPrice(summary?.allTimeTotal ?? 0)}</p>
          </div>
        </div>
      </div>

      {/* 멘티 셀러 리스트 */}
      <div>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
          멘티 셀러 목록 ({mentees.length}명)
        </h2>

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
        ) : mentees.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 py-12 text-center">
            <Users size={32} className="mx-auto mb-2 text-gray-200" />
            <p className="text-sm text-gray-400">아직 추천한 셀러가 없습니다</p>
            <p className="text-xs text-gray-300 mt-1">추천인코드를 공유하면 가입한 셀러가 여기에 표시됩니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {mentees.map((mentee) => (
              <div key={mentee.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{mentee.shopName || mentee.name}</p>
                      {mentee.isApproved ? (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded-full font-medium">승인됨</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 bg-yellow-50 text-yellow-600 rounded-full font-medium">승인대기</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{mentee.name}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Calendar size={11} className="text-gray-300" />
                      <span className="text-[10px] text-gray-400">가입 {formatDate(mentee.createdAt)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-gray-400 mb-0.5">이번 달 멘토 커미션</p>
                    <p className="text-base font-bold text-blue-600">{formatPrice(mentee.thisMonthCommission)}</p>
                    {mentee.thisMonthBase > 0 && (
                      <p className="text-[10px] text-gray-400">
                        판매 {formatPrice(mentee.thisMonthBase)} 기준
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
