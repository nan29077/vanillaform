"use client";

import { Icon } from '@/components/shared/Icon';
import Link from "next/link";
import { useSession } from "next-auth/react";
;

interface SellerShopJoinCtaProps {
  sellerSlug: string;
  sellerName: string;
  /** 추천인 할인율(%) — undefined 면 일반 문구만 표시 */
  referralDiscountRate?: number;
}

/**
 * 셀러 페이지의 비로그인 방문자에게 "이 셀러로 가입하기" CTA 를 노출한다.
 *
 * 클릭 시 `/auth/register?ref=<slug>` 로 이동.
 * (셀러 페이지 진입 시점에 미들웨어가 이미 sb_ref 쿠키도 set 해두므로
 *  이후 다른 페이지를 거쳐도 7일 이내 가입 시 추천인이 유지된다.)
 */
export default function SellerShopJoinCta({
  sellerSlug,
  sellerName,
  referralDiscountRate,
}: SellerShopJoinCtaProps) {
  const { data: session, status } = useSession();

  // 로그인 상태 확정 전에는 아무것도 보여주지 않는다 (깜빡임 방지)
  if (status === "loading" || session) return null;

  const shopPath = `/shop/${encodeURIComponent(sellerSlug)}`;

  return (
    <div className="mt-3">
      <Link
        href={`/auth/register?ref=${encodeURIComponent(sellerSlug)}`}
        className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-brand-50 to-purple-50 border border-brand-100 hover:from-brand-100 hover:to-purple-100 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon name="Gift" size={16} className="text-brand-600 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-brand-700 truncate">
              {sellerName} 추천으로 가입하기
            </p>
            {typeof referralDiscountRate === "number" && referralDiscountRate > 0 ? (
              <p className="text-[10px] text-brand-600/80">
                가입 즉시 {referralDiscountRate}% 할인 혜택
              </p>
            ) : (
              <p className="text-[10px] text-brand-600/80">
                라이브 셀러 추천 회원 전용 혜택을 받아보세요
              </p>
            )}
          </div>
        </div>
        <span className="text-[11px] font-semibold text-brand-600 flex-shrink-0">
          가입하기 →
        </span>
      </Link>
      {/* 기존 회원이 분양몰에서 로그인하면 로그인 후 이 샵으로 복귀 */}
      <p className="text-[10px] text-gray-400 text-center mt-2">
        이미 회원이신가요?{" "}
        <Link
          href={`/auth/login?callbackUrl=${encodeURIComponent(shopPath)}`}
          className="text-brand-600 font-semibold hover:underline"
        >
          로그인
        </Link>
      </p>
    </div>
  );
}
