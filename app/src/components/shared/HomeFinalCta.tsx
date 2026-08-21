"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import Link from "next/link";
import {} from 'lucide-react';

// 메인 최종 CTA — 회원가입 / 셀러로 시작하기 2개 탭
export default function HomeFinalCta({ sellerCtaLink }: { sellerCtaLink: string }) {
  const [tab, setTab] = useState<"join" | "seller">("join");

  return (
    <section className="px-4 pt-2 pb-9">
      <div className="relative overflow-hidden rounded-3xl bg-gray-900 px-6 py-8 text-center">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-brand-500/20 blur-2xl" />
        <div className="absolute -bottom-12 -left-12 w-44 h-44 rounded-full bg-rose-500/10 blur-2xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 text-brand-300 px-3 py-1 mb-4">
            <Icon name="Rocket" size={13} /> <span className="text-[11px] font-bold tracking-wide">START NOW</span>
          </div>

          {/* 탭 */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/10 mb-5">
            <button
              onClick={() => setTab("join")}
              className={`flex-1 py-2 rounded-xl text-[13px] font-bold transition-colors flex items-center justify-center gap-1 ${
                tab === "join" ? "bg-brand-500 text-black" : "text-white/70"
              }`}
            >
              <Icon name="InviteFriend" size={14} /> 회원가입
            </button>
            <button
              onClick={() => setTab("seller")}
              className={`flex-1 py-2 rounded-xl text-[13px] font-bold transition-colors flex items-center justify-center gap-1 ${
                tab === "seller" ? "bg-brand-500 text-black" : "text-white/70"
              }`}
            >
              <Icon name="Store" size={14} /> 라이브 셀러로 시작하기
            </button>
          </div>

          {tab === "join" ? (
            <div>
              <h2 className="text-[22px] font-extrabold text-white leading-tight">
                지금 바로<br />바닐라폼를 시작하세요
              </h2>
              <p className="mt-3 text-[13px] text-gray-300 leading-relaxed">
                좋아하는 라이브 셀러를 PICK하고<br />라이브·공동구매를 즐겨보세요.
              </p>
              <Link
                href="/auth/register"
                className="mt-6 flex items-center justify-center gap-1.5 w-full py-3.5 rounded-2xl bg-brand-500 text-black text-[14px] font-extrabold active:scale-[0.98] transition-transform"
              >
                회원 가입 <Icon name="ChevronDown" size={17} className="-rotate-90" />
              </Link>
            </div>
          ) : (
            <div>
              <h2 className="text-[22px] font-extrabold text-white leading-tight">
                내 팬과 함께<br />나만의 샵을 열다
              </h2>
              <ul className="mt-4 space-y-1.5 text-left inline-block">
                {["소싱·재고 부담 없이 브랜드 상품 판매", "판매 커미션 + 추천 수익", "라이브·공동구매 판매 채널 제공"].map((t) => (
                  <li key={t} className="flex items-center gap-2 text-[12.5px] text-gray-200">
                    <span className="w-4 h-4 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
                      <Icon name="Check" size={11} strokeWidth={3} className="text-black" />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
              <Link
                href={sellerCtaLink}
                className="mt-6 flex items-center justify-center gap-1.5 w-full py-3.5 rounded-2xl bg-brand-500 text-black text-[14px] font-extrabold active:scale-[0.98] transition-transform"
              >
                <Icon name="Store" size={16} /> 라이브 셀러 입점 신청
              </Link>
              <p className="mt-2 text-[10px] text-gray-400">신청 후 최고관리자 승인 시 라이브 셀러 기능이 활성화돼요</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
