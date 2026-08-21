import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ sellerNotApproved: false });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { sellerProfile: true },
    });

    if (user && user.role === "SELLER" && user.sellerProfile && !user.sellerProfile.isApproved) {
      return NextResponse.json({ sellerNotApproved: true });
    }

    return NextResponse.json({ sellerNotApproved: false });
  } catch {
    return NextResponse.json({ sellerNotApproved: false });
  }
}
