import { prisma } from "@/lib/prisma";

// 알리고 발송 사유 코드 → 화면 표기용 한글 라벨
export const ALIGO_PURPOSE_LABELS: Record<string, string> = {
  LIVE_START: "라이브 방송시작 알림",
  PASSWORD_RESET: "임시 비밀번호 문자",
};

/**
 * 알리고 실발송 결과를 DB에 기록한다. 기록 실패가 발송 흐름을 막지 않도록 예외를 삼킨다.
 * acceptedCount는 "알리고 접수 성공" 기준이며 실제 전달 성공과는 다르다 (전달 결과는 mid로 사후 조회).
 */
export async function logAligoSend(entry: {
  sellerId?: string | null;
  kind: "ALIMTALK" | "SMS";
  purpose: string;
  templateCode?: string | null;
  recipientCount: number;
  acceptedCount: number;
  failCount?: number;
  cost?: number | null;
  mids?: number[];
  errorMessage?: string | null;
  liveStreamId?: string | null;
}): Promise<void> {
  try {
    await prisma.aligoSendLog.create({
      data: {
        sellerId: entry.sellerId ?? null,
        kind: entry.kind,
        purpose: entry.purpose,
        templateCode: entry.templateCode ?? null,
        recipientCount: entry.recipientCount,
        acceptedCount: entry.acceptedCount,
        failCount: entry.failCount ?? 0,
        cost: entry.cost ?? null,
        aligoMids: entry.mids && entry.mids.length > 0 ? JSON.stringify(entry.mids) : null,
        errorMessage: entry.errorMessage || null,
        liveStreamId: entry.liveStreamId ?? null,
      },
    });
  } catch (e) {
    console.error("[aligoLog] 발송 기록 저장 실패:", e);
  }
}
