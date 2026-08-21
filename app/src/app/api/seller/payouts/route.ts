import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSellerSettlementSummary, getPlatformFees } from "@/lib/settlement";
import { getPayoutFeeRate } from "@/lib/settings";
import { calcPayoutBreakdown } from "@/lib/payout";

// GET: 셀러 정산 요약 + 출금요청 내역 + 출금 수수료율/사업자 여부 조회
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, commissionRate: true, businessType: true, isBusinessOperator: true },
  });
  if (!seller) {
    return NextResponse.json({ error: "라이브 셀러 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  const [fees, payoutFeeRate] = await Promise.all([getPlatformFees(), getPayoutFeeRate()]);
  const summary = await getSellerSettlementSummary(seller.id, fees);
  return NextResponse.json({
    summary,
    payoutFeeRate,
    isBusinessOperator: seller.isBusinessOperator || seller.businessType === "business",
  });
}

// POST: 출금 요청 생성 (실제 송금 없이 요청 레코드만 생성)
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  try {
    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, commissionRate: true, businessType: true, isBusinessOperator: true },
    });
    if (!seller) {
      return NextResponse.json({ error: "라이브 셀러 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    const body = await request.json();
    const {
      bizNumber,
      companyName,
      bankName,
      accountNumber,
      accountHolder,
      agreedDisclaimer,
      amount: requestedAmountRaw,
    } = body ?? {};
    // 사업자 여부는 반드시 셀러 프로필에서만 도출한다. 클라이언트가 보낸 isBusiness 를
    // 신뢰하면 비사업자 셀러가 "사업자"로 신청해 원천징수 3.3%를 건너뛸 수 있고,
    // 그 세금은 플랫폼이 대신 부담하게 된다. (docs/SETTLEMENT_ISSUES.md #9)
    const requestedAsBusiness = seller.isBusinessOperator || seller.businessType === "business";

    // 필수값 검증
    if (!bankName || !accountNumber || !accountHolder || !bizNumber) {
      return NextResponse.json({ error: "입금 계좌/사업자 정보를 모두 입력하세요." }, { status: 400 });
    }
    if (requestedAsBusiness && !companyName) {
      return NextResponse.json({ error: "사업자 라이브 셀러는 상호명을 입력하세요." }, { status: 400 });
    }
    if (!requestedAsBusiness && !agreedDisclaimer) {
      return NextResponse.json({ error: "개인 라이브 셀러 원천징수 안내에 동의해야 합니다." }, { status: 400 });
    }

    // 서버에서 실제 출금 가능 금액을 다시 계산 (클라이언트 값 신뢰하지 않음)
    const fees = await getPlatformFees();
    const summary = await getSellerSettlementSummary(seller.id, fees);
    const maxAmount = summary.withdrawableAmount;

    if (maxAmount <= 0) {
      return NextResponse.json({ error: "출금 가능한 정산 금액이 없습니다." }, { status: 400 });
    }

    // 사용자가 입력한 출금 금액(일부 출금). 미입력/비정상 값이면 전액으로 처리(하위호환).
    const requestedAmount = Math.floor(Number(requestedAmountRaw));
    const amount =
      Number.isFinite(requestedAmount) && requestedAmount > 0 ? requestedAmount : maxAmount;

    if (amount > maxAmount) {
      return NextResponse.json({ error: "출금 가능 금액을 초과했습니다." }, { status: 400 });
    }

    // 수수료율(최고관리자 설정, 없으면 0) 및 출금 요청의 사업자/개인 선택 기준으로
    // 수수료 차감액 / 원천징수액(개인만 3.3%) / 실제 입금액을 계산해 저장한다.
    const payoutFeeRate = await getPayoutFeeRate();
    const { commissionAmount, withholdingTaxAmount, actualPayoutAmount } = calcPayoutBreakdown(
      amount,
      payoutFeeRate,
      requestedAsBusiness,
    );
    const netAmount = actualPayoutAmount;
    const availableOrderCount = summary.orders.filter((o) => o.available).length;

    // 트랜잭션 + 셀러 행 잠금(FOR UPDATE)으로 동시 출금 신청을 직렬화하고,
    // 잠금 이후 미반려 출금 합계를 다시 조회해 가용 금액을 재검증한다.
    // (잠금 없이는 두 요청이 동일한 잔액을 보고 둘 다 통과할 수 있음 — docs/SETTLEMENT_ISSUES.md #1)
    const EXCEEDS = "PAYOUT_EXCEEDS_AVAILABLE";
    let payout;
    try {
      payout = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM seller_profiles WHERE id = ${seller.id} FOR UPDATE`;

        const activePayouts = await tx.payoutRequest.findMany({
          where: { sellerId: seller.id, status: { in: ["REQUESTED", "APPROVED", "PAID"] } },
          select: { amount: true },
        });
        const reserved = activePayouts.reduce((sum, p) => sum + Number(p.amount), 0);
        if (amount > Math.max(0, summary.availableTotal - reserved)) {
          throw new Error(EXCEEDS);
        }

        const created = await tx.payoutRequest.create({
          data: {
            sellerId: seller.id,
            amount,
            netAmount,
            orderCount: availableOrderCount,
            commissionRate: payoutFeeRate,
            commissionAmount,
            withholdingTaxAmount,
            actualPayoutAmount,
            status: "REQUESTED",
            isBusiness: requestedAsBusiness,
            // 비사업자 주민등록번호는 저장하지 않음(원천징수 안내용으로만 사용 → 즉시 폐기). 사업자번호만 보관.
            bizNumber: requestedAsBusiness ? (bizNumber || null) : null,
            companyName: requestedAsBusiness ? (companyName || null) : null,
            bankName: bankName || null,
            accountNumber: accountNumber || null,
            accountHolder: accountHolder || null,
          },
        });

        // 출금-주문 스냅샷 기록 (docs/SETTLEMENT_ISSUES.md #3)
        // 신청 금액을 정산일이 빠른 주문부터 FIFO 배분한다. 기존 미반려 출금이
        // 이미 배분한 몫(allocatedAmount)을 제외한 잔여분에만 배분해,
        // 주문별로 어떤 출금에 얼마가 포함됐는지 추적 가능하게 남긴다.
        const prevAllocs = await tx.payoutRequestOrder.findMany({
          where: {
            payoutRequest: {
              sellerId: seller.id,
              status: { in: ["REQUESTED", "APPROVED", "PAID"] },
            },
          },
          select: { orderId: true, allocatedAmount: true },
        });
        const allocByOrder = new Map<string, number>();
        for (const a of prevAllocs) {
          allocByOrder.set(a.orderId, (allocByOrder.get(a.orderId) ?? 0) + Number(a.allocatedAmount));
        }

        const fifoOrders = summary.orders
          .filter((o) => o.available && o.settlementAmount > 0)
          .sort(
            (a, b) => new Date(a.settlementDate).getTime() - new Date(b.settlementDate).getTime(),
          );
        let remaining = amount;
        const snapshots: {
          payoutRequestId: string;
          orderId: string;
          orderNumber: string;
          settlementAmount: number;
          allocatedAmount: number;
        }[] = [];
        for (const o of fifoOrders) {
          if (remaining <= 0) break;
          const capacity = Math.max(0, o.settlementAmount - (allocByOrder.get(o.orderId) ?? 0));
          if (capacity <= 0) continue;
          const take = Math.min(capacity, remaining);
          remaining -= take;
          snapshots.push({
            payoutRequestId: created.id,
            orderId: o.orderId,
            orderNumber: o.orderNumber,
            settlementAmount: o.settlementAmount,
            allocatedAmount: take,
          });
        }
        if (snapshots.length > 0) {
          await tx.payoutRequestOrder.createMany({ data: snapshots });
        }

        return created;
      });
    } catch (e) {
      if (e instanceof Error && e.message === EXCEEDS) {
        return NextResponse.json({ error: "출금 가능 금액을 초과했습니다." }, { status: 400 });
      }
      throw e;
    }

    return NextResponse.json({
      success: true,
      payout: {
        id: payout.id,
        amount,
        netAmount,
        commissionRate: payoutFeeRate,
        commissionAmount,
        withholdingTaxAmount,
        actualPayoutAmount,
      },
    });
  } catch (error) {
    console.error("Payout request error:", error);
    return NextResponse.json({ error: "출금 요청에 실패했습니다." }, { status: 500 });
  }
}
