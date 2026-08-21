import { CSSProperties, ReactNode } from "react";

/**
 * HexNumBadge — 바닐라 플라워/플라워 컨셉 상품 순번 뱃지
 * 육각형(honeycomb) 클리핑 + amber 배경 + 짙은 갈색 텍스트.
 * 서버/클라이언트 컴포넌트 어디서든 사용 가능 (훅 미사용).
 */
const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

interface HexNumBadgeProps {
  children: ReactNode;
  /** 뱃지 한 변 크기(px). 두 자리 이상 숫자는 minWidth 기준으로 가로만 늘어남 */
  size?: number;
  /** 글자 크기(px). 생략 시 size에 비례해 자동 산출 */
  fontSize?: number;
  className?: string;
  style?: CSSProperties;
}

export default function HexNumBadge({ children, size = 20, fontSize, className = "", style }: HexNumBadgeProps) {
  return (
    <span
      className={`inline-flex items-center justify-center font-bold bg-amber-400 text-amber-900 leading-none ${className}`}
      style={{
        minWidth: size,
        height: size,
        clipPath: HEX_CLIP,
        fontSize: fontSize ?? Math.max(8, Math.round(size * 0.45)),
        ...style,
      }}
    >
      {children}
    </span>
  );
}
