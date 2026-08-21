import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCooconConfig, ensureCooconConfigured, inquireTransferResult } from "@/lib/cooconpg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST: 입금이체 처리결과 조회 (6170) — 최고관리자 전용
// STS: 1 정상 / 3 오류 / 6 처리중
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "거래 ID가 없습니다." }, { status: 400 });

  const log = await prisma.depositTransfer.findUnique({ where: { id } });
  if (!log) return NextResponse.json({ error: "거래 내역을 찾을 수 없습니다." }, { status: 404 });

  try {
    const cfg = await getCooconConfig();
    ensureCooconConfigured(cfg);
    const res = await inquireTransferResult(cfg, {
      rqreTmsgNo: log.trscSeqNo,
      reqTrscDt: log.reqDate,
    });

    if (res.RESP_CD !== "0000") {
      return NextResponse.json(
        { error: `[${res.RESP_CD}] ${res.RESP_MSG || "결과조회에 실패했습니다."}` },
        { status: 502 },
      );
    }

    const status = res.STS === "1" ? "SUCCESS" : res.STS === "3" ? "FAILED" : "PROCESSING";
    const updated = await prisma.depositTransfer.update({
      where: { id },
      data: {
        status,
        respCd: res.RESP_CD,
        respMsg: res.RESP_MSG || (status === "PROCESSING" ? "은행 처리중" : null),
        rcvAcctNm: res.RCV_ACCT_NM || log.rcvAcctNm,
      },
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      sts: res.STS,
      rcvAcctNm: updated.rcvAcctNm,
      rcvTrscDt: res.RCV_TRSC_DT,
      rcvTrscTm: res.RCV_TRSC_TM,
      trscAmt: res.TRSC_AMT,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "결과조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
