import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: 중간관리자 설정 통합 조회 (브랜드 설정 구조와 동일한 형태로 반환)
export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    if (session.user.role !== "MIDDLE_ADMIN") {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const middleAdminId = session.user.middleAdminId as string | undefined;
    if (!middleAdminId) {
      return NextResponse.json({ error: "프로필을 찾을 수 없습니다" }, { status: 404 });
    }

    const profile = await prisma.middleAdminProfile.findUnique({
      where: { id: middleAdminId },
      select: {
        name: true,
        contactPhone: true,
        bizNumber: true,
        companyName: true,
        bankName: true,
        accountNumber: true,
        accountHolder: true,
        isApproved: true,
        user: { select: { name: true, email: true, avatar: true, phone: true } },
      },
    });
    if (!profile) return NextResponse.json({ error: "프로필을 찾을 수 없습니다" }, { status: 404 });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Middle settings GET error:", error);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

// PUT: 중간관리자 설정 통합 수정
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    if (session.user.role !== "MIDDLE_ADMIN") {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const middleAdminId = session.user.middleAdminId as string | undefined;
    if (!middleAdminId) {
      return NextResponse.json({ error: "프로필을 찾을 수 없습니다" }, { status: 404 });
    }

    const body = await req.json();
    const {
      userName, avatar, userPhone, contactPhone,
      bizNumber, companyName, bankName, accountNumber, accountHolder,
    } = body;

    if (!userName) {
      return NextResponse.json({ error: "관리자명은 필수입니다" }, { status: 400 });
    }

    await (prisma.middleAdminProfile.update as any)({
      where: { id: middleAdminId },
      data: {
        ...(userName !== undefined && userName && { name: userName }),
        ...(contactPhone !== undefined && { contactPhone: contactPhone || null }),
        ...(bizNumber !== undefined && { bizNumber: bizNumber || null }),
        ...(companyName !== undefined && { companyName: companyName || null }),
        ...(bankName !== undefined && { bankName: bankName || null }),
        ...(accountNumber !== undefined && { accountNumber: accountNumber || null }),
        ...(accountHolder !== undefined && { accountHolder: accountHolder || null }),
      },
    });

    await prisma.user.update({
      where: { id: session.user!.id },
      data: {
        ...(userName !== undefined && userName && { name: userName }),
        ...(avatar !== undefined && { avatar: avatar || null }),
        ...(userPhone !== undefined && { phone: userPhone || null }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Middle settings PUT error:", e);
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}
