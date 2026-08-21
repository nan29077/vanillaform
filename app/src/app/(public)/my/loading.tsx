// /my/* 진입 시 서버에서 역할 판별(리다이렉트)이 끝나기 전까지 보여줄 중립 로딩 화면.
// 구매자 마이페이지 콘텐츠가 잠깐이라도 플래시되지 않도록 로더만 노출한다.
import VanillaLoader from "@/components/shared/VanillaLoader";

export default function MyLoading() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <VanillaLoader size={72} />
    </div>
  );
}
