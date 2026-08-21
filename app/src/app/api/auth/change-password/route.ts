import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { currentPassword, newPassword } = await req.json() as {
      currentPassword: string;
      newPassword: string;
    };
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "모든 필드를 입력해주세요" }, { status: 400 });
    }
    // 최고관리자는 플랫폼 전체 권한을 가지므로 최소 길이를 8자로 강화
    const minLength = session.user.role === "SUPER_ADMIN" ? 8 : 6;
    if (newPassword.length < minLength) {
      return NextResponse.json(
        { error: `새 비밀번호는 ${minLength}자 이상이어야 합니다` },
        { status: 400 }
      );
    }
    if (newPassword === currentPassword) {
      return NextResponse.json(
        { error: "현재 비밀번호와 다른 비밀번호를 입력해주세요" },
        { status: 400 }
      );
    }
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    });
    if (!user?.password) {
      return NextResponse.json({ error: "소셜 로그인 계정은 비밀번호를 변경할 수 없습니다" }, { status: 400 });
    }
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json({ error: "현재 비밀번호가 올바르지 않습니다" }, { status: 400 });
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashed },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Change password error:", error);
    return NextResponse.json({ error: "비밀번호 변경에 실패했습니다" }, { status: 500 });
  }
}
