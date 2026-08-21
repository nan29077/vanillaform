export default function VanillaLoader({ size = 96 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="animate-pulse" style={{ width: size, height: size }}>
        <img
          src="/favicon.svg"
          alt="로딩 중"
          width={size}
          height={size}
          style={{ width: size, height: size, objectFit: "contain" }}
        />
      </div>
      <p className="text-xs text-gray-400">잠시만 기다려주세요</p>
    </div>
  );
}
