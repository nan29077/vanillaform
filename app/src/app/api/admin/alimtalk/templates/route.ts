import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ALIMTALK_PURPOSES, getAligoTemplates, checkTemplateCompatibility } from "@/lib/alimtalkEngine";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const role = (session.user as any).role;
  if (role !== "SUPER_ADMIN" && role !== "MIDDLE_ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { error: null };
}

// GET: 알리고 템플릿 목록 + 용도별 매핑 현황
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const [templates, settings] = await Promise.all([
    getAligoTemplates(true), // 관리자 화면은 항상 최신 목록 (검수 상태 갱신 확인용)
    prisma.alimtalkTemplateSetting.findMany(),
  ]);
  const settingMap = new Map(settings.map((s) => [s.purpose, s]));

  const purposes = Object.entries(ALIMTALK_PURPOSES).map(([purpose, def]) => {
    const setting = settingMap.get(purpose);
    const tplCode = setting?.tplCode || (purpose === "LIVE_START" ? process.env.ALIGO_LIVE_START_TPL_CODE || null : null);
    const tpl = tplCode ? templates.find((t) => t.templtCode === tplCode) : undefined;
    const compat = tpl ? checkTemplateCompatibility(purpose, tpl) : null;
    return {
      purpose,
      label: def.label,
      description: def.description,
      variables: def.variables,
      tplCode,
      enabled: setting ? setting.enabled : Boolean(tplCode),
      templateFound: Boolean(tpl),
      inspStatus: tpl?.inspStatus ?? null,
      compatible: compat ? compat.ok : null,
      unknownVariables: compat?.unknownVariables ?? [],
    };
  });

  return NextResponse.json({
    purposes,
    templates: templates.map((t) => ({
      code: t.templtCode,
      name: t.templtName,
      type: t.templateType,
      inspStatus: t.inspStatus,
      content: t.templtContent,
      buttons: (t.buttons || []).map((b) => ({ name: b.name, linkType: b.linkType, linkMo: b.linkMo || null })),
      createdAt: t.cdate,
    })),
  });
}

// POST: 용도 → 템플릿 매핑 저장 { purpose, tplCode, enabled }
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { purpose, tplCode, enabled } = body;
  if (!ALIMTALK_PURPOSES[purpose]) {
    return NextResponse.json({ error: "알 수 없는 용도입니다." }, { status: 400 });
  }
  if (typeof tplCode !== "string" || !tplCode.trim()) {
    return NextResponse.json({ error: "템플릿 코드를 선택해주세요." }, { status: 400 });
  }

  // 매핑하려는 템플릿이 실제 존재하는지 + 변수 호환 여부 검증
  const templates = await getAligoTemplates();
  const tpl = templates.find((t) => t.templtCode === tplCode.trim());
  if (!tpl) {
    return NextResponse.json({ error: `알리고에 없는 템플릿입니다 (${tplCode}).` }, { status: 400 });
  }
  const compat = checkTemplateCompatibility(purpose, tpl);
  if (!compat.ok) {
    return NextResponse.json(
      { error: `이 템플릿에는 코드가 공급하지 않는 변수가 있습니다: ${compat.unknownVariables.join(", ")}` },
      { status: 400 },
    );
  }

  const saved = await prisma.alimtalkTemplateSetting.upsert({
    where: { purpose },
    update: { tplCode: tplCode.trim(), enabled: Boolean(enabled) },
    create: { purpose, tplCode: tplCode.trim(), enabled: Boolean(enabled) },
  });

  return NextResponse.json({
    success: true,
    setting: saved,
    warning: tpl.inspStatus !== "APR" ? "이 템플릿은 아직 카카오 승인 전이라 승인될 때까지 발송되지 않습니다." : null,
  });
}
