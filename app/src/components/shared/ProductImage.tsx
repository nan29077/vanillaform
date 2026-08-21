"use client";

import { useState } from "react";
import NoImagePlaceholder from "@/components/shared/NoImagePlaceholder";

interface ProductImageProps {
  src?: string | null;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fallbackText?: string;
  iconSize?: number;
}

/**
 * 상품 썸네일 공통 컴포넌트.
 * - src 없음(null/빈 문자열) -> NoImagePlaceholder
 * - src 로드 실패              -> NoImagePlaceholder
 * - src 정상                  -> <img>
 */
export default function ProductImage({
  src,
  alt,
  width = 100,
  height = 100,
  className = "w-full h-full object-cover",
  iconSize = 14,
}: ProductImageProps) {
  const [error, setError] = useState(false);

  const trimmed = (src && src.trim()) || "";

  if (!trimmed || error) {
    return <NoImagePlaceholder className={className} iconSize={iconSize} />;
  }

  let imgSrc = trimmed;
  if (!imgSrc.startsWith("http") && !imgSrc.startsWith("/")) {
    imgSrc = "/" + imgSrc;
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={() => setError(true)}
      style={{ minWidth: 0, minHeight: 0 }}
    />
  );
}
