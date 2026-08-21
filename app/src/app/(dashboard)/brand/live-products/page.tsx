import { redirect } from "next/navigation";

// 브랜드 계정의 "라이브 상품관리" 메뉴는 제거되었습니다. 상품 관리로 이동합니다.
export default function BrandLiveProductsRemoved() {
  redirect("/brand/products");
}
