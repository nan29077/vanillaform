import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/aligo";
import { sendTemplatedAlimtalk, type TemplatedSendResult } from "@/lib/alimtalkEngine";

// 주소 문자열에서 구/면, 동/리 수준 행정구역만 추출 (주문접수 알림용 — 전체 주소 노출 방지)
function parseAddressDistrict(address: string | null | undefined): { gu: string; dong: string } {
  const tokens = (address || "").split(/\s+/).filter(Boolean);
  const gu = tokens.find((t) => /(구|군|면)$/.test(t)) || tokens[1] || "";
  const dong = tokens.find((t) => /(동|리|읍|가)\d*$/.test(t) || /(로|길)\d*$/.test(t)) || tokens[2] || "";
  return { gu: gu || "-", dong: dong || "-" };
}

/** 결제 완료 시 해당 샵 셀러에게 주문 접수 알림톡 발송. 실패해도 결제 흐름에 영향 없음. */
export async function notifyOrderPlacedToSeller(orderId: string): Promise<TemplatedSendResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true,
      finalAmount: true,
      shippingName: true,
      shippingAddress: true,
      user: { select: { name: true } },
      seller: { select: { id: true, shopName: true, user: { select: { name: true, phone: true } } } },
    },
  });
  if (!order) return { notified: false, reason: "주문 없음" };

  const phone = normalizePhone(order.seller.user.phone);
  if (!phone) return { notified: false, reason: "셀러 전화번호 없음" };

  const { gu, dong } = parseAddressDistrict(order.shippingAddress);
  return sendTemplatedAlimtalk({
    purpose: "ORDER_PLACED",
    variables: {
      "셀러샵명": order.seller.shopName,
      "주문자명": order.shippingName || order.user.name || "고객",
      "주문번호": order.orderNumber,
      "구/면": gu,
      "동/리": dong,
      "결제금액": Number(order.finalAmount).toLocaleString("ko-KR"),
    },
    recipients: [{ phone, name: order.seller.user.name || "셀러" }],
    sellerId: order.seller.id,
  });
}

/** 운송장 입력 시 구매자에게 배송 시작 안내 알림톡 발송. */
export async function notifyShippingStartToBuyer(orderId: string): Promise<TemplatedSendResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      shippingName: true,
      shippingPhone: true,
      deliveryTracking: true,
      user: { select: { name: true, phone: true } },
      seller: { select: { id: true, shopName: true } },
    },
  });
  if (!order) return { notified: false, reason: "주문 없음" };
  if (!order.deliveryTracking) return { notified: false, reason: "운송장 번호 없음" };

  const phone = normalizePhone(order.shippingPhone || order.user.phone);
  if (!phone) return { notified: false, reason: "구매자 전화번호 없음" };

  // 발송 날짜는 KST 기준
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const dateStr = `${kstNow.getUTCFullYear()}-${String(kstNow.getUTCMonth() + 1).padStart(2, "0")}-${String(kstNow.getUTCDate()).padStart(2, "0")}`;

  return sendTemplatedAlimtalk({
    purpose: "SHIPPING_START",
    variables: {
      "고객명": order.shippingName || order.user.name || "고객",
      "셀러샵명": order.seller.shopName,
      "택배발송 날짜": dateStr,
      "송장번호": order.deliveryTracking,
    },
    recipients: [{ phone, name: order.shippingName || order.user.name || "고객님" }],
    sellerId: order.seller.id,
  });
}

/** 구매자 회원가입 직후 환영 알림톡 발송 (카카오 승인 조건: 가입 즉시 1회). */
export async function notifySignupWelcome(opts: {
  name: string;
  phone: string | null;
  sellerRef?: string | null; // 가입 경로 셀러 slug — 있으면 해당 샵명으로 발송
}): Promise<TemplatedSendResult> {
  const phone = normalizePhone(opts.phone);
  if (!phone) return { notified: false, reason: "전화번호 없음" };

  let shopName = "바닐라폼";
  let sellerId: string | null = null;
  if (opts.sellerRef) {
    const seller = await prisma.sellerProfile.findUnique({
      where: { slug: opts.sellerRef },
      select: { id: true, shopName: true },
    });
    if (seller) {
      shopName = seller.shopName;
      sellerId = seller.id;
    }
  }

  return sendTemplatedAlimtalk({
    purpose: "SIGNUP_WELCOME",
    variables: { "고객명": opts.name || "고객", "셀러샵명": shopName },
    recipients: [{ phone, name: opts.name || "고객님" }],
    sellerId,
  });
}
