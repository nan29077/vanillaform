import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { creditCharge, rejectCharge, walletErrorResponse } from "@/lib/wallet";

export const dynamic = "force-dynamic";

// POST /api/admin/wallet-charges/[id] — 충전 요청 처리 (최고관리자)
// body: { action: "approve" | "reject", amount?: number (보유 상품권 승인 시 필수), memo?: string }
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: { action?: unknown; amount?: unknown; memo?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const memo = typeof body?.memo === "string" ? body.memo.trim() : null;

  try {
    if (body?.action === "approve") {
      const result = await creditCharge(params.id, session.user.id, { amount: body.amount, memo });
      return NextResponse.json({ ok: true, ...result });
    }
    if (body?.action === "reject") {
      await rejectCharge(params.id, session.user.id, memo);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "처리 방식(action)이 올바르지 않습니다." }, { status: 400 });
  } catch (e) {
    return walletErrorResponse(e);
  }
}
