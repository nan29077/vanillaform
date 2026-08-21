import { redirect } from "next/navigation";

// 브랜드 계정의 공동구매 기능은 제거되었습니다. 상품 관리로 이동합니다.
export default function BrandCampaignsRemoved() {
  redirect("/brand/products");
}
