import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST: 셀러가 입금완료 버튼 클릭 (POST_DAY 케이스)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const role = (session.user as any).role as string;
    if (role !== "SELLER") {
      return NextResponse.json({ error: "셀러만 입금완료 처리를 할 수 있습니다." }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(params);
    const orderId = resolvedParams.id;

    // 셀러 프로필 조회
    const sellerProfile = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
    });
    if (!sellerProfile) {
      return NextResponse.json({ error: "셀러 프로필을 찾을 수 없습니다." }, { status: 404 });
    }

    // 주문 조회
    const order = await (prisma.order.findUnique as any)({
      where: { id: orderId },
      select: {
        id: true,
        sellerId: true,
        cancelStatus: true,
        cancelType: true,
      },
    });
    if (!order) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    // 본인 주문인지 확인
    if (order.sellerId !== sellerProfile.id) {
      return NextResponse.json({ error: "본인 샵의 주문만 처리할 수 있습니다." }, { status: 403 });
    }

    // 취소 요청 상태인지 확인
    if (order.cancelStatus !== "REQUESTED") {
      return NextResponse.json({ error: "결제취소 요청 상태의 주문만 입금완료 처리할 수 있습니다." }, { status: 400 });
    }

    // POST_DAY 케이스인지 확인
    if (order.cancelType !== "POST_DAY") {
      return NextResponse.json({ error: "당일 취소 건은 입금완료 처리가 필요하지 않습니다." }, { status: 400 });
    }

    const now = new Date();

    await (prisma.order.update as any)({
      where: { id: orderId },
      data: {
        cancelDepositConfirmedAt: now,
        cancelStatus: "DEPOSIT_CONFIRMED",
      },
    });

    return NextResponse.json({ cancelStatus: "DEPOSIT_CONFIRMED" });
  } catch (e: any) {
    console.error("[cancel-deposit POST]", e?.message || e);
    return NextResponse.json({ error: "입금완료 처리에 실패했습니다." }, { status: 500 });
  }
}
