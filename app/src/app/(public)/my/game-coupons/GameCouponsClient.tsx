"use client";

import { Icon } from '@/components/shared/Icon';
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2} from 'lucide-react';

interface GameCoupon {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  minOrderAmount: number;
  gameTitle: string;
  sellerId: string;
  sellerName: string;
  sellerSlug: string | null;
  usedAt: string | null;
  expiresAt: string;
  status: "available" | "used" | "expired";
}

type Filter = "available" | "used" | "expired";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "available", label: "사용 가능" },
  { key: "used", label: "사용 완료" },
  { key: "expired", label: "만료됨" },
];

export default function GameCouponsClient() {
  const [coupons, setCoupons] = useState<GameCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("available");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/my/game-coupons", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setCoupons(data.coupons || []);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const copy = (code: string) => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const counts = {
    available: coupons.filter((c) => c.status === "available").length,
    used: coupons.filter((c) => c.status === "used").length,
    expired: coupons.filter((c) => c.status === "expired").length,
  };
  const filtered = coupons.filter((c) => c.status === filter);

  const discountLabel = (c: GameCoupon) =>
    c.discountType === "PERCENT" ? `${c.discountValue}%` : `${c.discountValue.toLocaleString()}원`;

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("ko-KR");

  return (
    <div className="animate-fade-in pb-8">
      {/* 헤더 */}
      <div className="bg-brand-500 px-4 pt-5 pb-6">
        <div className="flex items-center gap-2">
          <Link href="/my" className="p-1 -ml-1 text-gray-800 hover:text-gray-900">
            <Icon name="ArrowRight" size={20} className="rotate-180" />
          </Link>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-1.5">
            <Icon name="Gift" size={18} /> 게임 당첨 쿠폰
          </h1>
        </div>
        <p className="text-xs text-gray-800/70 mt-1 ml-7">라이브 게임에서 당첨된 쿠폰을 확인하세요</p>
      </div>

      {/* 필터 탭 */}
      <div className="px-4 -mt-3">
        <div className="bg-white rounded-xl border border-gray-100 p-1 flex">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                filter === f.key ? "bg-brand-500 text-gray-900" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {f.label}
              <span className="ml-1 text-[10px]">{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      <div className="px-4 mt-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-300">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Icon name="Coupon" size={40} strokeWidth={1.5} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs">
              {filter === "available"
                ? "사용 가능한 게임 쿠폰이 없습니다."
                : filter === "used"
                  ? "사용한 쿠폰이 없습니다."
                  : "만료된 쿠폰이 없습니다."}
            </p>
          </div>
        ) : (
          filtered.map((c) => {
            const dim = c.status !== "available";
            return (
              <div
                key={c.id}
                className={`relative bg-white rounded-2xl border overflow-hidden ${
                  dim ? "border-gray-100 opacity-70" : "border-brand-100"
                }`}
              >
                <div className="flex">
                  {/* 좌측 할인 */}
                  <div
                    className={`w-24 shrink-0 flex flex-col items-center justify-center py-4 ${
                      dim ? "bg-gray-100" : "bg-brand-50"
                    }`}
                  >
                    <div className={`flex items-center ${dim ? "text-gray-400" : "text-brand-600"}`}>
                      {c.discountType === "PERCENT" ? <Icon name="Discount" size={16} /> : <Icon name="Wallet" size={16} />}
                    </div>
                    <p className={`text-lg font-black ${dim ? "text-gray-400" : "text-brand-600"}`}>
                      {discountLabel(c)}
                    </p>
                    <p className="text-[10px] text-gray-400">할인</p>
                  </div>

                  {/* 우측 정보 */}
                  <div className="flex-1 min-w-0 p-3.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                          c.status === "available"
                            ? "bg-emerald-50 text-emerald-600"
                            : c.status === "used"
                              ? "bg-gray-100 text-gray-500"
                              : "bg-red-50 text-red-500"
                        }`}
                      >
                        {c.status === "available" ? (
                          <><Icon name="Check" size={10} /> 사용 가능</>
                        ) : c.status === "used" ? (
                          <><Icon name="Clock" size={10} /> 사용 완료</>
                        ) : (
                          <><Icon name="Close" size={10} /> 만료됨</>
                        )}
                      </span>
                    </div>
                    <p className="text-[13px] font-bold text-gray-900 truncate">{c.gameTitle}</p>
                    <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                      <Icon name="Store" size={11} /> {c.sellerName} 전용
                    </p>
                    {c.minOrderAmount > 0 && (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {c.minOrderAmount.toLocaleString()}원 이상 구매 시
                      </p>
                    )}

                    {/* 코드 + 만료 */}
                    <div className="flex items-center justify-between mt-2 gap-2">
                      <button
                        onClick={() => copy(c.code)}
                        disabled={dim}
                        className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-1 rounded-md border ${
                          dim
                            ? "border-gray-100 text-gray-400 cursor-default"
                            : "border-brand-100 bg-brand-50/50 text-brand-700 hover:bg-brand-50"
                        }`}
                      >
                        {copied === c.code ? <Icon name="Check" size={11} /> : <Icon name="Copy" size={11} />}
                        {c.code}
                      </button>
                      <span className="text-[10px] text-gray-400 shrink-0">~{fmtDate(c.expiresAt)}</span>
                    </div>
                  </div>
                </div>

                {/* 샵으로 이동 */}
                {c.status === "available" && c.sellerSlug && (
                  <Link
                    href={`/shop/${c.sellerSlug}`}
                    className="block text-center py-2.5 bg-brand-500 hover:bg-brand-600 text-gray-900 text-xs font-bold transition-colors"
                  >
                    이 셀러 샵에서 사용하기
                  </Link>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
