import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  cancelChargeByUser,
  getWalletSummary,
  walletErrorResponse,
} from "@/lib/wallet";

export const dynamic = "force-dynamic";

// POST /api/wallet/charges/[id]/cancel — 본인의 대기 중 충전 요청 취소
// (기능 토글이 꺼져 있어도 이미 만든 요청은 취소할 수 있게 둔다)
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  }
  if (session.user.role !== "BUYER") {
    return NextResponse.json(
      { error: "구매자 회원만 이용할 수 있습니다." },
      { status: 403 },
    );
  }
  try {
    await cancelChargeByUser(params.id, session.user.id);
    const summary = await getWalletSummary(session.user.id);
    return NextResponse.json(summary);
  } catch (e) {
    return walletErrorResponse(e);
  }
}
