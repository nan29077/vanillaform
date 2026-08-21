import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildEncryptData,
  ensureSmartropayConfigured,
  getEdiDate,
  normalizeMethod,
  smartropayConfig,
} from "@/lib/smartropay";

export const dynamic = "force-dynamic";

// 결제창 호출용 폼 파라미터 생성. 실제 결제창은 /api/payments/smartropay/launch 가
// iframe 내부에서 same-origin HTML 로 받아 자동 submit 한다.
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    ensureSmartropayConfigured();
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  const { orderId, payMethod } = await request.json();
  if (!orderId) {
    return NextResponse.json({ error: "orderId가 필요합니다." }, { status: 400 });
  }

  // UI 의 "EASYPAY" 는 스마트로 PayMethod 가 아니므로 CARD 로 매핑 (스마트로 카드 결제창에
  // 간편결제 옵션들이 함께 노출됨).
  const PayMethod = normalizeMethod(
    String(payMethod || "").toUpperCase() === "EASYPAY" ? "CARD" : payMethod,
  );

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
  const Amt = Math.round(Number(order.finalAmount));
  if (Amt <= 0) {
    return NextResponse.json({ error: "결제 금액이 유효하지 않습니다." }, { status: 400 });
  }
  const EncryptData = buildEncryptData(ediDate, Amt);

  // 부가세 분리 — 스마트로는 TaxAmt(공급가액)+VatAmt(부가세)+TaxFreeAmt(비과세)==Amt 를 검증한다.
  // 미전송 시 0 처리되어 합계 불일치(ResultCode 1614)가 나므로 과세 상품 기준으로 명시한다.
  // 부가세 = round(Amt/11), 공급가액 = Amt - 부가세, 비과세 = 0 → 셋의 합은 항상 Amt.
  const VatAmt = Math.round(Amt / 11);
  const TaxAmt = Amt - VatAmt;
  const TaxFreeAmt = 0;

  const firstItem = order.items[0];
  const GoodsName = order.items.length > 1
    ? `${firstItem?.productName ?? "상품"} 외 ${order.items.length - 1}건`
    : firstItem?.productName ?? "상품";

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    new URL(request.url).origin;

  // SspMallId 는 간편결제(SS-Pay) 가맹점 ID. 미설정 시 필드 자체를 생략 — CARD 결제는
  // SspMallId 없이도 동작하는 경우가 많고, 잘못된 값을 보내면 "SspMallId 정보 확인" 알림이 뜸.
  const form: Record<string, string> = {
    PayMethod,
    Mid: smartropayConfig.mid,
    Amt: String(Amt),
    GoodsName,
    GoodsCnt: String(
      order.items.reduce((sum, it) => sum + (it.quantity ?? 1), 0) || 1,
    ),
    // Moid 는 영문/숫자만, MallUserId 는 20자 이하 (스마트로 PG 제약).
    // 주문 매핑은 MallReserved(전체 order.id) 로 하므로 truncate 영향 없음.
    Moid: order.orderNumber.replace(/[^A-Za-z0-9]/g, ""),
    MallUserId: order.userId.slice(0, 20),
    BuyerName: order.shippingName || order.user.name || "구매자",
    BuyerTel: (order.shippingPhone || order.user.phone || "")
      .replace(/[^0-9]/g, "")
      .slice(0, 11),
    BuyerEmail: order.user.email || "",
    ReturnUrl: `${baseUrl}/api/payments/smartropay/result`,
    StopUrl: `${baseUrl}/api/payments/smartropay/result?cancelled=1`,
    EdiDate: ediDate,
    EncryptData,
    MallReserved: order.id,
    // 부가세 합계 (TaxAmt+VatAmt+TaxFreeAmt == Amt) — 미전송 시 1614 합계오류
    TaxAmt: String(TaxAmt),
    VatAmt: String(VatAmt),
    TaxFreeAmt: String(TaxFreeAmt),
    // 결제창을 팝업이 아닌 현재 창에서 전체 전환으로 띄우므로 N.
    PopCheck: "N",
  };
  if (smartropayConfig.sspMallId) {
    form.SspMallId = smartropayConfig.sspMallId;
  }

  return NextResponse.json({
    jsUrl: smartropayConfig.jsUrl,
    mode: smartropayConfig.mode,
    isProduction: smartropayConfig.isProduction,
    form,
  });
}
