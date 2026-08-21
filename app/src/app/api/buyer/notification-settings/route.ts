import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 구매회원 알림 수신 설정.
// 현재: PICK한 셀러의 라이브 시작 카카오 알림톡 수신 동의(liveAlimtalkOptIn).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const buyer = await prisma.buyerProfile.findUnique({ where: { userId: session.user!.id } });
  if (!buyer) return NextResponse.json({ error: "시청자 회원 프로필 없음" }, { status: 404 });

  const body = await req.json();
  const data: { liveAlimtalkOptIn?: boolean; notifyOrder?: boolean } = {};
  if (typeof body.liveAlimtalkOptIn === "boolean") data.liveAlimtalkOptIn = body.liveAlimtalkOptIn;
  if (typeof body.notifyOrder === "boolean") data.notifyOrder = body.notifyOrder;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "변경할 설정이 없습니다" }, { status: 400 });
  }

  await prisma.buyerProfile.update({ where: { id: buyer.id }, data });
  return NextResponse.json({ success: true, ...data });
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const buyer = await prisma.buyerProfile.findUnique({
    where: { userId: session.user!.id },
    select: { liveAlimtalkOptIn: true, notifyOrder: true },
  });

  return NextResponse.json({
    liveAlimtalkOptIn: buyer?.liveAlimtalkOptIn ?? true,
    notifyOrder: buyer?.notifyOrder ?? true,
  });
}
