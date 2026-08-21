import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildPayRequestHash,
  ensureSeedpayConfigured,
  getEdiDate,
  seedpayConfig,
} from "@/lib/seedpay";

export const dynamic = "force-dynamic";

// 결제창 호출을 위한 폼 파라미터 생성
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    ensureSeedpayConfigured();
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  const { orderId, payMethod } = await request.json();
  if (!orderId) {
    return NextResponse.json({ error: "orderId가 필요합니다." }, { status: 400 });
  }

  // SeedPay 가이드 page 9 — method 허용값: ALL | CARD | BANK | VACNT
  // UI 의 "EASYPAY" 는 SeedPay 가 정의하지 않은 값이므로 ALL(전체 결제수단) 로 매핑.
  const METHOD_MAP: Record<string, string> = {
    CARD: "CARD",
    BANK: "BANK",
    VACNT: "VACNT",
    EASYPAY: "ALL",
    ALL: "ALL",
  };
  const method = METHOD_MAP[String(payMethod || "").toUpperCase()] ?? "CARD";

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: { select: { email: true, name: true, phone: true } } },
  });
  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
  }
  if (order.userId !== session.user!.id) {
    return NextResponse.json({ error: "본인 주문만 결제할 수 있습니다." }, { status: 403 });
  }
  if (order.paymentStatus === "COMPLETED") {
    return NextResponse.json({ error: "이미 결제 완료된 주문입니다." }, { status: 400 });
  }

  const ediDate = getEdiDate();
  const goodsAmt = Math.round(Number(order.finalAmount));
  if (goodsAmt <= 0) {
    return NextResponse.json({ error: "결제 금액이 유효하지 않습니다." }, { status: 400 });
  }
  const hashString = buildPayRequestHash(ediDate, goodsAmt);

  const firstItem = order.items[0];
  const goodsNm = order.items.length > 1
    ? `${firstItem?.productName ?? "상품"} 외 ${order.items.length - 1}건`
    : firstItem?.productName ?? "상품";

  // nginx 가 Host 헤더를 전달하지 않을 때 request.url 이 localhost:3026 으로 평가되므로
  // 환경변수(NEXT_PUBLIC_APP_URL=http://localhost:3026) 를 우선 사용한다.
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    new URL(request.url).origin;
  const returnUrl = `${baseUrl}/api/payments/seedpay/result`;

  // SeedPay 필드명: NicePay 호환 legacy 스타일 (mid/ordNo/goodsAmt/ordNm)
  return NextResponse.json({
    pgJsUrl: seedpayConfig.pgJsUrl,
    isProduction: seedpayConfig.isProduction,
    form: {
      mid: seedpayConfig.mid,
      method,
      goodsNm,
      ordNo: order.orderNumber,
      goodsAmt: String(goodsAmt),
      ordNm: order.shippingName || order.user.name || "구매자",
      ordEmail: order.user.email || "",
      ordTel: (order.shippingPhone || order.user.phone || "").replace(/[^0-9]/g, ""),
      ordIp: "",
      mbsUsrId: order.userId,
      mbsReserved: order.id,
      ediDate,
      hashString,
      returnUrl,
    },
  });
}
