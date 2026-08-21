import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getCooconConfig,
  ensureCooconConfigured,
  requestDepositTransfer,
  genTrscSeqNo,
  todayYYYYMMDD,
  isUnknownResult,
  CooconTimeoutError,
} from "@/lib/cooconpg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TRANSFER_AMOUNT = 100_000_000; // 1회 1억원 상한 (오입력 방지)

// POST: 입금이체 실행 (6120) — 최고관리자 전용
// 거래 로그(DepositTransfer)를 먼저 생성한 뒤 API를 호출하고 결과를 기록한다.
// 타임아웃/001/9980 응답은 처리결과 미확정(UNKNOWN)으로 남기고 결과조회(6170)를 유도한다.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const rcvBnkCd = String(body.rcvBnkCd ?? "").trim();
  const rcvAcctNo = String(body.rcvAcctNo ?? "").replace(/[^0-9]/g, "");
  const amount = Math.floor(Number(body.amount));
  const wdrwAcctNm = typeof body.wdrwAcctNm === "string" ? body.wdrwAcctNm.trim().slice(0, 20) : "";
  const rcvAcctNm = typeof body.rcvAcctNm === "string" ? body.rcvAcctNm.trim().slice(0, 20) : "";
  const memo = typeof body.memo === "string" ? body.memo.trim() : "";

  if (!/^\d{3}$/.test(rcvBnkCd) || !rcvAcctNo) {
    return NextResponse.json({ error: "은행코드와 계좌번호를 확인해 주세요." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount < 1 || amount > MAX_TRANSFER_AMOUNT) {
    return NextResponse.json(
      { error: `이체 금액은 1원 이상 ${MAX_TRANSFER_AMOUNT.toLocaleString()}원 이하여야 합니다.` },
      { status: 400 },
    );
  }

  let cfg;
  try {
    cfg = await getCooconConfig();
    ensureCooconConfigured(cfg);
    if (!cfg.wdrwAcctNo) throw new Error("출금계좌번호가 설정되지 않았습니다.");
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "설정 오류" }, { status: 400 });
  }

  const reqDate = todayYYYYMMDD();
  const trscSeqNo = genTrscSeqNo();

  // 1) 거래 로그 선기록 (호출 중 서버가 죽어도 추적 가능)
  const log = await prisma.depositTransfer.create({
    data: {
      trscSeqNo,
      reqDate,
      rcvBnkCd,
      rcvAcctNo,
      rcvAcctNm: rcvAcctNm || null,
      amount,
      wdrwAcctNm: wdrwAcctNm || null,
      memo: memo || null,
      createdById: session.user.id ?? null,
      status: "REQUESTED",
    },
  });

  // 2) 이체 요청
  try {
    const res = await requestDepositTransfer(cfg, {
      trscSeqNo,
      rcvBnkCd,
      rcvAcctNo,
      amount,
      wdrwAcctNm: wdrwAcctNm || undefined,
    });

    const success = res.RESP_CD === "0000";
    const unknown = !success && isUnknownResult(res.RESP_CD);
    const updated = await prisma.depositTransfer.update({
      where: { id: log.id },
      data: {
        status: success ? "SUCCESS" : unknown ? "UNKNOWN" : "FAILED",
        respCd: res.RESP_CD ?? null,
        respMsg: res.RESP_MSG ?? null,
        balAmt: res.BAL_AMT ?? null,
        rcvAcctNm: res.RCV_ACCT_NM || rcvAcctNm || null,
      },
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      respCd: updated.respCd,
      respMsg: updated.respMsg,
      balAmt: updated.balAmt,
      rcvAcctNm: updated.rcvAcctNm,
      needsResultCheck: updated.status === "UNKNOWN",
    });
  } catch (e: any) {
    // 타임아웃/네트워크 오류: 이체가 실행됐을 수 있으므로 UNKNOWN으로 기록
    const isTimeout = e instanceof CooconTimeoutError;
    const updated = await prisma.depositTransfer.update({
      where: { id: log.id },
      data: {
        status: "UNKNOWN",
        respMsg: isTimeout ? "응답 시간 초과" : e?.message || "통신 오류",
      },
    });
    return NextResponse.json(
      {
        id: updated.id,
        status: updated.status,
        needsResultCheck: true,
        error:
          "이체 요청의 처리결과를 확인하지 못했습니다. 중복 이체 방지를 위해 재시도하지 말고 반드시 [결과조회]로 확인해 주세요.",
      },
      { status: 502 },
    );
  }
}
