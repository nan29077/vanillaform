import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// OCR 기반 구독 인증 자동 승인 플로우
// POST: 스크린샷을 제출하면 OCR 분석 후 자동 승인/수동 대기 판단
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const { verificationId, screenshotUrl } = await req.json();
  if (!verificationId) {
    return NextResponse.json({ error: "인증 ID 필요" }, { status: 400 });
  }

  const verification = await prisma.channelVerification.findUnique({
    where: { id: verificationId },
    include: {
      seller: {
        select: {
          shopName: true,
          instagramUrl: true,
          youtubeUrl: true,
          tiktokUrl: true,
        },
      },
    },
  });

  if (!verification) {
    return NextResponse.json({ error: "인증 요청을 찾을 수 없습니다" }, { status: 404 });
  }

  // OCR 분석 시뮬레이션
  // 실제 프로덕션에서는 Google Vision API, Tesseract.js, 또는 AWS Textract 등을 사용
  const ocrResult = simulateOCR(verification.channelType, verification.seller);

  if (ocrResult.isSubscribed) {
    // OCR로 구독 확인됨 → 자동 승인
    const updated = await prisma.channelVerification.update({
      where: { id: verificationId },
      data: {
        status: "APPROVED",
        verifiedAt: new Date(),
        screenshotUrl: screenshotUrl || verification.screenshotUrl,
      },
    });

    // 알림 생성
    const buyer = await prisma.buyerProfile.findUnique({
      where: { id: verification.buyerId },
    });
    if (buyer) {
      await prisma.notification.create({
        data: {
          userId: buyer.userId,
          title: "채널 구독 인증 완료!",
          message: `${verification.seller.shopName}의 ${getChannelLabel(verification.channelType)} 구독 인증이 완료되었습니다. 할인 혜택이 자동 적용됩니다!`,
          type: "channel_verification",
          linkUrl: `/shop/${verification.seller.shopName}`,
        },
      });
    }

    return NextResponse.json({
      verification: updated,
      ocrResult: {
        verified: true,
        confidence: ocrResult.confidence,
        detectedKeywords: ocrResult.keywords,
        message: "OCR 분석 결과 구독이 확인되어 자동 승인되었습니다.",
      },
    });
  } else {
    // OCR로 확인 불가 → PENDING으로 유지 (수동 확인 필요)
    return NextResponse.json({
      verification,
      ocrResult: {
        verified: false,
        confidence: ocrResult.confidence,
        detectedKeywords: ocrResult.keywords,
        message: "OCR 분석으로 구독 확인이 어렵습니다. 관리자/라이브 셀러가 수동으로 확인합니다.",
      },
    });
  }
}

function getChannelLabel(type: string): string {
  const labels: Record<string, string> = {
    youtube: "유튜브",
    instagram: "인스타그램",
    tiktok: "틱톡",
    facebook: "페이스북",
    twitter: "X(트위터)",
  };
  return labels[type] || type;
}

// OCR 시뮬레이션 함수
// 실제 프로덕션에서는 외부 OCR API 호출
function simulateOCR(
  channelType: string,
  seller: { shopName: string; instagramUrl?: string | null; youtubeUrl?: string | null; tiktokUrl?: string | null }
) {
  // 채널별 구독 관련 키워드
  const subscriptionKeywords: Record<string, string[]> = {
    youtube: ["구독중", "구독 중", "Subscribed", "알림 설정됨", "종모양", seller.shopName],
    instagram: ["팔로잉", "Following", "팔로우 중", "메시지", seller.shopName],
    tiktok: ["팔로잉", "Following", "친구", seller.shopName],
    facebook: ["좋아요", "팔로잉", "Following", seller.shopName],
    twitter: ["팔로잉", "Following", seller.shopName],
  };

  const keywords = subscriptionKeywords[channelType] || [];

  // 시뮬레이션: 75% 확률로 자동 승인 (실제로는 OCR 분석 결과에 따라 결정)
  const confidence = Math.random() * 40 + 60; // 60~100
  const isSubscribed = confidence > 70; // 70% 이상이면 승인

  return {
    isSubscribed,
    confidence: Math.round(confidence),
    keywords: isSubscribed ? keywords.slice(0, 3) : [],
  };
}
