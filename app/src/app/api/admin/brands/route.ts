import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// GET: 모든 브랜드사 목록 조회
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const brands = await prisma.brandProfile.findMany({
    include: {
      user: { select: { name: true, email: true, isActive: true, createdAt: true } },
      _count: { select: { products: true } },
      middleAdmin: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // 마진 정책 필드 직렬화 (Decimal → Number)
  const result = brands.map((b) => ({
    ...b,
    marginMethod: b.marginMethod,
    marginBase: b.marginBase,
    marginRate: Number(b.marginRate),
    middleAdminId: b.middleAdminId,
  }));

  return NextResponse.json({ brands: result });
}

// POST: 브랜드사 등록 (관리자가 직접 등록)
export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

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
      return NextResponse.json(
        { error: "이미 사용 중인 이메일입니다." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // 유저와 브랜드 프로필 동시 생성 (관리자 등록이므로 즉시 승인)
    const user = await prisma.user.create({
      data: {
        name: contactName || brandName,
        email,
        password: hashedPassword,
        role: "BRAND_ADMIN",
        isActive: true,
        brandProfile: {
          create: {
            brandName,
            description: description || null,
            isApproved: true, // 관리자가 직접 등록하므로 자동 승인
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
      include: {
        brandProfile: true,
      },
    });

    return NextResponse.json({ success: true, user, brand: user.brandProfile });
  } catch (error) {
    console.error("Brand registration error:", error);
    return NextResponse.json(
      { error: "브랜드 등록에 실패했습니다." },
      { status: 500 }
    );
  }
}

// PUT: 브랜드사 정보 수정
export async function PUT(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { brandId, ...updateData } = body;

    if (!brandId) {
      return NextResponse.json({ error: "브랜드 ID가 필요합니다." }, { status: 400 });
    }

    // 값이 넘어온 필드만 부분 업데이트
    const data: Record<string, unknown> = {};
    const passThrough = [
      "brandName",
      "description",
      "isApproved",
      "businessRegistrationNo",
      "representativeName",
      "businessAddress",
      "businessType",
      "businessCategory",
      "contactPhone",
      "contactEmail",
    ];
    for (const key of passThrough) {
      if (updateData[key] !== undefined) data[key] = updateData[key];
    }

    // 마진 정책 / 중간관리자 지정
    if (updateData.middleAdminId !== undefined) {
      data.middleAdminId = updateData.middleAdminId || null;
    }
    if (updateData.marginMethod !== undefined) {
      data.marginMethod = updateData.marginMethod;
    }
    if (updateData.marginBase !== undefined) {
      data.marginBase = updateData.marginBase;
    }
    if (updateData.marginRate !== undefined) {
      data.marginRate = Number(updateData.marginRate) || 0;
    }

    const brand = await prisma.brandProfile.update({
      where: { id: brandId },
      data,
    });

    return NextResponse.json({ success: true, brand });
  } catch (error) {
    console.error("Brand update error:", error);
    return NextResponse.json(
      { error: "브랜드 수정에 실패했습니다." },
      { status: 500 }
    );
  }
}

// DELETE: 브랜드사 삭제 (비활성화)
export async function DELETE(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { brandId } = await request.json();
  if (!brandId) return NextResponse.json({ error: "brandId 필요" }, { status: 400 });

  await prisma.brandProfile.update({
    where: { id: brandId },
    data: { isApproved: false },
  });

  return NextResponse.json({ success: true });
}
