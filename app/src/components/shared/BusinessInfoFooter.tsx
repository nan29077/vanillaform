"use client";

import Link from "next/link";
import { FOOTER_DEFAULTS, type FooterSettings } from "@/lib/settings";

// 전자상거래법(소비자보호법)상 서비스 초기 화면(로그인/회원가입 등 (public) 레이아웃 밖 화면)
// 하단에 노출해야 하는 사업자 정보 푸터.
// 상호·대표·사업자등록번호·통신판매업 신고번호·전화·이메일·주소 + 이용약관/개인정보처리방침.
export default function BusinessInfoFooter({ settings }: { settings?: FooterSettings }) {
  const f = settings ?? FOOTER_DEFAULTS;
  return (
    <footer className="w-full max-w-md mx-auto mt-8 pt-5 border-t border-gray-200 text-[10px] leading-relaxed text-gray-400">
      <div className="space-y-1">
        <p>
          <span className="text-gray-500">상호</span> {f.companyName}
          <span className="mx-1.5 text-gray-300">|</span>
          <span className="text-gray-500">대표</span> {f.ceoName}
        </p>
        <p>
          <span className="text-gray-500">사업자등록번호</span> {f.bizNum}
          <span className="mx-1.5 text-gray-300">|</span>
          <span className="text-gray-500">통신판매업 신고번호</span> {f.mailOrderNum}
        </p>
        <p>
          <span className="text-gray-500">전화</span> {f.phone}
          <span className="mx-1.5 text-gray-300">|</span>
          <span className="text-gray-500">이메일</span> support@vanillaform.local
        </p>
        <p>
          <span className="text-gray-500">주소</span> {f.address}
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
