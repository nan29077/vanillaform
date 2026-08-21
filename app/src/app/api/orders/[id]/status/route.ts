import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// /checkout/complete 페이지에서 ONGI 같은 비동기 콜백 PG 의 결제 결과 확정을 위해
// 주문 상태를 폴링하기 위한 최소 정보 응답.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      userId: true,
      status: true,
      paymentStatus: true,
      pgProvider: true,
      pgTid: true,
    },
  });
  if (!order) {
    return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
  }
  if (order.userId !== session.user!.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  return NextResponse.json({
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    pgProvider: order.pgProvider,
    pgTid: order.pgTid,
  });
}
