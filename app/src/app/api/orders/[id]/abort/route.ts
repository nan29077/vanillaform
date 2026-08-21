import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { voidPendingOrder } from "@/lib/orderStock";

export const dynamic = "force-dynamic";

// 결제 시작 전/중 사용자가 취소했거나 결제 준비가 실패한 경우, PENDING 주문을 정리.
// 선점했던 재고·캠페인 카운터·추천 커미션도 함께 롤백한다. (lib/orderStock)
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  });
  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
  }
  if (order.userId !== session.user!.id) {
    return NextResponse.json({ error: "본인 주문만 취소할 수 있습니다." }, { status: 403 });
  }

  const result = await voidPendingOrder(order.id);

  if (result === "COMPLETED") {
    return NextResponse.json({ error: "이미 결제 완료된 주문은 취소 API로 처리하세요." }, { status: 400 });
  }
  if (result === "NOT_FOUND") {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
  }
  // ALREADY — 이미 취소된 주문. 재고는 앞선 호출이 복원했으므로 여기서 다시 복원하지 않는다.
  if (result === "ALREADY") {
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }

  return NextResponse.json({ ok: true });
}
