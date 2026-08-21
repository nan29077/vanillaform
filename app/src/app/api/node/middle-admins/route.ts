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

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

// GET: 이 노드 담당 중간관리자 목록
export async function GET() {
  const guard = await requireNode();
  if ("error" in guard) return guard.error;

  const middleAdmins = await (prisma as any).middleAdminProfile.findMany({
    where: { assignedNodeId: guard.nodeUserId },
    include: {
      user: { select: { name: true, email: true, isActive: true, createdAt: true } },
      _count: { select: { brands: true, sellers: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ middleAdmins });
}

// POST: 중간관리자 초대 (계정 생성)
export async function POST(request: Request) {
  const guard = await requireNode();
  if ("error" in guard) return guard.error;

  try {
    const body = await request.json();
    const { name, email, phone, commissionRate, bizNumber, companyName, bankName, accountNumber, accountHolder } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "이름과 이메일은 필수입니다." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 400 });
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone?.trim() || null,
        password: hashedPassword,
        role: "MIDDLE_ADMIN",
        isActive: true,
        middleAdminProfile: {
          create: {
            name,
            contactPhone: phone?.trim() || null,
            commissionRate: commissionRate ?? 5,
            bizNumber: bizNumber || null,
            companyName: companyName || null,
            bankName: bankName || null,
            accountNumber: accountNumber || null,
            accountHolder: accountHolder || null,
            isActive: true,
            isApproved: true,
            assignedNodeId: guard.nodeUserId,
          } as any,
        },
      },
      include: { middleAdminProfile: true },
    });

    return NextResponse.json({ success: true, user, middleAdmin: (user as any).middleAdminProfile, tempPassword });
  } catch (error) {
    console.error("Node middle-admin registration error:", error);
    return NextResponse.json({ error: "중간관리자 등록에 실패했습니다." }, { status: 500 });
  }
}
