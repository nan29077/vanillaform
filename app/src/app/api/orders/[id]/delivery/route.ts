import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyShippingStartToBuyer } from "@/lib/alimtalkTriggers";

export const dynamic = "force-dynamic";

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  PAYMENT_COMPLETED: "결제 완료",
  PREPARING: "상품 준비 중",
  SHIPPED: "배송 준비",
  DELIVERING: "배송 중",
  DELIVERED: "배송 완료",
  CANCELLED: "취소",
  CANCEL_REQUESTED: "결제취소 요청중",
  CANCEL_COMPLETED: "결제취소 완료",
};

type SessionUser = { id: string; role: string; email?: string | null };

/**
 * 이 주문에 접근할 권한이 있는지 검사한다.
 *
 * orderId 만 바꾸면 남의 주문 배송 상태를 읽고 바꿀 수 있던 IDOR 를 막는다.
 * 같은 폴더의 cancel-request / cancel-approve 라우트와 동일한 소유권 판정 규칙을 쓴다.
 *
 *  - SUPER_ADMIN  : 전체 허용(소유권 검사 면제)
 *  - SELLER       : 주문의 sellerId 가 본인 SellerProfile 인 경우
 *  - BRAND_ADMIN  : 주문 항목 중 자사 브랜드 상품이 하나라도 있는 경우
 *  - MIDDLE_ADMIN : 소속 셀러의 주문이거나, 소속 브랜드 상품이 포함된 주문
 *  - BUYER        : 본인이 결제한 주문(조회 전용 — 변경은 아래 allowedRoles 에서 이미 차단)
 */
async function canAccessOrder(
  user: SessionUser,
  order: { userId: string; sellerId: string; items: { productId: string }[] },
): Promise<boolean> {
  const role = user.role;
  if (role === "SUPER_ADMIN") return true;

  const productIds = order.items.map((i) => i.productId);

  if (role === "SELLER") {
    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    return !!seller && seller.id === order.sellerId;
  }

  if (role === "BRAND_ADMIN") {
    const brand = await prisma.brandProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!brand || productIds.length === 0) return false;
    const hit = await prisma.product.findFirst({
      where: { id: { in: productIds }, brandId: brand.id },
      select: { id: true },
    });
    return !!hit;
  }

  if (role === "MIDDLE_ADMIN") {
    const middle = await prisma.middleAdminProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, sellers: { select: { id: true } }, brands: { select: { id: true } } },
    });
    if (!middle) return false;
    if (middle.sellers.some((s) => s.id === order.sellerId)) return true;
    const brandIds = middle.brands.map((b) => b.id);
    if (!brandIds.length || !productIds.length) return false;
    const hit = await prisma.product.findFirst({
      where: { id: { in: productIds }, brandId: { in: brandIds } },
      select: { id: true },
    });
    return !!hit;
  }

  if (role === "BUYER") return order.userId === user.id;

  return false;
}

/** 소유권 검사에 필요한 최소 필드만 조회 */
function loadOrderForAccess(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      sellerId: true,
      deliveryTracking: true,
      items: { select: { productId: true } },
    },
  });
}

// GET: 배송 상태 조회
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const orderId = resolvedParams.id;

    const owner = await loadOrderForAccess(orderId);
    if (!owner) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }
    if (!(await canAccessOrder(session.user as SessionUser, owner))) {
      return NextResponse.json({ error: "이 주문을 조회할 권한이 없습니다." }, { status: 403 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        deliveryStatus: true,
        deliveryTracking: true,
        deliveryCourier: true,
        deliveryUpdatedAt: true,
        deliveryUpdatedBy: true,
      } as any,
    });

    if (!order) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ delivery: order });
  } catch (e: any) {
    console.error("[delivery GET]", e?.message || e);
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 500 });
  }
}

// PATCH: 배송 상태 업데이트 (SUPER_ADMIN, BRAND_ADMIN, MIDDLE_ADMIN, SELLER — 각자 소유 주문만)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const role = (session.user as any).role as string;
    const allowedRoles = ["SUPER_ADMIN", "BRAND_ADMIN", "MIDDLE_ADMIN", "SELLER"];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: "배송 상태를 변경할 권한이 없습니다." }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(params);
    const orderId = resolvedParams.id;

    const body = await request.json();
    const { deliveryStatus, deliveryCourier, deliveryTracking } = body;

    if (deliveryStatus && !DELIVERY_STATUS_LABELS[deliveryStatus]) {
      return NextResponse.json({ error: "올바르지 않은 배송 상태입니다." }, { status: 400 });
    }

    const order = await loadOrderForAccess(orderId);

    if (!order) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }
    if (!(await canAccessOrder(session.user as SessionUser, order))) {
      return NextResponse.json({ error: "이 주문을 변경할 권한이 없습니다." }, { status: 403 });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        ...(deliveryStatus !== undefined && { deliveryStatus } as any),
        ...(deliveryCourier !== undefined && { deliveryCourier: deliveryCourier || null } as any),
        ...(deliveryTracking !== undefined && { deliveryTracking: deliveryTracking || null } as any),
        ...({ deliveryUpdatedAt: new Date(), deliveryUpdatedBy: session.user.email || "" } as any),
      },
      select: {
        id: true,
        deliveryStatus: true,
        deliveryTracking: true,
        deliveryCourier: true,
        deliveryUpdatedAt: true,
        deliveryUpdatedBy: true,
      } as any,
    });

    // 운송장 번호가 새로 입력/변경되면 구매자에게 배송 시작 알림톡 (실패해도 상태 저장에 영향 없음)
    const newTracking = typeof deliveryTracking === "string" ? deliveryTracking.trim() : "";
    if (newTracking && newTracking !== order.deliveryTracking) {
      await notifyShippingStartToBuyer(orderId).catch((e) =>
        console.error("[delivery] 배송 시작 알림톡 오류:", e),
      );
    }

    return NextResponse.json({ delivery: updated });
  } catch (e: any) {
    console.error("[delivery PATCH]", e?.message || e);
    return NextResponse.json({ error: "배송 상태 업데이트에 실패했습니다." }, { status: 500 });
  }
}
