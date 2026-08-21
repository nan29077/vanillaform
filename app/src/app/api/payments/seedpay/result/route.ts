import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildPayRequestHash,
  buildSignVerifyHash,
  requestApproval,
  requestNetCancel,
} from "@/lib/seedpay";
import { logPayment } from "@/lib/paymentLog";
import { voidPendingOrder } from "@/lib/orderStock";
import { notifyOrderPaid } from "@/lib/notifications";
import { notifyOrderPlacedToSeller } from "@/lib/alimtalkTriggers";

export const dynamic = "force-dynamic";

// SeedPay 결제창에서 인증 완료 후 POST로 호출되는 콜백.
// 1) signData 검증 → 2) 승인 API 호출 → 3) Order 업데이트 → 4) 결과 페이지로 리다이렉트 HTML 반환
export async function POST(request: Request) {
  const form = await request.formData();
  const get = (k: string) => (form.get(k)?.toString() ?? "");

  const resultCd = get("resultCd");
  const resultMsg = get("resultMsg");
  const nonce = get("nonce");
  const tid = get("tid");
  const mId = get("mId") || get("mid");
  const orderId = get("orderId") || get("ordNo");
  const amount = get("amount") || get("goodsAmt");
  const ediDate = get("ediDate");
  const payData = get("payData");
  const signData = get("signData");
  const approvalUrl = get("approvalUrl");
  const netCancelUrl = get("netCancelUrl");

  // nginx 가 Host 헤더를 전달하지 않을 때 request.url 이 localhost:3026 으로 평가되므로
  // 환경변수(NEXT_PUBLIC_APP_URL=http://localhost:3026) 를 우선 사용한다.
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    new URL(request.url).origin;
  const successRedirect = (oid: string) =>
    `${origin}/checkout/complete?orderId=${oid}`;
  const failRedirect = (oid: string | null, msg: string) =>
    `${origin}/checkout/complete?` +
    (oid ? `orderId=${oid}&` : "") +
    `status=fail&msg=${encodeURIComponent(msg)}`;

  const mbsReserved = get("mbsReserved");
  let order = mbsReserved
    ? await prisma.order.findUnique({ where: { id: mbsReserved } })
    : null;
  if (!order && orderId) {
    order = await prisma.order.findUnique({ where: { orderNumber: orderId } });
  }

  // 멱등성 가드: 이미 결제완료(COMPLETED)된 주문은 중복 콜백(인증토큰 재사용으로 인한
  // resultCd=9999 등)으로 다시 들어와도 절대 실패/취소 처리하지 않고 성공 페이지로 보낸다.
  // SeedPay 결제창이 /result 를 2번 호출하면서 정상 결제건이 CANCELLED 로 덮어써지던 버그 방지.
  if (order && order.paymentStatus === "COMPLETED") {
    await logPayment({
      orderId: order.id,
      provider: "seedpay",
      stage: "result",
      status: "info",
      message: `중복 콜백 무시 (이미 결제완료) resultCd=${resultCd}`,
      pgTid: tid || order.pgTid || null,
      payload: Object.fromEntries(form),
    });
    return htmlRedirect(successRedirect(order.id));
  }

  if (resultCd !== "0000") {
    if (order) {
      await markOrderFailed(order.id, `[${resultCd}] ${resultMsg}`);
    }
    await logPayment({
      orderId: order?.id ?? null,
      provider: "seedpay",
      stage: "result",
      status: "fail",
      message: `인증 실패 [${resultCd}] ${resultMsg}`,
      pgTid: tid || null,
      payload: Object.fromEntries(form),
    });
    return htmlRedirect(failRedirect(order?.id ?? null, resultMsg || "결제 인증 실패"));
  }

  const expectedSign = buildSignVerifyHash(tid, mId, ediDate, amount, orderId);
  if (signData && signData !== expectedSign) {
    console.warn("[seedpay/result] signData 불일치", { received: signData, expected: expectedSign });
    await logPayment({
      orderId: order?.id ?? null,
      provider: "seedpay",
      stage: "result",
      status: "warn",
      message: "signData 불일치 (위·변조 의심)",
      pgTid: tid || null,
      payload: { received: signData, expected: expectedSign },
    });
  }

  if (!order) {
    await logPayment({
      provider: "seedpay",
      stage: "result",
      status: "fail",
      message: "ORDER_NOT_FOUND",
      pgTid: tid || null,
      payload: Object.fromEntries(form),
    });
    return htmlRedirect(failRedirect(null, "주문 매핑 실패"));
  }
  if (Math.round(Number(order.finalAmount)) !== Number(amount)) {
    await markOrderFailed(order.id, "금액 불일치");
    await logPayment({
      orderId: order.id,
      provider: "seedpay",
      stage: "result",
      status: "fail",
      message: `AMOUNT_MISMATCH paid=${amount} expected=${Math.round(Number(order.finalAmount))}`,
      pgTid: tid || null,
    });
    return htmlRedirect(failRedirect(order.id, "결제 금액 불일치"));
  }

  const approvalHash = buildPayRequestHash(ediDate, amount);
  try {
    const approval = await requestApproval(approvalUrl, {
      nonce,
      tid,
      mid: mId,
      goodsAmt: amount,
      ediDate,
      mbsReserved,
      hashString: approvalHash,
      payData,
    });
    if (approval.resultCd !== "0000") {
      await markOrderFailed(order.id, `[${approval.resultCd}] ${approval.resultMsg}`);
      await logPayment({
        orderId: order.id,
        provider: "seedpay",
        stage: "approval",
        status: "fail",
        message: `승인 실패 [${approval.resultCd}] ${approval.resultMsg}`,
        pgTid: approval.tid ?? tid,
        payload: approval,
      });
      return htmlRedirect(failRedirect(order.id, approval.resultMsg || "승인 실패"));
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paymentStatus: "COMPLETED",
        paymentMethod: "CARD",
        pgProvider: "seedpay",
        pgTid: approval.tid ?? tid,
        pgAuthData: JSON.stringify(approval),
        paidAt: new Date(),
        ...(({ deliveryStatus: "PAYMENT_COMPLETED" }) as any),
      },
    });
    // 결제 완료 → 해당 샵 셀러에게 주문접수 알림톡 (실패해도 결제 처리에 영향 없음)
    await notifyOrderPlacedToSeller(order.id).catch((e) => console.error("[seedpay] 주문접수 알림톡 오류:", e));
    await logPayment({
      orderId: order.id,
      provider: "seedpay",
      stage: "approval",
      status: "success",
      message: `SeedPay 결제 완료 amount=${amount}`,
      pgTid: approval.tid ?? tid,
      payload: approval,
    });
    // 구매자에게 주문 완료 인앱 알림 (실패해도 결제 흐름은 막지 않음)
    await notifyOrderPaid(order.id).catch(() => {});

    return htmlRedirect(successRedirect(order.id));
  } catch (e: any) {
    if (netCancelUrl) {
      await requestNetCancel(netCancelUrl, tid, mId);
    }
    await markOrderFailed(order.id, `승인 요청 오류: ${e?.message ?? "unknown"}`);
    await logPayment({
      orderId: order.id,
      provider: "seedpay",
      stage: "approval",
      status: "fail",
      message: `승인 요청 예외: ${e?.message ?? "unknown"}`,
      pgTid: tid || null,
      payload: { netCancelTriggered: !!netCancelUrl },
    });
    return htmlRedirect(failRedirect(order.id, "승인 요청 실패"));
  }
}

async function markOrderFailed(orderId: string, reason: string) {
  // 주문 생성 시 선점했던 재고·캠페인 카운터·커미션을 함께 되돌린다.
  // 방어선 2(이미 결제완료된 주문은 실패로 덮어쓰지 않음)와 중복 호출 방어(/result 2회 호출 시
  // 재고가 두 번 복원되는 문제)는 voidPendingOrder 가 조건부 상태 전이로 처리한다.
  const result = await voidPendingOrder(orderId, {
    pgAuthData: JSON.stringify({ failed: true, reason }),
  });
  if (result === "COMPLETED") {
    console.warn(`[seedpay/result] markOrderFailed 무시 — 이미 결제완료 (orderId=${orderId}, reason=${reason})`);
  }
}

function htmlRedirect(url: string) {
  const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>결제 처리 중</title></head>
<body>
<script>
(function(){
  var target = ${JSON.stringify(url)};
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.location.href = target;
      window.close();
      return;
    }
    if (window.top && window.top !== window.self) {
      window.top.location.href = target;
      return;
    }
  } catch (e) {}
  window.location.href = target;
})();
</script>
<p>결제 결과를 처리 중입니다. 이동되지 않으면 <a href="${url}">여기</a>를 클릭하세요.</p>
</body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
