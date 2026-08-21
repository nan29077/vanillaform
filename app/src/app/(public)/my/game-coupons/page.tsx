import { requireBuyerSession } from "@/lib/buyerGuard";
import GameCouponsClient from "./GameCouponsClient";

export const dynamic = "force-dynamic";

export default async function MyGameCouponsPage() {
  // 비로그인 → 로그인, 비구매자 → 역할 대시보드로 리다이렉트
  await requireBuyerSession();
  return <GameCouponsClient />;
}
