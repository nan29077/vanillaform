import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSellerSettlementSummary, getPlatformFees } from "@/lib/settlement";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// 상태 전이 규칙 — 허용된 현재 상태에서만 각 액션 실행 가능.
// 특히 PAID(지급완료) 건은 어떤 상태로도 되돌릴 수 없다.
// (PAID→REJECTED 를 허용하면 이미 송금된 금액이 출금 가능 금액으로 되살아난다 — docs/SETTLEMENT_ISSUES.md #2)
const ALLOWED_FROM: Record<string, string[]> = {
  approve: ["REQUESTED"],
  pay: ["REQUESTED", "APPROVED"],
  reject: ["REQUESTED", "APPROVED"],
};

// 최고관리자: 셀러 출금요청 처리 (승인 / 지급완료 / 반려)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { payoutId, action, note } = body ?? {};
  if (!payoutId || !["approve", "pay", "reject"].includes(action)) {
    return NextResponse.json({ error: "요청이 올바르지 않습니다." }, { status: 400 });
  }

  // 반려 사유는 필수 — 셀러가 왜 반려됐는지 알 수 없으면 재신청 자체가 불가능하다.
  const rejectReason = typeof note === "string" ? note.trim().slice(0, 500) : "";
  if (action === "reject" && !rejectReason) {
    return NextResponse.json({ error: "반려 사유를 입력해 주세요." }, { status: 400 });
  }

  const payout = await prisma.payoutRequest.findUnique({ where: { id: payoutId } });
  if (!payout) return NextResponse.json({ error: "출금요청을 찾을 수 없습니다." }, { status: 404 });

  const allowedFrom = ALLOWED_FROM[action];
  if (!allowedFrom.includes(payout.status)) {
    return NextResponse.json(
      { error: `현재 상태(${payout.status})에서는 처리할 수 없습니다.` },
      { status: 409 },
    );
  }

  // 지급 직전 가용 잔액 재검증 — 출금 신청 이후 주문 취소/환불로 정산액이
  // 줄었을 수 있으므로, 이 출금을 지급해도 잔액이 음수가 되지 않는지 확인한다.
  if (action === "pay") {
    const fees = await getPlatformFees();
    const summary = await getSellerSettlementSummary(payout.sellerId, fees);
    // 이 출금 건 자체는 진행중(inProgress)에 포함되어 있으므로 제외하고 계산
    const otherInProgress = Math.max(0, summary.inProgressAmount - Number(payout.amount));
    const remaining = summary.availableTotal - summary.reservedAmount - otherInProgress;
    if (Number(payout.amount) > remaining) {
      return NextResponse.json(
        {
          error: `지급 시 가용 잔액이 부족합니다. (출금액 ${Number(payout.amount).toLocaleString()}원 > 잔액 ${Math.max(0, remaining).toLocaleString()}원 — 신청 후 주문 취소 등으로 정산액이 감소했을 수 있습니다.)`,
        },
        { status: 409 },
      );
    }
  }

  const data: any = { processedAt: new Date() };
  if (action === "approve") data.status = "APPROVED";
  else if (action === "pay") data.status = "PAID";
  else if (action === "reject") {
    data.status = "REJECTED";
    data.note = rejectReason;
  }

  // 상태 조건부 갱신(compare-and-swap) — 동시 클릭/중복 요청이 와도
  // 허용된 현재 상태일 때만 전이되고, 아니면 0건 갱신으로 감지한다.
  const result = await prisma.payoutRequest.updateMany({
    where: { id: payoutId, status: { in: allowedFrom as any } },
    data,
  });
  if (result.count === 0) {
    return NextResponse.json(
      { error: "이미 다른 요청에서 처리된 출금건입니다. 새로고침 후 확인하세요." },
      { status: 409 },
    );
  }

  // 반려 시 셀러에게 알림 — 반려 사실과 사유를 즉시 전달한다(알림 실패는 처리 결과에 영향 없음).
  if (action === "reject") {
    const seller = await prisma.sellerProfile.findUnique({
      where: { id: payout.sellerId },
      select: { userId: true },
    });
    if (seller) {
      await createNotification({
        userId: seller.userId,
        title: "출금 요청이 반려되었습니다",
        message: `${Number(payout.amount).toLocaleString("ko-KR")}원 출금 요청이 반려되었습니다.\n사유: ${rejectReason}\n반려된 금액은 다시 출금 가능 금액에 포함됩니다.`,
        type: "payout_rejected",
        linkUrl: "/seller/settlements",
      });
    }
  }

  return NextResponse.json({ success: true, status: data.status });
}
