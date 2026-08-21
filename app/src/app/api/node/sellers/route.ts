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

// email 앞부분 기반 slug 생성 + 중복 시 숫자 suffix 부여
async function generateUniqueSlug(email: string): Promise<string> {
  const base =
    email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-") || "seller";
  let slug = base;
  let suffix = 1;
  while (await prisma.sellerProfile.findUnique({ where: { slug } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

// GET: 전체 셀러 목록 조회
export async function GET() {
  const guard = await requireNode();
  if ("error" in guard) return guard.error;

  const sellers = await prisma.sellerProfile.findMany({
    include: {
      user: { select: { name: true, email: true, isActive: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ sellers });
}

// POST: 셀러 초대 (계정 생성 + 임시 비밀번호 반환)
export async function POST(request: Request) {
  const guard = await requireNode();
  if ("error" in guard) return guard.error;

  try {
    const body = await request.json();
    const { name, email, phone, shopName } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "이름과 이메일은 필수입니다." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 400 });
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);
    const slug = await generateUniqueSlug(email);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone?.trim() || null,
        password: hashedPassword,
        role: "SELLER",
        isActive: true,
        sellerProfile: {
          create: {
            slug,
            shopName: shopName?.trim() || `${name}의 샵`,
            isApproved: true,
          },
        },
      },
      include: { sellerProfile: true },
    });

    return NextResponse.json({ success: true, user, seller: user.sellerProfile, tempPassword });
  } catch (error) {
    console.error("Node seller registration error:", error);
    return NextResponse.json({ error: "셀러 등록에 실패했습니다." }, { status: 500 });
  }
}
