import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requestCancel } from "@/lib/seedpay";
import { logPayment } from "@/lib/paymentLog";

export const dynamic = "force-dynamic";

// 결제 취소 (전체/부분). 관리자 또는 본인 주문 한정.
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json();
  const { orderId, reason, partialAmount } = body as {
    orderId: string;
    reason?: string;
    partialAmount?: number;
  };

  if (!orderId) {
    return NextResponse.json({ error: "orderId가 필요합니다." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
  }

  const role = session.user.role;
  const isOwner = order.userId === session.user!.id;
  const isAdmin = role === "SUPER_ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "취소 권한이 없습니다." }, { status: 403 });
  }

  if (order.paymentStatus !== "COMPLETED" || !order.pgTid) {
    return NextResponse.json({ error: "취소 가능한 결제가 아닙니다." }, { status: 400 });
  }

  const finalAmount = Math.round(Number(order.finalAmount));
  const ccAmt = partialAmount && partialAmount > 0 ? Math.round(partialAmount) : finalAmount;
  const partCanFlg = ccAmt < finalAmount ? "1" : "0";

  try {
    const result = await requestCancel({
      tid: order.pgTid,
      ccAmt,
      ccMsg: reason || "고객요청",
      partCanFlg,
    });

    if (result.resultCd !== "0000") {
      await logPayment({
        orderId: order.id,
        provider: "seedpay",
        stage: "cancel",
        status: "fail",
        message: `취소 실패 [${result.resultCd}] ${result.resultMsg}`,
        pgTid: order.pgTid,
        payload: { ccAmt, partCanFlg, reason: reason || "고객요청", result },
      });
      return NextResponse.json(
        { error: `[${result.resultCd}] ${result.resultMsg}` },
        { status: 400 },
      );
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: partCanFlg === "0" ? "CANCELLED" : order.status,
        paymentStatus: partCanFlg === "0" ? "REFUNDED" : order.paymentStatus,
        cancelledAt: partCanFlg === "0" ? new Date() : order.cancelledAt,
        refundedAt: new Date(),
        pgAuthData: JSON.stringify({
          ...(order.pgAuthData ? safeParse(order.pgAuthData) : {}),
          cancel: result,
        }),
      },
    });

    await logPayment({
      orderId: order.id,
      provider: "seedpay",
      stage: "cancel",
      status: "success",
      message: `취소 완료 ccAmt=${ccAmt} part=${partCanFlg}`,
      pgTid: order.pgTid,
      payload: result,
    });
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    await logPayment({
      orderId: order.id,
      provider: "seedpay",
      stage: "cancel",
      status: "fail",
      message: `취소 요청 예외: ${e?.message ?? "unknown"}`,
      pgTid: order.pgTid,
    });
    return NextResponse.json(
      { error: `취소 요청 실패: ${e?.message ?? "unknown"}` },
      { status: 500 },
    );
  }
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
