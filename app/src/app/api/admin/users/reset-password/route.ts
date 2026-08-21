import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * 슈퍼관리자 전용 — 회원 비밀번호 재설정(덮어쓰기).
 *
 * 비밀번호는 bcrypt 단방향 해시로 저장되어 "복호화"는 불가능하다.
 * 따라서 기존 비밀번호를 알아내는 대신, 관리자가 지정한 새 임시 비밀번호로
 * 덮어쓴다(다시 해시하여 저장).
 */
export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  try {
    const { userId, newPassword } = await request.json();

    if (!userId || typeof newPassword !== "string") {
      return NextResponse.json(
        { error: "회원 ID와 새 비밀번호가 필요합니다." },
        { status: 400 }
      );
    }
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "비밀번호는 8자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!target) {
      return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    return NextResponse.json({
      success: true,
      message: `${target.name}(${target.email}) 님의 비밀번호가 재설정되었습니다.`,
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "비밀번호 재설정에 실패했습니다." },
      { status: 500 }
    );
  }
}
