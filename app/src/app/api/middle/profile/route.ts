import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: 중간관리자 프로필(사업자 정보) 조회
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "MIDDLE_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const middleAdminId = session!.user.middleAdminId as string | undefined;
  if (!middleAdminId) {
    return NextResponse.json({ error: "프로필을 찾을 수 없습니다." }, { status: 404 });
  }

  const profile = await prisma.middleAdminProfile.findUnique({
    where: { id: middleAdminId },
    select: {
      id: true,
      name: true,
      contactPhone: true,
      commissionRate: true,
      bizNumber: true,
      companyName: true,
      bankName: true,
      accountNumber: true,
      accountHolder: true,
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "프로필을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({
    profile: {
      ...profile,
      commissionRate: Number(profile.commissionRate),
    },
  });
}

// PUT: 중간관리자 사업자 정보 수정
export async function PUT(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "MIDDLE_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const middleAdminId = session!.user.middleAdminId as string | undefined;
  if (!middleAdminId) {
    return NextResponse.json({ error: "프로필을 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { bizNumber, companyName, bankName, accountNumber, accountHolder, contactPhone } = body;

    const profile = await (prisma.middleAdminProfile.update as any)({
      where: { id: middleAdminId },
      data: {
        ...(bizNumber !== undefined && { bizNumber }),
        ...(companyName !== undefined && { companyName }),
        ...(bankName !== undefined && { bankName }),
        ...(accountNumber !== undefined && { accountNumber }),
        ...(accountHolder !== undefined && { accountHolder }),
        ...(contactPhone !== undefined && { contactPhone }),
      },
    });

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("Middle admin profile update error:", error);
    return NextResponse.json({ error: "수정에 실패했습니다." }, { status: 500 });
  }
}
