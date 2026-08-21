import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SELLER_REF_COOKIE, isValidSellerSlug } from "@/lib/referral";

export async function GET(req: NextRequest) {
  const slugFromQuery = req.nextUrl.searchParams.get("slug");

  let slug: string | null = null;
  if (slugFromQuery) {
    if (!isValidSellerSlug(slugFromQuery)) {
      return NextResponse.json({ error: "invalid slug" }, { status: 400 });
    }
    slug = slugFromQuery;
  } else {
    const cookieValue = req.cookies.get(SELLER_REF_COOKIE)?.value ?? null;
    if (cookieValue && isValidSellerSlug(cookieValue)) {
      slug = cookieValue;
    }
  }

  if (!slug) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const seller = await prisma.sellerProfile.findUnique({
    where: { slug },
    select: {
      slug: true,
      referralCode: true,
      shopName: true,
      shopLogo: true,
      isApproved: true,
    },
  });

  if (!seller || !seller.isApproved) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    slug: seller.slug,
    referralCode: seller.referralCode,
    shopName: seller.shopName,
    shopLogo: seller.shopLogo,
  });
}
