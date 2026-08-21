import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isOngiCallbackSuccess,
  type OngiCallbackPayload,
} from "@/lib/ongi";
import { logPayment } from "@/lib/paymentLog";
import { voidPendingOrder } from "@/lib/orderStock";
import { notifyOrderPaid } from "@/lib/notifications";
import { notifyOrderPlacedToSeller } from "@/lib/alimtalkTriggers";

export const dynamic = "force-dynamic";

// ONGI 서버 → 가맹점 서버 통지(HTTP POST JSON).
// 가이드: HTTP 2xx 를 최대한 빠르게 반환, 멱등 키는 payment_code, HMAC 서명 없음.
// 따라서 (1) 우리 쪽 orderId 매핑(callback_url 쿼리), (2) 금액 교차 검증,
// (3) Order 가 이미 COMPLETED 면 즉시 200 으로 종료한다.
// ONGI 결제창은 가맹점으로 복귀하지 않으므로 모든 분기를 PaymentLog 에 저장한다.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const orderIdFromQuery = url.searchParams.get("orderId");

  let payload: OngiCallbackPayload;
  let rawBody: string | null = null;
  try {
    rawBody = await request.text();
    payload = JSON.parse(rawBody) as OngiCallbackPayload;
  } catch {
    await logPayment({
      provider: "ongi",
      stage: "callback",
      status: "fail",
      message: "INVALID_JSON",
      payload: { rawBody, orderIdFromQuery },
    });
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const paymentCode = payload?.payment_code;
  if (!paymentCode) {
    await logPayment({
      provider: "ongi",
      stage: "callback",
      status: "fail",
      message: "MISSING_PAYMENT_CODE",
      payload,
    });
    return NextResponse.json({ ok: false, error: "MISSING_PAYMENT_CODE" }, { status: 400 });
  }

  // 1) orderId 매핑 — 쿼리 우선, 없으면 이전에 payment_code 로 저장된 주문을 찾는다.
  let order = orderIdFromQuery
    ? await prisma.order.findUnique({ where: { id: orderIdFromQuery } })
    : null;
  if (!order) {
    order = await prisma.order.findFirst({
      where: { pgProvider: "ongi", pgTid: paymentCode },
    });
  }
  if (!order) {
    console.warn("[ongi/callback] 주문 매핑 실패", { orderIdFromQuery, paymentCode });
    await logPayment({
      provider: "ongi",
      stage: "callback",
      status: "fail",
      message: "ORDER_NOT_FOUND",
      pgTid: paymentCode,
      payload: { orderIdFromQuery, body: payload },
    });
    // 매핑 실패도 2xx 반환(재시도 폭주 방지). 운영 알람은 로그/모니터링으로.
    return NextResponse.json({ ok: false, error: "ORDER_NOT_FOUND" });
  }

  // 2) 멱등 — 이미 완료된 주문이면 추가 처리 없이 종료.
  if (order.paymentStatus === "COMPLETED") {
    await logPayment({
      orderId: order.id,
      provider: "ongi",
      stage: "callback",
      status: "info",
      message: "IDEMPOTENT — already completed",
      pgTid: paymentCode,
      payload,
    });
    return NextResponse.json({ ok: true, idempotent: true });
  }

  // 3) 실패 결과는 주문을 실패 처리 — 선점했던 재고·캠페인 카운터·커미션도 함께 되돌린다.
  if (!isOngiCallbackSuccess(payload)) {
    await voidPendingOrder(order.id, {
      pgProvider: "ongi",
      pgTid: paymentCode,
      pgAuthData: JSON.stringify(payload),
    });
    await logPayment({
      orderId: order.id,
      provider: "ongi",
      stage: "callback",
      status: "fail",
      message: `ONGI 결제 실패 [${payload.result_cd ?? "?"}] ${payload.result_msg ?? ""}`,
      pgTid: paymentCode,
      payload,
    });
    return NextResponse.json({ ok: true });
  }

  // 4) 금액 교차 검증 — payment_amt 와 Order.finalAmount 비교.
  const paid = Number(payload.payment_amt ?? payload.pay_price ?? 0);
  const expected = Math.round(Number(order.finalAmount));
  if (!paid || paid !== expected) {
    console.warn("[ongi/callback] 금액 불일치", { orderId: order.id, paid, expected });
    await voidPendingOrder(order.id, {
      pgProvider: "ongi",
      pgTid: paymentCode,
      pgAuthData: JSON.stringify({ reason: "AMOUNT_MISMATCH", paid, expected, payload }),
    });
    await logPayment({
      orderId: order.id,
      provider: "ongi",
      stage: "callback",
      status: "fail",
      message: `AMOUNT_MISMATCH paid=${paid} expected=${expected}`,
      pgTid: paymentCode,
      payload,
    });
    return NextResponse.json({ ok: false, error: "AMOUNT_MISMATCH" });
  }

  // 5) 정상 완료.
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "PAID",
      paymentStatus: "COMPLETED",
      paymentMethod: "BANK",
      pgProvider: "ongi",
      pgTid: paymentCode,
      pgAuthData: JSON.stringify(payload),
      paidAt: new Date(),
      ...(({ deliveryStatus: "PAYMENT_COMPLETED" }) as any),
    },
  });
  // 결제 완료 → 해당 샵 셀러에게 주문접수 알림톡 (실패해도 결제 처리에 영향 없음)
  await notifyOrderPlacedToSeller(order.id).catch((e) => console.error("[ongi] 주문접수 알림톡 오류:", e));
  await logPayment({
    orderId: order.id,
    provider: "ongi",
    stage: "callback",
    status: "success",
    message: `ONGI 결제 완료 paid=${paid}`,
    pgTid: paymentCode,
    payload,
  });
  // 구매자에게 주문 완료 인앱 알림 (SeedPay 흐름과 동일, 실패해도 결제 흐름은 막지 않음)
  await notifyOrderPaid(order.id).catch(() => {});

  return NextResponse.json({ ok: true });
}
