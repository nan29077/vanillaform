"use client";

import { useEffect } from "react";

interface SavedPopupProps {
  show: boolean;
  onClose: () => void;
}

/**
 * 저장 완료 팝업 — 바닐라 플라워 플라워 테마
 * - 화면 상단 중앙 고정, 2.5초 후 자동 소멸
 * - 플라워(육각형) 패턴 + 호박색 그라디언트 배경
 * - 라인형 체크 아이콘 + "저장되었습니다" 텍스트
 */
export default function SavedPopup({ show, onClose }: SavedPopupProps) {
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(onClose, 2500);
    return () => clearTimeout(timer);
    // onClose 참조 변경에 의한 중복 타이머 방지를 위해 show만 감지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!show) return null;

  return (
    <>
      <style>{`
        @keyframes honey-popup-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-12px) scale(0.94); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0)      scale(1);    }
        }
        @keyframes honey-popup-out {
          from { opacity: 1; }
          to   { opacity: 0; transform: translateX(-50%) translateY(-6px) scale(0.97); }
        }
      `}</style>

      <div
        role="status"
        aria-live="polite"
        className="fixed top-5 left-1/2 z-[9999] pointer-events-none"
        style={{
          transform: "translateX(-50%)",
          animation: "honey-popup-in 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards",
        }}
      >
        <div
          className="pointer-events-auto relative overflow-hidden rounded-2xl shadow-xl border border-amber-300/70"
          style={{
            background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 45%, #fde68a 100%)",
            minWidth: 220,
          }}
        >
          {/* 플라워(육각형) 패턴 오버레이 */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='25'%3E%3Cpolygon points='11,1.5 20.5,6.5 20.5,17.5 11,22.5 1.5,17.5 1.5,6.5' fill='none' stroke='%23b45309' stroke-width='0.9'/%3E%3C/svg%3E")`,
              backgroundSize: "22px 25px",
              opacity: 0.07,
            }}
          />

          {/* 상단 꿀 강조선 */}
          <div
            aria-hidden="true"
            className="absolute top-0 left-0 right-0 h-0.5"
            style={{ background: "linear-gradient(90deg, transparent, #f59e0b 30%, #fbbf24 70%, transparent)" }}
          />

          {/* 콘텐츠 */}
          <div className="relative flex items-center gap-2.5 px-4 py-3">
            {/* 바닐라 플라워 이미지 */}
            <img
              src="/favicon.svg"
              alt=""
              aria-hidden="true"
              width={30}
              height={30}
              className="flex-shrink-0 select-none"
              style={{ mixBlendMode: "multiply" }}
            />

            {/* 라인형 체크 아이콘 */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#92400e"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="flex-shrink-0"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="8,12 11,15 16,9" />
            </svg>

            {/* 텍스트 */}
            <span className="text-sm font-semibold text-amber-900 whitespace-nowrap">
              저장되었습니다
            </span>

            {/* 닫기 버튼 */}
            <button
              type="button"
              onClick={onClose}
              className="ml-2 flex-shrink-0 text-amber-500 hover:text-amber-800 transition-colors"
              aria-label="닫기"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
