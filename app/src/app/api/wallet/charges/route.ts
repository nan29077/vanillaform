import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFeatureFlags } from "@/lib/settings";
import { createCharge, walletErrorResponse } from "@/lib/wallet";

export const dynamic = "force-dynamic";

// POST /api/wallet/charges — 충전 요청 (목업)
// body: { method: "VIRTUAL_ACCOUNT" | "VOUCHER_PURCHASE" | "VOUCHER_PIN", amount?, voucherType?, pin?, depositorName? }
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    );
  }
  if (session.user.role !== "BUYER") {
    return NextResponse.json(
      { error: "구매자 회원만 충전할 수 있습니다." },
      { status: 403 },
    );
  }
  const flags = await getFeatureFlags();
  if (!flags.walletCharge) {
    return NextResponse.json(
      { error: "충전 결제 기능이 현재 꺼져 있습니다." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    const result = await createCharge(session.user.id, session.user.name, {
      method: body.method,
      amount: body.amount,
      voucherType: body.voucherType,
      pin: body.pin,
      depositorName: body.depositorName,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return walletErrorResponse(e);
  }
}
