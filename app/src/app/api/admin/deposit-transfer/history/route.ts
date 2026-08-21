import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

// GET: 입금이체 거래내역 목록 — 최고관리자 전용
export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
  const [rows, total] = await Promise.all([
    prisma.depositTransfer.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.depositTransfer.count(),
  ]);

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      trscSeqNo: r.trscSeqNo,
      reqDate: r.reqDate,
      rcvBnkCd: r.rcvBnkCd,
      rcvAcctNo: r.rcvAcctNo,
      rcvAcctNm: r.rcvAcctNm,
      amount: Number(r.amount),
      wdrwAcctNm: r.wdrwAcctNm,
      status: r.status,
      respCd: r.respCd,
      respMsg: r.respMsg,
      balAmt: r.balAmt,
      memo: r.memo,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
  });
}
