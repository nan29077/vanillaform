import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { setSettings } from "@/lib/settings";
import {
  getCooconConfig,
  COOCON_SECR_KEY,
  COOCON_TRT_INST_CD_KEY,
  COOCON_BANK_CD_KEY,
  COOCON_WDRW_ACCT_NO_KEY,
  COOCON_IS_PRODUCTION_KEY,
} from "@/lib/cooconpg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 4) return "****";
  return key.slice(0, 4) + "*".repeat(key.length - 4);
}

// GET: 입금이체PG 설정 조회 (인증키는 마스킹) — 최고관리자 전용
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const cfg = await getCooconConfig();
  return NextResponse.json({
    secrKeyMasked: maskKey(cfg.secrKey),
    trtInstCd: cfg.trtInstCd,
    bankCd: cfg.bankCd,
    wdrwAcctNo: cfg.wdrwAcctNo,
    isProduction: cfg.isProduction,
    configured: Boolean(cfg.secrKey && cfg.trtInstCd && cfg.bankCd),
  });
}

// PUT: 입금이체PG 설정 저장 — 최고관리자 전용 (인증키는 입력된 경우에만 교체)
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const entries: Record<string, string> = {};

  if (typeof body.secrKey === "string" && body.secrKey.trim()) {
    entries[COOCON_SECR_KEY] = body.secrKey.trim();
  }
  if (typeof body.trtInstCd === "string") entries[COOCON_TRT_INST_CD_KEY] = body.trtInstCd.trim();
  if (typeof body.bankCd === "string") entries[COOCON_BANK_CD_KEY] = body.bankCd.trim();
  if (typeof body.wdrwAcctNo === "string") {
    entries[COOCON_WDRW_ACCT_NO_KEY] = body.wdrwAcctNo.replace(/[^0-9]/g, "");
  }
  if (typeof body.isProduction === "boolean") {
    entries[COOCON_IS_PRODUCTION_KEY] = String(body.isProduction);
  }

  if (Object.keys(entries).length === 0) {
    return NextResponse.json({ error: "저장할 항목이 없습니다." }, { status: 400 });
  }
  await setSettings(entries);
  return NextResponse.json({ success: true });
}
