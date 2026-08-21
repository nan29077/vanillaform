import { prisma } from "@/lib/prisma";
import { normalizePhone, type AligoRecipient } from "@/lib/aligo";
import { sendTemplatedAlimtalk } from "@/lib/alimtalkEngine";

export interface LiveNotifyResult {
  notified: boolean;
  reason?: string;
  attempted?: number;
  successCount?: number;
  failCount?: number;
}

/**
 * 라이브 방송 시작 시, 해당 셀러를 팔로우한 구매자 전체에게 카카오 알림톡을 발송한다.
 * - 이미 발송된(kakaoNotified) 라이브는 force=false면 건너뛴다.
 * - 템플릿 본문/버튼은 발송 시점에 알리고 등록 원문을 가져와 변수만 치환한다 (alimtalkEngine).
 * - 알리고 미설정/수신자 없음 등은 에러가 아니라 "건너뜀"으로 처리하여 방송 시작을 막지 않는다.
 */
export async function notifyLiveStartToFollowers(
  liveId: string,
  opts: { force?: boolean } = {},
): Promise<LiveNotifyResult> {
  const live = await prisma.liveStream.findUnique({
    where: { id: liveId },
    select: {
      title: true,
      shareCode: true,
      kakaoNotified: true,
      seller: {
        select: {
          id: true,
          shopName: true,
          slug: true,
          followers: {
            // 라이브 알림톡 수신에 동의한 PICK 회원에게만 발송
            where: { buyer: { liveAlimtalkOptIn: true } },
            select: {
              buyer: { select: { user: { select: { name: true, phone: true } } } },
            },
          },
        },
      },
    },
  });

  if (!live) return { notified: false, reason: "라이브를 찾을 수 없습니다." };
  if (!opts.force && live.kakaoNotified) return { notified: false, reason: "이미 발송됨" };

  // 수신자 수집 (전화번호 정규화 + 중복 제거)
  const seen = new Set<string>();
  const recipients: AligoRecipient[] = [];
  for (const f of live.seller.followers) {
    const phone = normalizePhone(f.buyer.user.phone);
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    recipients.push({ phone, name: f.buyer.user.name || "고객님" });
  }

  if (recipients.length === 0) return { notified: false, reason: "발송 대상 없음" };

  const result = await sendTemplatedAlimtalk({
    purpose: "LIVE_START",
    variables: {
      "셀러명": live.seller.shopName,
      "방송제목": live.title,
      shopid: live.seller.slug,
      livecode: live.shareCode,
    },
    recipients,
    sellerId: live.seller.id,
    liveStreamId: liveId,
  });

  // 일부라도 접수됐으면 발송 플래그 설정 (중복 발송 방지)
  if ((result.successCount ?? 0) > 0) {
    await prisma.liveStream.update({ where: { id: liveId }, data: { kakaoNotified: true } });
  }

  return {
    notified: result.notified,
    reason: result.reason,
    attempted: result.attempted,
    successCount: result.successCount,
    failCount: result.failCount,
  };
}
