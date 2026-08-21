/**
 * 결제는 정상 승인(매입)됐으나, SeedPay /result 콜백 중복 호출(resultCd=9999)로
 * 시스템이 CANCELLED/FAILED 로 잘못 덮어쓴 주문을 PAID/COMPLETED 로 복구한다.
 *
 * 원인/근본 수정은 src/app/api/payments/seedpay/result/route.ts 의 멱등성 가드 참고.
 *
 * 사용법:
 *   cd app
 *   npx tsx scripts/restore-miscancelled-orders.ts          # 진단(드라이런) — 변경 없음
 *   npx tsx scripts/restore-miscancelled-orders.ts --apply  # 실제 복구
 *
 * 복구 대상은 아래 3가지를 모두 만족하는 주문만으로 한정한다(안전장치):
 *   1) 현재 status=CANCELLED, paymentStatus=FAILED
 *   2) pgTid 가 존재 (PG에 승인 흔적이 있음)
 *   3) PaymentLog 에 [approval/success] 로그가 존재 (실제 승인 완료 증거)
 * paidAt 은 approval/success 로그 시각으로 복원한다.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 잘못 취소된 것으로 확인된 주문번호 (대조 결과)
const TARGET_ORDER_NUMBERS = ["SB20260629-K1GZXL", "SB20260628-4B93FC"];

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(APPLY ? "=== 복구 실행 모드 (--apply) ===" : "=== 드라이런 (변경 없음) ===");

  for (const orderNumber of TARGET_ORDER_NUMBERS) {
    const order = await prisma.order.findUnique({ where: { orderNumber } });
    if (!order) {
      console.log(`\n[건너뜀] ${orderNumber} — 주문 없음`);
      continue;
    }

    const approval = await prisma.paymentLog.findFirst({
      where: { orderId: order.id, stage: "approval", status: "success" },
      orderBy: { createdAt: "asc" },
    });

    console.log(`\n--- ${orderNumber} (${Number(order.finalAmount)}원) ---`);
    console.log(`  현재: status=${order.status} / paymentStatus=${order.paymentStatus}`);
    console.log(`  pgTid=${order.pgTid ?? "(없음)"}`);
    console.log(`  approval/success 로그=${approval ? approval.createdAt.toISOString() : "(없음)"}`);

    // 안전장치: 조건을 모두 만족해야만 복구
    const eligible =
      order.status === "CANCELLED" &&
      order.paymentStatus === "FAILED" &&
      !!order.pgTid &&
      !!approval;

    if (order.paymentStatus === "COMPLETED") {
      console.log("  → 이미 정상(COMPLETED). 건너뜀.");
      continue;
    }
    if (!eligible) {
      console.log("  → 복구 조건 미충족(승인 흔적 부족). 안전상 건너뜀. 수동 확인 필요.");
      continue;
    }

    if (!APPLY) {
      console.log("  → [드라이런] 복구 예정: status=PAID, paymentStatus=COMPLETED, "
        + `paymentMethod=CARD, pgProvider=seedpay, paidAt=${approval!.createdAt.toISOString()}, cancelledAt=null`);
      continue;
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paymentStatus: "COMPLETED",
        paymentMethod: order.paymentMethod ?? "CARD",
        pgProvider: order.pgProvider ?? "seedpay",
        paidAt: order.paidAt ?? approval!.createdAt,
        cancelledAt: null,
        pgAuthData: approval!.payload ?? order.pgAuthData,
      },
    });
    await prisma.paymentLog.create({
      data: {
        orderId: order.id,
        provider: "seedpay",
        stage: "result",
        status: "info",
        message: "수동 복구: 중복 콜백(9999)으로 잘못 취소된 결제완료 주문을 PAID 로 복원",
        pgTid: order.pgTid,
      },
    });
    console.log("  ✅ 복구 완료 → PAID/COMPLETED");
  }

  console.log("\n완료." + (APPLY ? "" : " (실제 반영하려면 --apply 옵션 추가)"));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
