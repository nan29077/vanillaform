import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// SUPER_ADMIN 가드 헬퍼
async function guard() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  return null;
}

// GET: 중간관리자 목록 조회
export async function GET() {
  const denied = await guard();
  if (denied) return denied;

  const middleAdmins = await prisma.middleAdminProfile.findMany({
    include: {
      user: { select: { name: true, email: true, isActive: true, createdAt: true } },
      _count: { select: { brands: true, sellers: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ middleAdmins });
}

// POST: 중간관리자 등록 (계정 + 프로필 동시 생성)
export async function POST(request: Request) {
  const denied = await guard();
  if (denied) return denied;

  try {
    const body = await request.json();
    const { name, email, password, contactPhone } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "이름, 이메일, 비밀번호는 필수입니다." },
        { status: 400 }
      );
    }

    // 이메일 중복 확인
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "이미 사용 중인 이메일입니다." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "MIDDLE_ADMIN",
        isActive: true,
        middleAdminProfile: {
          create: {
            name,
            contactPhone: contactPhone || null,
          },
        },
      },
      include: { middleAdminProfile: true },
    });

    return NextResponse.json({
      success: true,
      user,
      middleAdmin: user.middleAdminProfile,
    });
  } catch (error) {
    console.error("Middle admin registration error:", error);
    return NextResponse.json(
      { error: "중간관리자 등록에 실패했습니다." },
      { status: 500 }
    );
  }
}

// PUT: 중간관리자 정보 수정 (이름/연락처/활성여부)
export async function PUT(request: Request) {
  const denied = await guard();
  if (denied) return denied;

  try {
    const body = await request.json();
    const { middleAdminId, name, contactPhone, isActive, isApproved, commissionRate } = body;

    if (!middleAdminId) {
      return NextResponse.json(
        { error: "중간관리자 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const profileData: Record<string, unknown> = {};
    if (name !== undefined) profileData.name = name;
    if (contactPhone !== undefined) profileData.contactPhone = contactPhone || null;
    if (isActive !== undefined) profileData.isActive = isActive;
    if (isApproved !== undefined) profileData.isApproved = isApproved;
    if (commissionRate !== undefined) {
      const c = Number(commissionRate);
      profileData.commissionRate = Number.isFinite(c) && c >= 0 && c <= 100 ? c : 0;
    }

    const middleAdmin = await prisma.middleAdminProfile.update({
      where: { id: middleAdminId },
      data: profileData,
    });

    // 활성여부는 로그인 계정에도 함께 반영
    if (isActive !== undefined) {
      await prisma.user.update({
        where: { id: middleAdmin.userId },
        data: { isActive },
      });
    }

    return NextResponse.json({ success: true, middleAdmin });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}
