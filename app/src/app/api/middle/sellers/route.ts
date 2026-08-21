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

// email 앞부분 기반 slug 생성 + 중복 시 숫자 suffix 부여
async function generateUniqueSlug(email: string): Promise<string> {
  const base =
    email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-") || "seller";
  let slug = base;
  let suffix = 1;
  // 중복되면 -1, -2 ... 붙여서 고유 slug 확보
  while (await prisma.sellerProfile.findUnique({ where: { slug } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

// GET: 본인 소속 셀러 목록 조회
export async function GET() {
  const guard = await requireMiddleAdmin();
  if ("error" in guard) return guard.error;

  const sellers = await prisma.sellerProfile.findMany({
    where: { middleAdminId: guard.middleAdminId },
    include: {
      user: { select: { name: true, email: true, isActive: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ sellers });
}

// POST: 셀러 등록 (중간관리자가 본인 소속으로 등록)
export async function POST(request: Request) {
  const guard = await requireMiddleAdmin();
  if ("error" in guard) return guard.error;

  try {
    const body = await request.json();
    const { name, email, password, phone, shopName } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "이름, 이메일, 비밀번호는 필수입니다." },
        { status: 400 }
      );
    }
    if (String(password).length < 8) {
      return NextResponse.json(
        { error: "비밀번호는 8자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    // 이메일 중복 확인
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const slug = await generateUniqueSlug(email);

    // 유저 + 셀러 프로필 동시 생성 (본인 소속으로 연결, 즉시 승인)
    // 마진율(middleAdminMarginRate)은 설정하지 않음 → 스키마 기본값 사용 (최고관리자 전용)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone?.trim() || null,
        password: hashedPassword,
        role: "SELLER",
        isActive: true,
        managedByMiddleAdminId: guard.middleAdminId, // 귀속 중간관리자
        sellerProfile: {
          create: {
            slug,
            shopName: shopName?.trim() || `${name}의 샵`,
            isApproved: true,
            middleAdminId: guard.middleAdminId, // 본인 소속으로 연결
          },
        },
      },
      include: { sellerProfile: true },
    });

    return NextResponse.json({ success: true, user, seller: user.sellerProfile });
  } catch (error) {
    console.error("Middle seller registration error:", error);
    return NextResponse.json({ error: "라이브 셀러 등록에 실패했습니다." }, { status: 500 });
  }
}
