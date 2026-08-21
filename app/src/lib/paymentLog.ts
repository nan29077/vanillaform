import { prisma } from "@/lib/prisma";

// PaymentLog 통합 기록 헬퍼.
// 모든 결제 endpoint(prepare/result/callback/cancel) 에서 호출.
// 실패 시 자체적으로 swallow — 결제 본 플로우를 막지 않는다.
//
// 사용 시점:
// - prepare: 주문 검증 실패, PG 호출 직전 (info)
// - launch: 결제창 호출 실패
// - result/callback: PG 응답 수신, 승인 결과, 검증 실패, 매핑 실패
// - cancel: 취소 요청, 응답

export type PaymentProvider = "seedpay" | "smartropay" | "ongi";
export type PaymentStage =
  | "prepare"
  | "launch"
  | "result"
  | "callback"
  | "approval"
  | "cancel";
export type PaymentLogStatus = "info" | "success" | "warn" | "fail";

export interface PaymentLogInput {
  orderId?: string | null;
  provider: PaymentProvider;
  stage: PaymentStage;
  status: PaymentLogStatus;
  message: string;
  payload?: unknown;
  pgTid?: string | null;
}

// payload 는 LongText 지만 과도하게 큰 값은 잘라낸다 (재시도/공격 방어).
const MESSAGE_MAX = 5000;
const PAYLOAD_MAX = 60000;

function safeJson(v: unknown): string | null {
  if (v == null) return null;
  try {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return s.length > PAYLOAD_MAX ? s.slice(0, PAYLOAD_MAX) + "…[truncated]" : s;
  } catch {
    return "[unserializable]";
  }
}

export async function logPayment(input: PaymentLogInput): Promise<void> {
  try {
    // Prisma client 재생성 전에는 paymentLog 타입이 없을 수 있어 any 캐스팅.
    await (prisma as any).paymentLog.create({
      data: {
        orderId: input.orderId ?? null,
        provider: input.provider,
        stage: input.stage,
        status: input.status,
        message: input.message.slice(0, MESSAGE_MAX),
        payload: safeJson(input.payload),
        pgTid: input.pgTid ?? null,
      },
    });
  } catch (e) {
    // 로깅 실패는 결제 플로우를 막지 않는다.
    console.error("[paymentLog] DB write failed", e, {
      provider: input.provider,
      stage: input.stage,
      status: input.status,
      message: input.message.slice(0, 200),
    });
  }
}
