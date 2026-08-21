import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: 내 가입정보(닉네임/연락처/기본 주소) 조회 — 배송지 입력 폼 프리필 등에 사용
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, phone: true, zipCode: true, address1: true, address2: true },
  });
  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다" }, { status: 404 });
  }
  return NextResponse.json(user);
}

// PATCH: 내 가입정보(닉네임/연락처) 수정
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const data: { name?: string; phone?: string | null } = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (name.length < 1 || name.length > 20) {
      return NextResponse.json({ error: "닉네임은 1~20자로 입력해 주세요" }, { status: 400 });
    }
    data.name = name;
  }

  if (typeof body.phone === "string") {
    const phone = body.phone.trim();
    data.phone = phone.length === 0 ? null : phone;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "변경할 정보가 없습니다" }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: { id: true, name: true, phone: true },
    });
    return NextResponse.json({ success: true, ...user });
  } catch {
    return NextResponse.json({ error: "업데이트 실패" }, { status: 500 });
  }
}
