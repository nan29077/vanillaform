import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getShopAwareLoginPath } from "@/lib/shopLoginRedirect";
import CheckoutCompleteClient from "./CheckoutCompleteClient";

export const dynamic = "force-dynamic";

export default async function CheckoutCompletePage({
  searchParams,
}: {
  searchParams: { orderId?: string; status?: string; msg?: string };
}) {
  const session = await auth();
  if (!session) redirect(getShopAwareLoginPath());

  const { orderId, status, msg } = searchParams;
  if (!orderId) redirect("/");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      finalAmount: true,
      discountAmount: true,
      paymentStatus: true,
      userId: true,
      pgTid: true,
    },
  });

  if (!order || order.userId !== session.user!.id) redirect("/");

  // 상태가 PENDING 이면 client 가 폴링하여 ONGI 등 비동기 콜백 결과를 기다린다.
  return (
    <CheckoutCompleteClient
      initialOrder={{
        id: order.id,
        orderNumber: order.orderNumber,
        finalAmount: Number(order.finalAmount),
        discountAmount: Number(order.discountAmount),
        paymentStatus: order.paymentStatus,
        pgTid: order.pgTid,
      }}
      initialStatusQuery={status ?? null}
      initialMsg={msg ?? null}
    />
  );
}
