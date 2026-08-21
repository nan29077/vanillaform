import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSettingsMap, setSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 챗봇 활성화 여부 저장 키 (Setting 테이블 재사용)
const CHATBOT_ENABLED_KEY = "chatbot.enabled";
const DEFAULT_ENABLED = true;

// GET: 현재 챗봇 활성화 여부 (관리자)
export async function GET() {
  try {
    const session = await auth();
    if (!session || (session.user as any).role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }
    const map = await getSettingsMap();
    const raw = map[CHATBOT_ENABLED_KEY];
    const enabled = raw === undefined ? DEFAULT_ENABLED : raw === "true";
    return NextResponse.json({ enabled });
  } catch {
    return NextResponse.json({ error: "설정을 불러올 수 없습니다" }, { status: 500 });
  }
}

// PUT: 챗봇 ON/OFF 업데이트 (관리자)
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user as any).role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }
    const body = await req.json();
    const enabled = Boolean(body.enabled);
    await setSettings({ [CHATBOT_ENABLED_KEY]: enabled ? "true" : "false" });
    return NextResponse.json({ enabled });
  } catch {
    return NextResponse.json({ error: "설정 저장 실패" }, { status: 500 });
  }
}
