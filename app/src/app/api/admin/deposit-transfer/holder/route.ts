import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCooconConfig, ensureCooconConfigured, inquireAccountHolder } from "@/lib/cooconpg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST: 예금주명 조회 (6110) — 최고관리자 전용
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const rcvBnkCd = String(body.rcvBnkCd ?? "").trim();
  const rcvAcctNo = String(body.rcvAcctNo ?? "").replace(/[^0-9]/g, "");
  // 6110은 입금금액 1원 이상 필수 — 이체 예정 금액이 있으면 그 값으로 조회
  const amount = Number(body.amount) > 0 ? Math.floor(Number(body.amount)) : 1000;

  if (!/^\d{3}$/.test(rcvBnkCd) || !rcvAcctNo) {
    return NextResponse.json({ error: "은행코드와 계좌번호를 확인해 주세요." }, { status: 400 });
  }

  try {
    const cfg = await getCooconConfig();
    ensureCooconConfigured(cfg);
    const res = await inquireAccountHolder(cfg, { rcvBnkCd, rcvAcctNo, amount });
    if (res.RESP_CD !== "0000") {
      return NextResponse.json(
        { error: `[${res.RESP_CD}] ${res.RESP_MSG || "예금주 조회에 실패했습니다."}` },
        { status: 502 },
      );
    }
    return NextResponse.json({ holderName: res.RCV_ACCT_NM ?? "" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "예금주 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
