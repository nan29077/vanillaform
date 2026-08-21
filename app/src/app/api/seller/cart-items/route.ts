import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 셀러가 자신의 샵에 담긴 장바구니 항목을 삭제 (선택/전체)
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    if ((session.user as any).role !== "SELLER") {
      return NextResponse.json({ error: "셀러만 삭제할 수 있습니다." }, { status: 403 });
    }

    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user.id as string },
      select: { id: true },
    });
    if (!seller) {
      return NextResponse.json({ error: "셀러 정보를 찾을 수 없습니다." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.map(String) : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "삭제할 항목이 없습니다." }, { status: 400 });
    }

    // 반드시 이 셀러의 항목만 삭제 (sellerId 조건으로 소유권 보장)
    const result = await prisma.cartItem.deleteMany({
      where: { id: { in: ids }, sellerId: seller.id },
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (e: any) {
    console.error("[seller cart-items DELETE]", e?.message || e);
    return NextResponse.json({ error: "장바구니 삭제에 실패했습니다." }, { status: 500 });
  }
}
