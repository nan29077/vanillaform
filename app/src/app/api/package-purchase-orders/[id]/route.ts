import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 패키지 발주서 상태 업데이트
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const role = (session.user as any).role as string;
  const userId = session.user.id as string;

  const po = await prisma.packagePurchaseOrder.findUnique({
    where: { id: params.id },
  });

  if (!po) {
    return NextResponse.json({ error: "발주서를 찾을 수 없습니다." }, { status: 404 });
  }

  // 본인 발주서이거나 관리자만 상태 변경 가능
  if (po.recipientId !== userId && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { status } = await request.json();
  const validStatuses = ["PENDING", "CONFIRMED", "SHIPPED", "COMPLETED"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "유효하지 않은 상태입니다." }, { status: 400 });
  }

  const updated = await prisma.packagePurchaseOrder.update({
    where: { id: params.id },
    data: { status },
  });

  return NextResponse.json({
    ...updated,
    amount: Number(updated.amount),
  });
}
