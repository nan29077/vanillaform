import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

// PATCH: 브랜드 소프트 삭제 (비활성화) — isApproved: false 처리, 실제 레코드 삭제 안 함
export async function PATCH(
  _req: Request,
  { params }: { params: { brandId: string } }
) {
  const guard = await requireMiddleAdmin();
  if ("error" in guard) return guard.error;

  try {
    // 본인 소속 브랜드인지 확인
    const brand = await prisma.brandProfile.findUnique({
      where: { id: params.brandId },
      select: { id: true, middleAdminId: true },
    });

    if (!brand || brand.middleAdminId !== guard.middleAdminId) {
      return NextResponse.json({ error: "브랜드를 찾을 수 없습니다." }, { status: 404 });
    }

    // 소프트 삭제: 승인 해제 (실제 delete 쿼리 사용 금지)
    await prisma.brandProfile.update({
      where: { id: params.brandId },
      data: { isApproved: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Middle brand soft-delete error:", error);
    return NextResponse.json({ error: "브랜드 비활성화에 실패했습니다." }, { status: 500 });
  }
}
