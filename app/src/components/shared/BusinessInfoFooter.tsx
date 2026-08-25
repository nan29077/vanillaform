"use client";

import Link from "next/link";
import { FOOTER_DEFAULTS, type FooterSettings } from "@/lib/settings";

// 전자상거래법(소비자보호법)상 서비스 초기 화면(로그인/회원가입 등 (public) 레이아웃 밖 화면)
// 하단에 노출하는 사업자 정보 푸터.
// 표시 항목은 메인 푸터(components/layout/Footer.tsx)와 동일하게 맞춘다.
// 법인명 · 사업자등록 · 대표자 · 메일 · 고객센터 + 이용약관/개인정보처리방침.
export default function BusinessInfoFooter({ settings }: { settings?: FooterSettings }) {
  const f = settings ?? FOOTER_DEFAULTS;
  return (
    <footer className="w-full max-w-md mx-auto mt-8 pt-5 border-t border-gray-200 text-[10px] leading-relaxed text-gray-400">
      <div className="space-y-1">
        <p>
          <span className="text-gray-500">법인명</span> {f.companyName}
        </p>
        <p>
          <span className="text-gray-500">사업자등록</span> {f.bizNum}
        </p>
        <p>
          <span className="text-gray-500">대표자</span> {f.ceoName}
        </p>
        <p>
          <span className="text-gray-500">메일</span> {f.email}
        </p>
        <p>
          <span className="text-gray-500">고객센터</span> {f.phone}
        </p>
        <div className="flex gap-3 pt-1.5">
          <Link href="/support/terms" className="hover:text-gray-600">이용약관</Link>
          <Link href="/support/privacy" className="hover:text-gray-600">개인정보처리방침</Link>
        </div>
        <p className="pt-1">&copy; {f.copyright}</p>
      </div>
    </footer>
  );
}
