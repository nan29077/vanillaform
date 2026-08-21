import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, readFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SETTINGS_PATH = join(process.cwd(), "data", "contact-settings.json");

interface ContactSettings {
  phone: string;
  email: string;
  operatingHours: string;
  lunchBreak: string;
  offHoursNotice: string;
  chatTerminationNotice: string;
  faqs: { id: string; question: string; answer: string; isActive: boolean; sortOrder: number }[];
  updatedAt: string;
}

const DEFAULT_SETTINGS: ContactSettings = {
  phone: "02-1234-5678",
  email: "support@vanillaform.local",
  operatingHours: "평일 09:00 ~ 18:00",
  lunchBreak: "점심시간 12:00 ~ 13:00",
  offHoursNotice: "현재 상담 가능 시간이 아닙니다. 영업시간에 다시 문의해 주세요.",
  chatTerminationNotice: "상담이 종료되었습니다. 추가 문의사항이 있으시면 다시 문의해 주세요.",
  faqs: [
    { id: "f1", question: "배송은 얼마나 걸리나요?", answer: "일반 배송은 결제 완료 후 2~5일 이내, 공동구매 상품은 캠페인 종료 후 7~14일 내에 배송됩니다.", isActive: true, sortOrder: 1 },
    { id: "f2", question: "교환/반품은 어떻게 하나요?", answer: "상품 수령 후 7일 이내 마이페이지 > 주문내역에서 교환/반품 신청이 가능합니다. 단순 변심의 경우 반품 배송비가 발생합니다.", isActive: true, sortOrder: 2 },
    { id: "f3", question: "라이브 셀러가 되려면 어떻게 하나요?", answer: "회원가입 후 라이브 셀러 신청 페이지에서 사업자 정보를 입력하시면 관리자 승인 후 라이브 셀러 활동이 가능합니다.", isActive: true, sortOrder: 3 },
    { id: "f4", question: "결제 수단은 무엇이 있나요?", answer: "신용카드, 체크카드, 네이버페이, 카카오페이, 토스페이, 무통장 입금 등 다양한 결제 수단을 지원합니다.", isActive: true, sortOrder: 4 },
    { id: "f5", question: "공동구매는 무엇인가요?", answer: "라이브 셀러가 진행하는 그룹 구매로, 목표 수량 달성 시 더 저렴한 가격에 상품을 구매할 수 있습니다.", isActive: true, sortOrder: 5 },
    { id: "f6", question: "할인 코드는 어떻게 사용하나요?", answer: "결제 시 할인 코드 입력란에 코드를 입력하면 자동으로 할인이 적용됩니다.", isActive: true, sortOrder: 6 },
  ],
  updatedAt: new Date().toISOString(),
};

async function getSettings(): Promise<ContactSettings> {
  try {
    if (existsSync(SETTINGS_PATH)) {
      const data = await readFile(SETTINGS_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

async function saveSettings(settings: ContactSettings): Promise<void> {
  const dir = join(process.cwd(), "data");
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

// GET: Fetch settings (public for main page sync)
export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json({ error: "설정을 불러올 수 없습니다" }, { status: 500 });
  }
}

// PUT: Update settings (admin only)
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }
    const body = await req.json();
    const current = await getSettings();
    const updated: ContactSettings = {
      phone: body.phone ?? current.phone,
      email: body.email ?? current.email,
      operatingHours: body.operatingHours ?? current.operatingHours,
      lunchBreak: body.lunchBreak ?? current.lunchBreak,
      offHoursNotice: body.offHoursNotice ?? current.offHoursNotice,
      chatTerminationNotice: body.chatTerminationNotice ?? current.chatTerminationNotice,
      faqs: body.faqs ?? current.faqs,
      updatedAt: new Date().toISOString(),
    };
    await saveSettings(updated);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: "설정 저장 실패" }, { status: 500 });
  }
}
