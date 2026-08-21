import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: 셀러 설정 통합 조회 (브랜드 설정 구조와 동일한 형태로 반환)
export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    if (session.user.role !== "SELLER") {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
      select: {
        shopName: true,
        shopLogo: true,
        shopBanner: true,
        shopDescription: true,
        businessType: true,
        representativeName: true,
        businessRegistrationNo: true,
        telecomSalesLicenseNo: true,
        businessAddress: true,
        businessCategory: true,
        instagramUrl: true,
        youtubeUrl: true,
        tiktokUrl: true,
        facebookUrl: true,
        twitterUrl: true,
        isApproved: true,
        user: {
          select: {
            name: true,
            email: true,
            avatar: true,
            phone: true,
            bankName: true,
            bankAccount: true,
            bankHolder: true,
          },
        },
      },
    });
    if (!seller) return NextResponse.json({ error: "셀러 프로필이 없습니다" }, { status: 404 });

    return NextResponse.json({ seller });
  } catch (error) {
    console.error("Seller settings GET error:", error);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

// PUT: 셀러 설정 통합 수정
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    if (session.user.role !== "SELLER") {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!seller) return NextResponse.json({ error: "셀러 프로필이 없습니다" }, { status: 404 });

    const body = await req.json();
    const {
      shopName, shopDescription, shopLogo, shopBanner,
      businessRegistrationNo, representativeName, businessAddress,
      businessType, businessCategory, telecomSalesLicenseNo,
      instagramUrl, youtubeUrl, tiktokUrl, facebookUrl, twitterUrl,
      userName, userPhone, bankName, bankAccount, bankHolder,
    } = body;
    const normalizedBusinessType = businessType || "non_business";

    if (!shopName) {
      return NextResponse.json({ error: "셀러명은 필수입니다" }, { status: 400 });
    }

    await prisma.sellerProfile.update({
      where: { id: seller.id },
      data: {
        shopName,
        shopDescription: shopDescription || null,
        shopLogo: shopLogo || null,
        shopBanner: shopBanner || null,
        ...(businessRegistrationNo !== undefined && { businessRegistrationNo: businessRegistrationNo || null }),
        ...(representativeName !== undefined && { representativeName: representativeName || null }),
        ...(businessAddress !== undefined && { businessAddress: businessAddress || null }),
        ...(businessType !== undefined && {
          businessType: normalizedBusinessType,
          isBusinessOperator: normalizedBusinessType === "business",
        }),
        ...(businessCategory !== undefined && { businessCategory: businessCategory || null }),
        ...(telecomSalesLicenseNo !== undefined && { telecomSalesLicenseNo: telecomSalesLicenseNo || null }),
        ...(instagramUrl !== undefined && { instagramUrl: instagramUrl || null }),
        ...(youtubeUrl !== undefined && { youtubeUrl: youtubeUrl || null }),
        ...(tiktokUrl !== undefined && { tiktokUrl: tiktokUrl || null }),
        ...(facebookUrl !== undefined && { facebookUrl: facebookUrl || null }),
        ...(twitterUrl !== undefined && { twitterUrl: twitterUrl || null }),
      },
    });

    // 계정 정보(이름/전화/정산계좌)는 User 모델에 저장
    await prisma.user.update({
      where: { id: session.user!.id },
      data: {
        ...(userName !== undefined && userName && { name: userName }),
        ...(userPhone !== undefined && { phone: userPhone || null }),
        ...(bankName !== undefined && { bankName: bankName || null }),
        ...(bankAccount !== undefined && { bankAccount: bankAccount || null }),
        ...(bankHolder !== undefined && { bankHolder: bankHolder || null }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Seller settings PUT error:", e);
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}
