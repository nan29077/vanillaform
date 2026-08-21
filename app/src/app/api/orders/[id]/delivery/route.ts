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

// PATCH: 배송 상태 업데이트 (SUPER_ADMIN, BRAND_ADMIN, MIDDLE_ADMIN만 가능)
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

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, deliveryTracking: true },
    });

    if (!order) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
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
