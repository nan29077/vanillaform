// 라이브 상태 표시 공통 컴포넌트 — 셀러샵/단골픽/내픽/라이브검색에서 동일하게 재사용.
// - LIVE_RING_CLASS: 프로필 사진(아바타) 링에 적용하는 "두근두근" 펄스 (globals.css 의 animate-heartbeat).
// - <LiveBadge />: 빨간 펄스 점 + LIVE 텍스트 배지. className 으로 위치/크기 조정.

export const LIVE_RING_CLASS = "ring-2 ring-red-400 animate-heartbeat";

// 프로필(이름) 옆에 붙는 라이브 배지 — 헥사곤 "ON AIR" 이미지.
// ※ 아바타 하단에 붙는 <LiveBadge/> (LIVE 텍스트) 와는 별개로, 이름 옆 배지에만 사용.
export function OnAirBadge({ className = "w-8 h-8" }: { className?: string }) {
  return <img src="/onair-badge.png" alt="ON AIR" className={`object-contain shrink-0 ${className}`} />;
}

export default function LiveBadge({
  className = "",
  size = "xs",
}: {
  className?: string;
  size?: "xs" | "sm";
}) {
  const sized =
    size === "sm"
      ? "text-[9px] px-2 py-0.5 gap-1"
      : "text-[7px] px-1 py-px gap-0.5";
  const dot = size === "sm" ? "w-1.5 h-1.5" : "w-1 h-1";
  return (
    <span className={`inline-flex items-center ${sized} bg-red-500 text-white font-bold rounded-full shadow-sm ${className}`}>
      <span className={`${dot} bg-white rounded-full animate-pulse`} />
      LIVE
    </span>
  );
}
