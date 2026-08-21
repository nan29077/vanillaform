"use client";
import { Icon } from '@/components/shared/Icon';

;

interface ShareButtonProps {
  title: string;
  url?: string;
}

export default function ShareButton({ title, url }: ShareButtonProps) {
  const handleShare = async () => {
    const shareUrl = url || window.location.href;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl });
        return;
      } catch (e: any) {
        // 사용자가 공유를 취소한 경우 무시
        if (e?.name === "AbortError") return;
      }
    }

    // fallback: 클립보드 복사
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("링크가 클립보드에 복사되었습니다.");
    } catch {
      alert("공유 링크: " + shareUrl);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="-mr-1 p-1.5 text-gray-900 hover:opacity-60 transition-opacity"
      aria-label="공유하기"
    >
      <Icon name="Share" size={28} strokeWidth={1.5} />
    </button>
  );
}
