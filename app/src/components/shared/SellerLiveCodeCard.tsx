"use client";

import { Icon } from '@/components/shared/Icon';
import { useEffect, useState } from "react";

// 셀러 대시보드: 내 라이브 코드 + 내 라이브 링크 + 공유(카카오톡/링크).
export default function SellerLiveCodeCard({ code, shopName }: { code: string; shopName: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  // 공유 링크: 방송 여부에 따라 라이브 시청 페이지/외부 라이브/셀러샵으로 서버에서 분기 리다이렉트
  //
  // origin 은 클라이언트에서만 확정된다. 렌더 중에 window 를 읽으면 서버 HTML("")과
  // 클라이언트("https://...")의 텍스트가 달라져 hydration 이 깨지므로 마운트 후에 채운다.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const liveEntryUrl = `${origin}/live-code/${code}`;
  const message = `[${shopName}] 라이브 코드: ${code}\n아래 링크를 열면 방송 중일 때 라이브로, 방송 전이면 셀러샵으로 바로 이동해요!\n${liveEntryUrl}`;

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  // 통합 공유: 카카오 SDK 로드 시 카카오톡 공유 → 없으면 Web Share API → 둘 다 없으면 클립보드 복사
  const share = (text: string, url: string, title: string, fallbackKey: string) => {
    const w = window as any;
    if (w.Kakao?.Share?.sendDefault) {
      try {
        w.Kakao.Share.sendDefault({
          objectType: "feed",
          content: { title, description: text, link: { webUrl: url, mobileWebUrl: url } },
        });
        return;
      } catch {}
    }
    if (navigator.share) {
      navigator.share({ title, text, url }).catch(() => {});
      return;
    }
    copy(text + "\n" + url, fallbackKey);
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 text-white">
      {/* 라이브 코드 헤더 */}
      <div className="flex items-center gap-1.5 mb-2">
        <Icon name="Live" size={15} className="text-amber-400" />
        <p className="text-[12px] font-bold">내 라이브 코드</p>
      </div>

      {/* 코드 필드 */}
      <div className="flex items-center gap-2">
        <code className="flex-1 text-[19px] font-extrabold tracking-wide bg-white/10 rounded-lg px-3 py-2 truncate">{code}</code>
        <button
          onClick={() => copy(code, "code")}
          className="inline-flex items-center gap-1 text-[12px] font-bold bg-amber-500 text-black rounded-lg px-3 py-2.5 hover:bg-amber-400 transition-colors"
        >
          {copied === "code" ? "복사됨" : "복사"}
        </button>
      </div>

      {/* 안내 문구 */}
      <p className="text-[10.5px] text-white/60 mt-2 leading-relaxed">
        고객이 이 코드로 공유 링크를 열면 <b className="text-white/80">방송 중일 땐 라이브</b>로, 방송 전이면 <b className="text-white/80">{shopName} 샵</b>으로 바로 이동해요.
      </p>

      {/* 내 라이브 링크 */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="flex items-center gap-1.5 mb-1.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-white/40 flex-shrink-0">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          <p className="text-[10px] font-medium text-white/40">내 라이브 링크</p>
        </div>
        <div className="flex items-center gap-2 bg-amber-400/10 rounded-lg border border-amber-400/30 px-3 py-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-amber-500/70 flex-shrink-0">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          <a
            href={liveEntryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-[11px] text-amber-600 truncate hover:text-amber-700 transition-colors"
          >
            {liveEntryUrl}
          </a>
        </div>
        {/* 버튼 영역: 링크복사 + 공유하기 */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => copy(liveEntryUrl, "link")}
            className="flex-1 inline-flex items-center justify-center gap-1 text-[12px] font-bold bg-amber-500 text-black rounded-lg py-2.5 hover:bg-amber-400 transition-colors"
          >
            {copied === "link" ? "복사됨" : "링크복사"}
          </button>
          <button
            onClick={() => share(message, liveEntryUrl, `${shopName} 라이브`, "share")}
            className="flex-1 inline-flex items-center justify-center gap-1 text-[12px] font-bold bg-amber-500 text-black rounded-lg py-2.5 hover:bg-amber-400 transition-colors"
          >
            {copied === "share" ? "복사됨" : "공유하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
