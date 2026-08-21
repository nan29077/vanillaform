import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readGameSettings, writeGameSettings, type GameSettings } from "@/lib/gameSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session || (session.user as any).role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }
    const settings = await readGameSettings();
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({ error: "설정을 불러올 수 없습니다" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user as any).role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }
    const body = (await req.json()) as GameSettings;
    await writeGameSettings(body);
    const saved = await readGameSettings();
    return NextResponse.json({ success: true, settings: saved });
  } catch {
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
