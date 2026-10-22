import { redirect } from "next/navigation";
import { requireBuyerSession } from "@/lib/buyerGuard";
import { getFeatureFlags } from "@/lib/settings";
import { isMissingDbColumnError } from "@/lib/prismaErrors";
import { getBranchMerchantName, getWalletSummary, isWalletAutoApproveEnabled } from "@/lib/wallet";
import type { WalletSummaryDTO } from "@/lib/walletShared";
import WalletChargeClient from "@/components/shared/WalletChargeClient";

export const dynamic = "force-dynamic";

// 충전 결제 (목업) — 가상계좌 입금 / 상품권 충전
export default async function WalletPage() {
  // 비로그인 → 로그인, 비구매자 → 역할 대시보드
  const session = await requireBuyerSession("/my/wallet");

  const flags = await getFeatureFlags();
  if (!flags.walletCharge) redirect("/my");

  let initial: WalletSummaryDTO = { balance: 0, charges: [] };
  let dbReady = true;
  try {
    initial = await getWalletSummary(session.user.id);
  } catch (e) {
    // 새 테이블이 아직 DB에 반영되지 않은 경우 화면은 열고 안내만 한다
    if (!isMissingDbColumnError(e)) throw e;
    dbReady = false;
  }
  const merchantName = await getBranchMerchantName();

  return (
    <WalletChargeClient
      initial={initial}
      merchantName={merchantName}
      dbReady={dbReady}
      defaultDepositor={session.user.name ?? ""}
      autoApprovePurchase={isWalletAutoApproveEnabled()}
    />
  );
}
