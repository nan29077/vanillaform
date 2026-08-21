import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Fetch brand settings
export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    if (session.user.role !== "BRAND_ADMIN") {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const brand = await prisma.brandProfile.findUnique({
      where: { userId: session.user!.id },
      include: { user: { select: { name: true, email: true, avatar: true } } },
    });
    if (!brand) return NextResponse.json({ error: "브랜드 프로필이 없습니다" }, { status: 404 });

    return NextResponse.json({ brand });
  } catch (error) {
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

// PUT: Update brand settings
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    if (session.user.role !== "BRAND_ADMIN") {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const brand = await prisma.brandProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!brand) return NextResponse.json({ error: "브랜드 프로필이 없습니다" }, { status: 404 });

    const body = await req.json();
    const {
      brandName, description,
      businessRegistrationNo, representativeName, businessAddress,
      businessType, businessCategory, contactPhone, contactEmail,
      userName, bankName, accountNumber, accountHolder,
    } = body;

    if (!brandName) {
      return NextResponse.json({ error: "브랜드명은 필수입니다" }, { status: 400 });
    }

    // Update brand profile
    const updated = await prisma.brandProfile.update({
      where: { id: brand.id },
      data: {
        brandName,
        description: description || null,
        businessRegistrationNo: businessRegistrationNo || null,
        representativeName: representativeName || null,
        businessAddress: businessAddress || null,
        businessType: businessType || null,
        businessCategory: businessCategory || null,
        contactPhone: contactPhone || null,
        contactEmail: contactEmail || null,
        ...(bankName !== undefined && { bankName: bankName || null }),
        ...(accountNumber !== undefined && { accountNumber: accountNumber || null }),
        ...(accountHolder !== undefined && { accountHolder: accountHolder || null }),
      } as any,
    });

    // Update user name if provided
    if (userName) {
      await prisma.user.update({
        where: { id: session.user!.id },
        data: { name: userName },
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}
