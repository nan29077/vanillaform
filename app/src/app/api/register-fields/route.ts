import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRegisterFieldSettings, setSettings } from "@/lib/settings";
import {
  REGISTER_FIELDS_SETTING_KEY,
  normalizeRegisterFieldSettings,
} from "@/lib/registerFields";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: 현재 회원가입 항목 권한 설정 (가입 폼에서 사용 — 공개)
export async function GET() {
  try {
    const fields = await getRegisterFieldSettings();
    return NextResponse.json({ fields });
  } catch {
    return NextResponse.json({ error: "설정을 불러올 수 없습니다" }, { status: 500 });
  }
}

// PUT: 회원가입 항목 권한 설정 저장 (최고관리자 전용)
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }
    const body = await req.json();
    // 잠금 항목 강제 + 잘못된 값 정규화 후 JSON 으로 저장
    const fields = normalizeRegisterFieldSettings(body.fields);
    await setSettings({ [REGISTER_FIELDS_SETTING_KEY]: JSON.stringify(fields) });
    return NextResponse.json({ fields });
  } catch {
    return NextResponse.json({ error: "설정 저장 실패" }, { status: 500 });
  }
}
