"use client";

import { useState } from "react";

interface SafeImageProps {
  src: string | null | undefined;
  alt: string;
  fallbackText?: string;
  // src 가 없을 때 이모지 대신 보여줄 기본 이미지(placeholder). 로드 실패 시 이모지로 폴백.
  placeholder?: string;
  width?: number;
  height?: number;
  className?: string;
}

// Beautiful gradient pairs for fallback backgrounds
const GRADIENTS = [
  "from-rose-200 to-pink-300",
  "from-violet-200 to-purple-300",
  "from-blue-200 to-indigo-300",
  "from-emerald-200 to-teal-300",
  "from-amber-200 to-orange-300",
  "from-cyan-200 to-sky-300",
  "from-fuchsia-200 to-pink-300",
  "from-lime-200 to-green-300",
];

function getGradient(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

// Category-based emoji mapping for prettier fallbacks
const CATEGORY_EMOJIS: Record<string, string> = {
  패션: "👗",
  뷰티: "💄",
  라이프: "🌿",
  "라이프스타일": "🌿",
  악세사리: "💎",
  액세서리: "💎",
  홈리빙: "🏠",
  식품: "🍽️",
  디지털: "💻",
  키즈: "👶",
};

// 상품명에서 카테고리 키워드를 감지하여 이모지 반환
function detectEmoji(text: string): string {
  const keywords: Record<string, string> = {
    블레이저: "🧥", 자켓: "🧥", 코트: "🧥",
    슬랙스: "👖", 데님: "👖", 팬츠: "👖",
    원피스: "👗", 블라우스: "👚", 셔츠: "👔",
    카디건: "🧶", 니트: "🧶",
    토트백: "👜", 가방: "👜",
    이어링: "💍", 목걸이: "💍", 반지: "💍",
    머플러: "🧣", 스카프: "🧣",
    세럼: "🧴", 파운데이션: "💄", 크림: "🧴", 앰플: "🧴",
    립: "💋", 클렌징: "🧼",
    디퓨저: "🕯️", 캔들: "🕯️",
    파자마: "👕", 앞치마: "👕",
    핸드크림: "🧴",
  };
  for (const [key, emoji] of Object.entries(keywords)) {
    if (text.includes(key)) return emoji;
  }
  return "🛍️";
}

export default function SafeImage({
  src,
  alt,
  fallbackText,
  placeholder,
  width = 100,
  height = 100,
  className = "w-full h-full object-cover",
}: SafeImageProps) {
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  // 원본 이미지가 로드 실패하면 placeholder 이미지(NO_IMAGE 등)로 폴백한 뒤, 그것도 실패하면 이모지.
  const [usePlaceholder, setUsePlaceholder] = useState(false);
  const displayText = fallbackText || alt || "?";
  const gradient = getGradient(displayText);
  const emoji = detectEmoji(displayText);

  const trimmedSrc = (src && src.trim()) || "";

  const handleError = () => {
    if (!usePlaceholder && retryCount < 1) {
      // Retry once with a cache-busting parameter
      setRetryCount((prev) => prev + 1);
    } else if (!usePlaceholder && placeholder && placeholder !== trimmedSrc) {
      // 원본 실패 → placeholder 이미지로 폴백
      setUsePlaceholder(true);
      setRetryCount(0);
    } else {
      setError(true);
    }
  };

  const fallbackEl = (
    <div
      className={`flex flex-col items-center justify-center bg-gradient-to-br ${gradient} ${className}`}
      style={{ minWidth: 0, minHeight: 0 }}
      role="img"
      aria-label={alt}
    >
      <span
        className="select-none drop-shadow-sm"
        style={{ fontSize: Math.max(16, Math.min(width, height) * 0.3) }}
      >
        {emoji}
      </span>
      <span
        className="font-medium select-none text-white/70 text-center px-1 leading-tight"
        style={{ fontSize: Math.max(8, Math.min(width, height) * 0.1), maxWidth: "90%" }}
      >
        {displayText.length > 8 ? displayText.substring(0, 8) + "…" : displayText}
      </span>
    </div>
  );

  // src 가 없으면 placeholder(기본 이미지)를 사용. 원본 실패 시에도 placeholder 로 폴백. 둘 다 없으면 이모지.
  const effectiveSrc = usePlaceholder ? (placeholder || "") : (trimmedSrc || placeholder || "");
  if (!effectiveSrc || error) return fallbackEl;

  // Ensure proper URL - fix various URL issues
  let imgSrc = effectiveSrc.trim();
  if (!imgSrc.startsWith('http') && !imgSrc.startsWith('/')) {
    imgSrc = '/' + imgSrc;
  }
  // 재시도 시에만 캐시 무효화 파라미터를 붙인다(handleError 의 1회 재시도용).
  if (retryCount > 0) {
    imgSrc += (imgSrc.includes('?') ? '&' : '?') + `_r=${retryCount}`;
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      // handleError 를 붙여야 재시도 → placeholder → 이모지 순서의 폴백이 실제로 동작한다.
      // (이전에는 setError(true) 를 직접 호출해 placeholder 단계가 통째로 죽어 있었다)
      onError={handleError}
      // 이미지가 깨진 순간 브라우저가 alt 텍스트를 그려서 카드의 상태 배지 위에 겹쳐
      // 보이는 문제가 있었다. 폴백 엘리먼트가 aria-label 로 같은 정보를 제공하므로
      // 이미지 자체에서는 글자를 보이지 않게 한다.
      style={{ minWidth: 0, minHeight: 0, color: "transparent" }}
    />
  );
}
