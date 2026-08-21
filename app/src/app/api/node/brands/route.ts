import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

async function requireNode() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "NODE" || !session?.user?.id) {
    return { error: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }) };
  }
  return { nodeUserId: session.user.id };
}

// 랜덤 8자리 영숫자 비밀번호 생성
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

// GET: 전체 브랜드 목록 조회
export async function GET() {
  const guard = await requireNode();
  if ("error" in guard) return guard.error;

  const brands = await prisma.brandProfile.findMany({
    include: {
      user: { select: { name: true, email: true, isActive: true, createdAt: true } },
      _count: { select: { products: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ brands });
}

// POST: 브랜드 초대 (계정 생성 + 임시 비밀번호 반환)
export async function POST(request: Request) {
  const guard = await requireNode();
  if ("error" in guard) return guard.error;

  try {
    const body = await request.json();
    const {
      brandName,
      email,
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

    if (!brandName || !email) {
      return NextResponse.json({ error: "브랜드명과 이메일은 필수입니다." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 400 });
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

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
            isApproved: true,
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

    return NextResponse.json({ success: true, user, brand: user.brandProfile, tempPassword });
  } catch (error) {
    console.error("Node brand registration error:", error);
    return NextResponse.json({ error: "브랜드 등록에 실패했습니다." }, { status: 500 });
  }
}
