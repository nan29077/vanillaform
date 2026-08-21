import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildOngiCheckoutUrl, ensureOngiConfigured } from "@/lib/ongi";
import { logPayment } from "@/lib/paymentLog";

export const dynamic = "force-dynamic";

// ONGI 간편 계좌결제용 결제창 URL 생성.
// 응답으로 받은 checkoutUrl 로 사용자를 이동시키면 ONGI 결제창이 열린다.
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    ensureOngiConfigured();
  } catch (e: any) {
    await logPayment({
      provider: "ongi",
      stage: "prepare",
      status: "fail",
      message: `ONGI 설정 누락: ${e.message}`,
    });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  const { orderId } = await request.json();
  if (!orderId) {
    return NextResponse.json({ error: "orderId가 필요합니다." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: { select: { name: true, phone: true } } },
  });
  if (!order) {
    await logPayment({
      orderId,
      provider: "ongi",
      stage: "prepare",
      status: "fail",
      message: "ORDER_NOT_FOUND",
    });
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
  }
  if (order.userId !== session.user!.id) {
    await logPayment({
      orderId: order.id,
      provider: "ongi",
      stage: "prepare",
      status: "fail",
      message: `OWNERSHIP_MISMATCH session=${session.user!.id} order.user=${order.userId}`,
    });
    return NextResponse.json({ error: "본인 주문만 결제할 수 있습니다." }, { status: 403 });
  }
  if (order.paymentStatus === "COMPLETED") {
    return NextResponse.json({ error: "이미 결제 완료된 주문입니다." }, { status: 400 });
  }

  const amount = Math.round(Number(order.finalAmount));
  if (amount <= 0) {
    await logPayment({
      orderId: order.id,
      provider: "ongi",
      stage: "prepare",
      status: "fail",
      message: `INVALID_AMOUNT amount=${amount}`,
    });
    return NextResponse.json({ error: "결제 금액이 유효하지 않습니다." }, { status: 400 });
  }

  // ONGI 콜백 본문에는 order_code 가 null 로 올 수 있으므로(가맹점 식별자 미공유)
  // callback_url 쿼리스트링으로 주문 id 를 함께 넘긴다. 서버↔서버 통지라 외부 노출 없음.
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    new URL(request.url).origin;
  const callbackUrl = `${baseUrl}/api/payments/ongi/callback?orderId=${encodeURIComponent(order.id)}`;
  const returnUrl = `${baseUrl}/checkout/complete?orderId=${encodeURIComponent(order.id)}`;

  const name = order.shippingName || order.user.name || "구매자";
  const phone = (order.shippingPhone || order.user.phone || "").replace(/[^0-9]/g, "");
  if (!phone) {
    await logPayment({
      orderId: order.id,
      provider: "ongi",
      stage: "prepare",
      status: "fail",
      message: "MISSING_PHONE",
    });
    return NextResponse.json({ error: "결제자 휴대폰 번호가 없습니다." }, { status: 400 });
  }

  // 이 주문이 온기(간편계좌) 결제 시도임을 미리 표시한다.
  // 온기는 구매자가 나중에 실제 이체하는 비동기 입금 방식이라 결제창을 연 뒤 30분을
  // 넘겨 입금하는 것이 정상이다. 콜백 도착 전까지는 pgProvider 가 비어 있어 stale
  // PENDING 정리에 삭제될 수 있으므로, 여기서 pgProvider="ongi" 로 마킹하여
  // cleanupStalePendingOrders 의 정리 대상에서 제외되도록 한다.
  await prisma.order
    .update({ where: { id: order.id }, data: { pgProvider: "ongi" } })
    .catch(() => {
      /* 마킹 실패가 결제창 진입을 막지 않도록 무시 */
    });

  const checkoutUrl = buildOngiCheckoutUrl({
    amount,
    name,
    phone,
    callbackUrl,
    returnUrl,
  });

  await logPayment({
    orderId: order.id,
    provider: "ongi",
    stage: "prepare",
    status: "info",
    message: `ONGI 결제창 호출 준비 amount=${amount}`,
    payload: { checkoutUrl, callbackUrl, returnUrl, name, phone },
  });

  return NextResponse.json({ checkoutUrl });
}
