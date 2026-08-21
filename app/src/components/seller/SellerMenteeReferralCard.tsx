"use client";

import { useState } from "react";
import { Gift } from "lucide-react";

// 새로고침 아이콘 (라인형 SVG)
const RefreshIcon = ({ spinning }: { spinning: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`w-3 h-3 ${spinning ? "animate-spin" : ""}`}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
  </svg>
);

interface Props {
  referralCode: string | null;
  referralLink: string | null;
}

export default function SellerMenteeReferralCard({ referralCode: initialCode, referralLink: initialLink }: Props) {
  const [code, setCode] = useState(initialCode);
  const [link, setLink] = useState(initialLink);
  const [copied, setCopied] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(key);
        setTimeout(() => setCopied(null), 1500);
      } catch {}
    }
  };

  const share = async () => {
    const shareText = link
      ? `셀러 가입 추천인코드: ${code}\n가입 링크: ${link}`
      : `셀러 가입 추천인코드: ${code}`;
    const shareUrl = link ?? "";
    if (navigator.share) {
      try {
        await navigator.share({ title: "셀러 가입 추천", text: shareText, url: shareUrl });
        return;
      } catch {}
    }
    await copy(link ?? code ?? "", "share");
  };

  const issueCode = async () => {
    setIssuing(true);
    try {
      const res = await fetch("/api/seller/mentee-referral");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setCode(data.code);
      setLink(data.referralLink);
    } catch {
      alert("코드 발급에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 text-white">
      {/* 헤더 */}
      <div className="flex items-center gap-1.5 mb-2">
        <Gift size={15} className="text-amber-400" />
        <p className="text-[12px] font-bold">나의 추천 코드</p>
      </div>

      {!code ? (
        <div className="text-center py-2">
          <p className="text-xs text-white/40 mb-3">아직 추천인코드가 없습니다</p>
          <button
            onClick={issueCode}
            disabled={issuing}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-black text-xs font-bold rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors"
          >
            <RefreshIcon spinning={issuing} />
            {issuing ? "발급 중..." : "셀러가입 추천인코드 발급"}
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* 추천인코드 */}
          <div>
            <p className="text-[10px] font-medium text-white/40 mb-1">셀러가입 추천인코드</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[19px] font-extrabold tracking-wide bg-white/10 rounded-lg px-3 py-2 truncate">
                {code}
              </code>
              <button
                onClick={() => copy(code!, "code")}
                className="inline-flex items-center gap-1 text-[12px] font-bold bg-amber-500 text-black rounded-lg px-3 py-2.5 hover:bg-amber-400 transition-colors"
              >
                {copied === "code" ? "복사됨" : "복사"}
              </button>
            </div>
          </div>

          {/* 안내 박스 */}
          <div className="bg-white/10 rounded-xl px-3 py-2.5">
            <p className="text-[10.5px] text-white/60 leading-relaxed">
              이 코드로 가입한 셀러가 판매를 시작하면{" "}
              <b className="text-white/80">추천인 커미션</b>이 적립됩니다.{" "}
              <a href="/seller/mentees" className="text-amber-400/80 hover:text-amber-400 underline transition-colors">
                멘티셀러 관리 →
              </a>
            </p>
          </div>

          {/* 내 추천인 링크 */}
          {link && (
            <div className="pt-1">
              <div className="flex items-center gap-1.5 mb-1.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-white/40 flex-shrink-0">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                <p className="text-[10px] font-medium text-white/40">내 추천인 링크</p>
              </div>
              <div className="flex items-center gap-2 bg-amber-400/10 rounded-lg border border-amber-400/30 px-3 py-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-amber-500/70 flex-shrink-0">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                <span className="flex-1 text-[11px] text-amber-400/80 truncate font-mono">{link}</span>
              </div>
            </div>
          )}

          {/* 공유 버튼 그리드 */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={share}
              className="inline-flex items-center justify-center gap-1 text-[12px] font-bold bg-amber-500 text-black rounded-lg py-2.5 hover:bg-amber-400 transition-colors"
            >
              {copied === "share" ? "복사됨" : "공유하기"}
            </button>
            <button
              onClick={() => link && copy(link, "link")}
              disabled={!link}
              className="inline-flex items-center justify-center gap-1 text-[12px] font-bold bg-white/10 rounded-lg py-2.5 hover:bg-white/20 disabled:opacity-40 transition-colors"
            >
              {copied === "link" ? "복사됨" : "링크 복사"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
