interface Props {
  className?: string;
  iconSize?: number; // 하위 호환용, 사용 안 함
}

/**
 * 상품 썸네일이 없을 때 표시하는 "노이미지" 플레이스홀더.
 * 바닐라 플라워 캐릭터 브랜드 이미지(/no-image.png) 사용.
 */
export default function NoImagePlaceholder({ className = "w-full h-full" }: Props) {
  return (
    <div
      className={`flex items-center justify-center bg-gray-50 overflow-hidden ${className}`}
      aria-label="이미지 없음"
    >
      <img
        src="/no-image.png"
        alt="이미지 없음"
        className="w-full h-full object-contain"
        draggable={false}
      />
    </div>
  );
}
