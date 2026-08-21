import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: 셀러 사업자 정보 조회
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      businessType: true,
      representativeName: true,
      businessRegistrationNo: true,
      telecomSalesLicenseNo: true,
      businessAddress: true,
      businessCategory: true,
    },
  });

  return NextResponse.json({ seller });
}

// PUT: 셀러 사업자 정보 수정
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      businessType,
      representativeName,
      businessRegistrationNo,
      telecomSalesLicenseNo,
      businessAddress,
      businessCategory,
    } = body;

    const seller = await prisma.sellerProfile.update({
      where: { userId: session.user.id },
      data: {
        businessType: businessType || "non_business",
        isBusinessOperator: businessType === "business",
        representativeName: representativeName || null,
        businessRegistrationNo: businessRegistrationNo || null,
        telecomSalesLicenseNo: telecomSalesLicenseNo || null,
        businessAddress: businessAddress || null,
        businessCategory: businessCategory || null,
      },
    });

    return NextResponse.json({ success: true, seller });
  } catch (error) {
    console.error("Business info update error:", error);
    return NextResponse.json(
      { error: "사업자 정보 수정에 실패했습니다." },
      { status: 500 }
    );
  }
}
