import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/site-config?key=xxx  또는  GET /api/admin/site-config (전체)
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");

  if (key) {
    const row = await prisma.setting.findUnique({ where: { key } });
    return NextResponse.json({ value: row?.value ?? null });
  }

  // 전체 정책 키 목록
  const keys = ["refundPolicy", "shippingPolicy", "usagePolicy"];
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const result: Record<string, string> = {};
  for (const r of rows) result[r.key] = r.value;
  return NextResponse.json(result);
}

// PUT /api/admin/site-config  { key, value }
export async function PUT(req: NextRequest) {
  const session = await auth();
  if ((session?.user as any)?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  const { key, value } = await req.json();
  if (!key || typeof value !== "string") {
    return NextResponse.json({ error: "key, value 필수" }, { status: 400 });
  }

  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });

  return NextResponse.json({ ok: true });
}
