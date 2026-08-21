import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCooconConfig, ensureCooconConfigured, inquireBalance } from "@/lib/cooconpg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST: 출금계좌 잔액조회 (6140) — 최고관리자 전용
export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  try {
    const cfg = await getCooconConfig();
    ensureCooconConfigured(cfg);
    const res = await inquireBalance(cfg);
    if (res.RESP_CD !== "0000") {
      return NextResponse.json(
        { error: `[${res.RESP_CD}] ${res.RESP_MSG || "잔액조회에 실패했습니다."}` },
        { status: 502 },
      );
    }
    return NextResponse.json({
      balAmt: res.BAL_AMT ?? "0",
      wdrwCanAmt: res.WDRW_CAN_AMT ?? "0",
      wdrwCannotAmt: res.WDRW_CANNOT_AMT ?? "0",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "잔액조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
