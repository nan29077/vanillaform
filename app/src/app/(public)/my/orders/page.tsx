import { Icon } from "@/components/shared/Icon";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getShopAwareLoginPath } from "@/lib/shopLoginRedirect";
import { formatPrice } from "@/lib/utils";
import {} from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: "결제대기", color: "bg-gray-100 text-gray-600" },
  PAID: { label: "결제완료", color: "bg-blue-50 text-blue-600" },
  CONFIRMED: { label: "확인됨", color: "bg-indigo-50 text-indigo-600" },
  SHIPPING: { label: "배송중", color: "bg-cyan-50 text-cyan-600" },
  DELIVERED: { label: "배송완료", color: "bg-green-50 text-green-600" },
  CANCELLED: { label: "취소됨", color: "bg-red-50 text-red-600" },
  REFUND_REQUESTED: {
    label: "환불요청",
    color: "bg-orange-50 text-orange-600",
  },
  REFUNDED: { label: "환불완료", color: "bg-gray-100 text-gray-500" },
};

const DELIVERY_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PAYMENT_COMPLETED: { label: "결제 완료", color: "bg-blue-50 text-blue-600" },
  PREPARING: { label: "배송 준비 중", color: "bg-yellow-50 text-yellow-600" },
  SHIPPED: { label: "발송 완료", color: "bg-orange-50 text-orange-600" },
  DELIVERING: { label: "배송 중", color: "bg-purple-50 text-purple-600" },
  DELIVERED: { label: "배송 완료", color: "bg-green-50 text-green-700" },
  CANCEL_REQUESTED: {
    label: "결제취소 요청중",
    color: "bg-amber-50 text-amber-700",
  },
  CANCEL_COMPLETED: {
    label: "결제취소 완료",
    color: "bg-gray-100 text-gray-500",
  },
};

// 주문내역은 역할과 무관하게 모든 로그인 사용자가 본인 구매 내역을 볼 수 있어야 함
export default async function MyOrdersPage() {
  const session = await auth();
  if (!session?.user) redirect(getShopAwareLoginPath());

  const orders = await prisma.order.findMany({
    where: { userId: session.user!.id },
    include: {
      seller: true,
      items: {
        include: { variant: true },
      },
      campaign: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="animate-fade-in pb-4">
      <div className="sticky top-12 z-30 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/my" className="text-gray-500 hover:text-gray-900">
            <Icon
              name="ArrowRight"
              size={20}
              strokeWidth={1.5}
              className="rotate-180"
            />
          </Link>
          <h1 className="text-base font-bold text-gray-900">주문 내역</h1>
        </div>
      </div>

      <div className="px-4 pt-4">
        {orders.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Icon
              name="Package"
              size={48}
              strokeWidth={1.5}
              className="mx-auto mb-3 opacity-30"
            />
            <p className="text-sm">주문 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const isCancelledOrRefunded = [
                "CANCELLED",
                "REFUNDED",
                "REFUND_REQUESTED",
              ].includes(order.status);
              const status = STATUS_MAP[order.status] || {
                label: order.status,
                color: "bg-gray-100 text-gray-600",
              };
              // 미결제 주문은 deliveryStatus 를 신뢰하지 않는다.
              // (기본값이 PAYMENT_COMPLETED 였던 과거 주문이 남아 있어, 결제 안 한 주문이
              //  "결제 완료"로 표시되던 버그가 있었다. 실제 결제된 주문만 배송 상태를 배지로 쓴다.)
              const isPaid = order.paymentStatus === "COMPLETED";
              const ds = isPaid
                ? ((order as any).deliveryStatus as string | null | undefined)
                : null;
              // CANCEL_REQUESTED / CANCEL_COMPLETED는 취소 상태에서도 표시
              const isCancelDelivery =
                ds === "CANCEL_REQUESTED" || ds === "CANCEL_COMPLETED";
              const badge =
                (isCancelDelivery || !isCancelledOrRefunded) &&
                ds &&
                DELIVERY_STATUS_MAP[ds]
                  ? DELIVERY_STATUS_MAP[ds]
                  : status;
              return (
                <Link
                  key={order.id}
                  href={`/my/orders/${order.id}`}
                  className="block bg-white rounded-xl border border-gray-100 overflow-hidden active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="min-w-0 flex-1 pr-2">
                      {/* 상품명을 크게 강조, 주문번호·날짜는 작게 */}
                      <p className="text-[14px] font-bold text-gray-900 truncate">
                        {order.items[0]?.productName || "주문 상품"}
                        {order.items.length > 1 && (
                          <span className="text-[11px] font-normal text-gray-400">
                            {" "}
                            외 {order.items.length - 1}건
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(order.createdAt).toLocaleDateString("ko-KR")}{" "}
                        · 주문 {order.orderNumber}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-2 py-1 rounded-full flex-shrink-0 ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="text-[11px] text-gray-400 mb-2">
                      {order.seller.shopName}
                    </p>
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-800 truncate">
                            {item.productName}
                          </p>
                          {item.variantName && (
                            <p className="text-[11px] text-gray-400 truncate">
                              {item.variantName}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-medium">
                            {formatPrice(Number(item.totalPrice))}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {item.quantity}개
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
