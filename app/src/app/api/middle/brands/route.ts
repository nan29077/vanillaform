import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// 중간관리자 권한 + 본인 middleAdminId 확인 헬퍼
async function requireMiddleAdmin() {
  const session = await auth();
  const role = session?.user?.role;
  const middleAdminId = session?.user?.middleAdminId as string | undefined;
  if (role !== "MIDDLE_ADMIN" || !middleAdminId) {
    return { error: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }) };
  }
  return { middleAdminId };
}

// GET: 본인 소속 브랜드 목록 조회
export async function GET() {
  const guard = await requireMiddleAdmin();
  if ("error" in guard) return guard.error;

  const brands = await prisma.brandProfile.findMany({
    where: { middleAdminId: guard.middleAdminId },
    include: {
      user: { select: { name: true, email: true, isActive: true, createdAt: true } },
      _count: { select: { products: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ brands });
}

// POST: 브랜드 등록 (중간관리자가 본인 소속으로 등록)
export async function POST(request: Request) {
  const guard = await requireMiddleAdmin();
  if ("error" in guard) return guard.error;

  try {
    const body = await request.json();
    const {
      brandName,
      email,
      password,
      contactName,
      description,
      businessRegistrationNo,
      representativeName,
      businessAddress,
      businessType,
      businessCategory,
      contactPhone,
      contactEmail,
    } = body;

    if (!brandName || !email || !password) {
      return NextResponse.json(
        { error: "브랜드명, 이메일, 비밀번호는 필수입니다." },
        { status: 400 }
      );
    }

    // 이메일 중복 확인
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // 유저 + 브랜드 프로필 동시 생성 (본인 소속으로 등록, 즉시 승인)
    // 마진 정책 필드(marginMethod/marginBase/marginRate)는 설정하지 않음 → 스키마 기본값 사용 (최고관리자 전용)
    const user = await prisma.user.create({
      data: {
        name: contactName || brandName,
        email,
        password: hashedPassword,
        role: "BRAND_ADMIN",
        isActive: true,
        managedByMiddleAdminId: guard.middleAdminId, // 귀속 중간관리자
        brandProfile: {
          create: {
            brandName,
            description: description || null,
            isApproved: true,
            middleAdminId: guard.middleAdminId, // 본인 소속으로 연결
            businessRegistrationNo: businessRegistrationNo || null,
            representativeName: representativeName || null,
            businessAddress: businessAddress || null,
            businessType: businessType || null,
            businessCategory: businessCategory || null,
            contactPhone: contactPhone || null,
            contactEmail: contactEmail || null,
          },
        },
      },
      include: { brandProfile: true },
    });

    return NextResponse.json({ success: true, user, brand: user.brandProfile });
  } catch (error) {
    console.error("Middle brand registration error:", error);
    return NextResponse.json({ error: "브랜드 등록에 실패했습니다." }, { status: 500 });
  }
}
