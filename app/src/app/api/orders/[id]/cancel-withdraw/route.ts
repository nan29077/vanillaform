import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST: 셀러가 결제취소 요청 철회 (관리자 승인 전 REQUESTED 상태만 가능)
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
      return NextResponse.json({ error: "셀러만 취소 요청을 철회할 수 있습니다." }, { status: 403 });
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
      },
    });
    if (!order) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    // 본인 주문인지 확인
    if (order.sellerId !== sellerProfile.id) {
      return NextResponse.json({ error: "본인 샵의 주문만 철회할 수 있습니다." }, { status: 403 });
    }

    // REQUESTED 상태만 철회 가능 (관리자 승인 전)
    if (order.cancelStatus !== "REQUESTED") {
      return NextResponse.json(
        { error: "관리자 승인 전(요청 중) 상태의 주문만 철회할 수 있습니다." },
        { status: 400 }
      );
    }

    // 취소 관련 필드 모두 초기화
    await (prisma.order.update as any)({
      where: { id: orderId },
      data: {
        cancelStatus: null,
        cancelRequestedAt: null,
        cancelRequestedBy: null,
        cancelReason: null,
        cancelType: null,
        cancelAmount: null,
        cancelFromSettlement: false,
        deliveryStatus: "PAYMENT_COMPLETED",
      },
    });

    return NextResponse.json({ message: "취소 요청이 철회되었습니다." });
  } catch (e: any) {
    console.error("[cancel-withdraw POST]", e?.message || e);
    return NextResponse.json({ error: "취소 요청 철회에 실패했습니다." }, { status: 500 });
  }
}
