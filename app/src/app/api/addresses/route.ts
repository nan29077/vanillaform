import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: 저장된 배송지 목록
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ addresses: [] });

  const addresses = await prisma.address.findMany({
    where: { userId: session.user!.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ addresses });
}

// POST: 배송지 저장
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const { name, phone, zipCode, address1, address2, isDefault } = await req.json();
  if (!name || !phone || !address1) {
    return NextResponse.json({ error: "필수 정보 누락" }, { status: 400 });
  }

  // 기본 배송지로 설정 시 기존 기본 배송지 해제
  if (isDefault) {
    await prisma.address.updateMany({
      where: { userId: session.user!.id, isDefault: true },
      data: { isDefault: false },
    });
  }

  // 동일 주소가 이미 있는지 확인
  const existing = await prisma.address.findFirst({
    where: { userId: session.user!.id, address1, name, phone },
  });
  if (existing) {
    return NextResponse.json({ address: existing });
  }

  const address = await prisma.address.create({
    data: {
      userId: session.user!.id,
      name,
      phone,
      zipCode: zipCode || null,
      address1,
      address2: address2 || null,
      isDefault: isDefault ?? false,
    },
  });

  return NextResponse.json({ address });
}

// PUT: 배송지 수정 (본인 소유만)
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const { id, name, phone, zipCode, address1, address2, isDefault } = await req.json();
  if (!id || !name || !phone || !address1) {
    return NextResponse.json({ error: "필수 정보 누락" }, { status: 400 });
  }

  // 기본 배송지로 설정 시 기존 기본 배송지 해제
  if (isDefault) {
    await prisma.address.updateMany({
      where: { userId: session.user!.id, isDefault: true },
      data: { isDefault: false },
    });
  }

  // 본인 소유 배송지만 수정 (IDOR 방지)
  const res = await prisma.address.updateMany({
    where: { id, userId: session.user!.id },
    data: {
      name,
      phone,
      zipCode: zipCode || null,
      address1,
      address2: address2 || null,
      ...(typeof isDefault === "boolean" ? { isDefault } : {}),
    },
  });
  if (res.count === 0) return NextResponse.json({ error: "배송지를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ success: true });
}

// PATCH: 기본 배송지 설정 (본인 소유만)
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID 필요" }, { status: 400 });

  await prisma.address.updateMany({
    where: { userId: session.user!.id, isDefault: true },
    data: { isDefault: false },
  });

  // 본인 소유 배송지만 기본 설정 (IDOR 방지)
  const res = await prisma.address.updateMany({
    where: { id, userId: session.user!.id },
    data: { isDefault: true },
  });
  if (res.count === 0) return NextResponse.json({ error: "배송지를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ success: true });
}

// DELETE: 배송지 삭제 (본인 소유만)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID 필요" }, { status: 400 });

  // 본인 소유 배송지만 삭제 (IDOR 방지)
  await prisma.address.deleteMany({ where: { id, userId: session.user!.id } });
  return NextResponse.json({ success: true });
}
