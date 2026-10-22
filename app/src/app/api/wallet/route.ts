import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFeatureFlags } from "@/lib/settings";
import { getBranchMerchantName, getWalletSummary, walletErrorResponse } from "@/lib/wallet";

export const dynamic = "force-dynamic";

// GET /api/wallet — 내 잔액 + 충전 내역 (구매자 본인)
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (session.user.role !== "BUYER") {
    return NextResponse.json({ error: "구매자 회원만 이용할 수 있습니다." }, { status: 403 });
  }
  const flags = await getFeatureFlags();
  if (!flags.walletCharge) {
    return NextResponse.json({ error: "충전 결제 기능이 현재 꺼져 있습니다." }, { status: 403 });
  }
  try {
    const [summary, merchantName] = await Promise.all([
      getWalletSummary(session.user.id),
      getBranchMerchantName(),
    ]);
    return NextResponse.json({ ...summary, merchantName });
  } catch (e) {
    return walletErrorResponse(e);
  }
}
