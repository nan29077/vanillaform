import { prisma } from "@/lib/prisma";
import { requestSmartropayApproval, isSmartropaySuccess } from "@/lib/smartropay";
import { logPayment } from "@/lib/paymentLog";
import { notifyOrderPlacedToSeller } from "@/lib/alimtalkTriggers";

export const dynamic = "force-dynamic";

// 스마트로 결제창의 ReturnUrl 콜백.
// 인증 결과(Tid + TrAuthKey)를 POST 로 받아 승인 API 호출 후 주문 상태 업데이트.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const cancelled = url.searchParams.get("cancelled") === "1";

  const form = await request.formData().catch(() => null);
  const get = (k: string) => (form?.get(k)?.toString() ?? "");

  const ResultCode = get("ResultCode");
  const ResultMsg = get("ResultMsg");
  const Tid = get("Tid");
  const TrAuthKey = get("TrAuthKey");
  const Moid = get("Moid");
  const Amt = get("Amt");
  const MallReserved = get("MallReserved");

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

  // 주문 매핑 — MallReserved(우리 order.id) 우선, 없으면 Moid(orderNumber).
  let order = MallReserved
    ? await prisma.order.findUnique({ where: { id: MallReserved } })
    : null;
  if (!order && Moid) {
    order = await prisma.order.findUnique({ where: { orderNumber: Moid } });
  }

  const formSnapshot = form ? Object.fromEntries(form) : {};

  // 멱등성 가드: 이미 결제완료(COMPLETED)된 주문은 중복 콜백으로 다시 들어와도
  // 실패/취소 처리하지 않고 성공 페이지로 보낸다. (seedpay /result 와 동일한 방어)
  if (order && order.paymentStatus === "COMPLETED") {
    await logPayment({
      orderId: order.id,
      provider: "smartropay",
      stage: "result",
      status: "info",
      message: `중복 콜백 무시 (이미 결제완료) ResultCode=${ResultCode}`,
      pgTid: Tid || order.pgTid || null,
      payload: formSnapshot,
    });
    return htmlRedirect(successRedirect(order.id));
  }

  if (cancelled) {
    if (order) await markOrderFailed(order.id, "사용자 결제 중단");
    await logPayment({
      orderId: order?.id ?? null,
      provider: "smartropay",
      stage: "result",
      status: "warn",
      message: "사용자 결제 중단(StopUrl)",
      pgTid: Tid || null,
      payload: formSnapshot,
    });
    return htmlRedirect(failRedirect(order?.id ?? null, "결제를 취소하였습니다."));
  }

  // 인증 단계 성공 코드: 카드 "0000", 간편결제는 결제수단별 코드(KP00 등) — 헬퍼로 판정.
  if (ResultCode && !isSmartropaySuccess(ResultCode)) {
    if (order) await markOrderFailed(order.id, `[${ResultCode}] ${ResultMsg}`);
    await logPayment({
      orderId: order?.id ?? null,
      provider: "smartropay",
      stage: "result",
      status: "fail",
      message: `인증 실패 [${ResultCode}] ${ResultMsg}`,
      pgTid: Tid || null,
      payload: formSnapshot,
    });
    return htmlRedirect(failRedirect(order?.id ?? null, ResultMsg || "결제 인증 실패"));
  }

  if (!Tid || !TrAuthKey) {
    if (order) await markOrderFailed(order.id, "인증 응답 누락");
    await logPayment({
      orderId: order?.id ?? null,
      provider: "smartropay",
      stage: "result",
      status: "fail",
      message: "Tid/TrAuthKey 누락",
      payload: formSnapshot,
    });
    return htmlRedirect(failRedirect(order?.id ?? null, "결제 인증 정보 누락"));
  }
  if (!order) {
    await logPayment({
      provider: "smartropay",
      stage: "result",
      status: "fail",
      message: "ORDER_NOT_FOUND",
      pgTid: Tid,
      payload: formSnapshot,
    });
    return htmlRedirect(failRedirect(null, "주문 매핑 실패"));
  }
  if (Amt && Math.round(Number(order.finalAmount)) !== Number(Amt)) {
    await markOrderFailed(order.id, "금액 불일치");
    await logPayment({
      orderId: order.id,
      provider: "smartropay",
      stage: "result",
      status: "fail",
      message: `AMOUNT_MISMATCH paid=${Amt} expected=${Math.round(Number(order.finalAmount))}`,
      pgTid: Tid,
    });
    return htmlRedirect(failRedirect(order.id, "결제 금액 불일치"));
  }

  try {
    const approval = await requestSmartropayApproval({ Tid, TrAuthKey });

    if (!isSmartropaySuccess(approval.ResultCode)) {
      await markOrderFailed(order.id, `[${approval.ResultCode}] ${approval.ResultMsg}`);
      await logPayment({
        orderId: order.id,
        provider: "smartropay",
        stage: "approval",
        status: "fail",
        message: `승인 실패 [${approval.ResultCode}] ${approval.ResultMsg}`,
        pgTid: approval.Tid ?? Tid,
        payload: approval,
      });
      return htmlRedirect(failRedirect(order.id, approval.ResultMsg || "승인 실패"));
    }

    // 승인 응답 금액 교차 검증 (변조 방지).
    if (approval.Amt && Math.round(Number(order.finalAmount)) !== Number(approval.Amt)) {
      await markOrderFailed(order.id, "승인 금액 불일치");
      await logPayment({
        orderId: order.id,
        provider: "smartropay",
        stage: "approval",
        status: "fail",
        message: `승인 금액 불일치 approval.Amt=${approval.Amt} expected=${Math.round(Number(order.finalAmount))}`,
        pgTid: approval.Tid ?? Tid,
        payload: approval,
      });
      return htmlRedirect(failRedirect(order.id, "승인 금액 불일치"));
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paymentStatus: "COMPLETED",
        paymentMethod: approval.PayMethod || "EASYPAY",
        pgProvider: "smartropay",
        pgTid: approval.Tid ?? Tid,
        pgAuthData: JSON.stringify(approval),
        paidAt: new Date(),
        ...(({ deliveryStatus: "PAYMENT_COMPLETED" }) as any),
      },
    });
    // 결제 완료 → 해당 샵 셀러에게 주문접수 알림톡 (실패해도 결제 처리에 영향 없음)
    await notifyOrderPlacedToSeller(order.id).catch((e) => console.error("[smartropay] 주문접수 알림톡 오류:", e));
    await logPayment({
      orderId: order.id,
      provider: "smartropay",
      stage: "approval",
      status: "success",
      message: `Smartro 결제 완료 amount=${approval.Amt ?? Amt}`,
      pgTid: approval.Tid ?? Tid,
      payload: approval,
    });

    return htmlRedirect(successRedirect(order.id));
  } catch (e: any) {
    await markOrderFailed(order.id, `승인 요청 오류: ${e?.message ?? "unknown"}`);
    await logPayment({
      orderId: order.id,
      provider: "smartropay",
      stage: "approval",
      status: "fail",
      message: `승인 요청 예외: ${e?.message ?? "unknown"}`,
      pgTid: Tid || null,
    });
    return htmlRedirect(failRedirect(order.id, "승인 요청 실패"));
  }
}

// StopUrl 도 GET 으로 호출될 수 있어 동일 처리.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const cancelled = url.searchParams.get("cancelled") === "1";

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    new URL(request.url).origin;

  return htmlRedirect(
    `${origin}/checkout/complete?status=fail&msg=${encodeURIComponent(
      cancelled ? "결제를 취소하였습니다." : "결제 응답 누락",
    )}`,
  );
}

async function markOrderFailed(orderId: string, reason: string) {
  // 방어선 2: 이미 결제완료된 주문은 어떤 경로로도 실패로 덮어쓰지 않는다.
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    select: { paymentStatus: true },
  });
  if (existing?.paymentStatus === "COMPLETED") {
    console.warn(`[smartropay/result] markOrderFailed 무시 — 이미 결제완료 (orderId=${orderId}, reason=${reason})`);
    return;
  }
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "CANCELLED",
      paymentStatus: "FAILED",
      cancelledAt: new Date(),
      pgAuthData: JSON.stringify({ failed: true, reason }),
    },
  });
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
