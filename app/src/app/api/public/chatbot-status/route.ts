import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHATBOT_ENABLED_KEY = "chatbot.enabled";
const DEFAULT_ENABLED = true;

// GET: 구매자 페이지에서 챗봇 표시 여부 확인 (인증 불필요)
export async function GET() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: CHATBOT_ENABLED_KEY } });
    const enabled = row ? row.value === "true" : DEFAULT_ENABLED;
    return NextResponse.json({ enabled });
  } catch {
    // DB 오류 시 기본값(활성화)으로 폴백 — 문의 기능이 갑자기 사라지지 않도록
    return NextResponse.json({ enabled: DEFAULT_ENABLED });
  }
}
