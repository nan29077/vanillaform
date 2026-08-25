import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  setSettings,
  getFooterSettings,
  FOOTER_COMPANY_NAME_KEY,
  FOOTER_CEO_NAME_KEY,
  FOOTER_BIZ_NUM_KEY,
  FOOTER_MAIL_ORDER_NUM_KEY,
  FOOTER_PHONE_KEY,
  FOOTER_EMAIL_KEY,
  FOOTER_ADDRESS_KEY,
  FOOTER_COPYRIGHT_KEY,
} from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }
    const settings = await getFooterSettings();
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({ error: "설정을 불러올 수 없습니다" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }
    const body = await req.json();
    await setSettings({
      [FOOTER_COMPANY_NAME_KEY]: String(body.companyName ?? ""),
      [FOOTER_CEO_NAME_KEY]: String(body.ceoName ?? ""),
      [FOOTER_BIZ_NUM_KEY]: String(body.bizNum ?? ""),
      [FOOTER_MAIL_ORDER_NUM_KEY]: String(body.mailOrderNum ?? ""),
      [FOOTER_PHONE_KEY]: String(body.phone ?? ""),
      [FOOTER_EMAIL_KEY]: String(body.email ?? ""),
      [FOOTER_ADDRESS_KEY]: String(body.address ?? ""),
      [FOOTER_COPYRIGHT_KEY]: String(body.copyright ?? ""),
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
