"use client";

import { Icon } from '@/components/shared/Icon';
import { useEffect, useState } from "react";
import Link from "next/link";
import {Loader2} from 'lucide-react';

interface InitialOrder {
  id: string;
  orderNumber: string;
  finalAmount: number;
  discountAmount: number;
  paymentStatus: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
  pgTid: string | null;
}

interface Props {
  initialOrder: InitialOrder;
  initialStatusQuery: string | null;
  initialMsg: string | null;
}

const formatPrice = (n: number) => n.toLocaleString("ko-KR") + "원";

// ONGI 등 비동기 콜백 PG 는 사용자 redirect 가 서버 콜백보다 빨리 도착하므로
// PENDING 상태로 페이지가 열릴 수 있다. 최대 30초 동안 2초 간격으로 폴링.
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_MS = 30000;

export default function CheckoutCompleteClient({
  initialOrder,
  initialStatusQuery,
  initialMsg,
}: Props) {
  const [order, setOrder] = useState(initialOrder);
  const [polling, setPolling] = useState(
    initialStatusQuery !== "fail" && initialOrder.paymentStatus === "PENDING",
  );
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!polling) return;
    let stopped = false;
    const startedAt = Date.now();

    const tick = async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/api/orders/${initialOrder.id}/status`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.paymentStatus && data.paymentStatus !== "PENDING") {
            setOrder((prev) => ({
              ...prev,
              paymentStatus: data.paymentStatus,
              pgTid: data.pgTid ?? prev.pgTid,
            }));
            setPolling(false);
            return;
          }
        }
      } catch {
        // ignore — 다음 tick 에서 재시도
      }

      if (Date.now() - startedAt >= POLL_MAX_MS) {
        setTimedOut(true);
        setPolling(false);
        return;
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    };

    setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
    };
  }, [polling, initialOrder.id]);

  const isFailQuery = initialStatusQuery === "fail";
  const isSuccess = !isFailQuery && order.paymentStatus === "COMPLETED";
  const isPending = polling;

  return (
    <div className="text-center py-16 px-4">
      {isPending ? (
        <>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-50 flex items-center justify-center">
            <Loader2 size={32} strokeWidth={1.5} className="text-gray-500 animate-spin" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">결제 결과를 확인하고 있습니다</h2>
          <p className="text-sm text-gray-500 mb-1">주문번호: {order.orderNumber}</p>
          <p className="text-xs text-gray-400 mb-4">잠시만 기다려 주세요. 자동으로 갱신됩니다.</p>
        </>
      ) : timedOut && order.paymentStatus === "PENDING" ? (
        <>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-50 flex items-center justify-center">
            <Loader2 size={32} strokeWidth={1.5} className="text-yellow-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">결제 결과 확인이 지연되고 있습니다</h2>
          <p className="text-sm text-gray-500 mb-1">주문번호: {order.orderNumber}</p>
          <p className="text-xs text-gray-500 mb-4">
            결제는 정상 처리되었을 수 있습니다. 잠시 후 주문 내역에서 확인해주세요.
          </p>
        </>
      ) : isSuccess ? (
        <>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
            <Icon name="Check" size={32} strokeWidth={1.5} className="text-green-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">결제가 완료되었습니다!</h2>
          <p className="text-sm text-gray-500 mb-1">주문번호: {order.orderNumber}</p>
          <p className="text-sm text-gray-700 mb-1">결제금액: {formatPrice(Number(order.finalAmount))}</p>
          {order.pgTid && (
            <p className="text-[11px] text-gray-400 mb-4">거래 ID: {order.pgTid}</p>
          )}
          {Number(order.discountAmount) > 0 && (
            <p className="text-xs text-brand-600 mb-4">
              할인 혜택 {formatPrice(Number(order.discountAmount))}이 적용되었습니다!
            </p>
          )}
        </>
      ) : (
        <>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <Icon name="Close" size={32} strokeWidth={1.5} className="text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">결제에 실패했습니다</h2>
          <p className="text-sm text-gray-500 mb-1">주문번호: {order.orderNumber}</p>
          {initialMsg && <p className="text-xs text-gray-500 mb-4">{initialMsg}</p>}
        </>
      )}

      <div className="flex flex-col gap-2 max-w-xs mx-auto mt-4">
        <Link href="/my/orders" className="btn-primary w-full py-3 text-center">
          주문 내역 보기
        </Link>
        <Link href="/" className="btn-outline w-full py-3 text-center">
          쇼핑 계속하기
        </Link>
      </div>
    </div>
  );
}
