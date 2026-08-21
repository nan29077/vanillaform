"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {} from 'lucide-react';

export default function HomeStartTabs() {
  const [tab, setTab] = useState<"signup" | "seller">("signup");

  return (
    <section className="px-4 pt-2 pb-9">
      <div className="relative overflow-hidden rounded-3xl bg-gray-900 px-6 pt-8 pb-8 text-center">
        {/* 배경 장식 */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-brand-500/20 blur-2xl" />
        <div className="absolute -bottom-12 -left-12 w-44 h-44 rounded-full bg-rose-500/10 blur-2xl" />

        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 text-brand-300 px-3 py-1 mb-4">
            <Icon name="Rocket" size={13} /> <span className="text-[11px] font-bold tracking-wide">START NOW</span>
          </div>
          <h2 className="text-[24px] font-extrabold text-white leading-tight">
            지금 바로<br />바닐라폼를 시작하세요
          </h2>
          <p className="mt-3 text-[13px] text-gray-300 leading-relaxed">
            좋아하는 라이브 셀러의 라이브를 즐기거나,<br />나만의 샵을 열어 판매를 시작해보세요.
          </p>

          {/* 탭 버튼 */}
          <div className="flex mt-6 rounded-2xl bg-white/10 p-1 gap-1">
            <button
              type="button"
              onClick={() => setTab("signup")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold transition-colors ${
                tab === "signup" ? "bg-white text-gray-900" : "text-white/70 hover:text-white"
              }`}
            >
              <Icon name="InviteFriend" size={15} strokeWidth={1.8} /> 시청자회원 가입하기
            </button>
            <button
              type="button"
              onClick={() => setTab("seller")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold transition-colors ${
                tab === "seller" ? "bg-white text-gray-900" : "text-white/70 hover:text-white"
              }`}
            >
              <Icon name="Store" size={15} strokeWidth={1.8} /> 라이브 셀러로 시작하기
            </button>
          </div>

          {/* 탭 콘텐츠 */}
          {tab === "signup" ? (
            <div className="mt-5">
              <p className="text-[12px] text-gray-400 mb-3">
                구매자로 가입하고 좋아하는 라이브 셀러를 PICK하세요.
              </p>
              <Link
                href="/auth/register"
                className="flex items-center justify-center gap-1.5 w-full py-3.5 rounded-2xl bg-brand-500 text-black text-[14px] font-extrabold active:scale-[0.98] transition-transform"
              >
                이메일로 가입하기 <Icon name="ChevronDown" size={17} className="-rotate-90" />
              </Link>
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[11px] text-gray-500">또는 소셜 계정으로</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => signIn("kakao", { callbackUrl: "/" })}
                  className="flex items-center justify-center gap-1 py-2.5 rounded-xl text-[12px] font-bold bg-[#FEE500] text-[#3C1E1E] active:scale-[0.97] transition-transform"
                >
                  카카오
                </button>
                <button
                  type="button"
                  onClick={() => signIn("naver", { callbackUrl: "/" })}
                  className="flex items-center justify-center gap-1 py-2.5 rounded-xl text-[12px] font-bold bg-[#03C75A] text-white active:scale-[0.97] transition-transform"
                >
                  네이버
                </button>
                <button
                  type="button"
                  onClick={() => signIn("google", { callbackUrl: "/" })}
                  className="flex items-center justify-center gap-1 py-2.5 rounded-xl text-[12px] font-bold bg-white text-gray-700 active:scale-[0.97] transition-transform"
                >
                  구글
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <p className="text-[12px] text-gray-400 mb-4">
                소싱 걱정 없이 브랜드 상품을 골라 나만의 샵을 열어보세요.
              </p>
              <Link
                href="/become-seller"
                className="flex items-center justify-center gap-1.5 w-full py-3.5 rounded-2xl bg-brand-500 text-black text-[14px] font-extrabold active:scale-[0.98] transition-transform"
              >
                라이브 셀러 신청하기 <Icon name="ChevronDown" size={17} className="-rotate-90" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
