// 셀러 추천인(attribution) 쿠키 헬퍼.
//
// 정책 요약:
// - 셀러 페이지(/shop/[slug]) 또는 제품 페이지(/products/[id]?ref=<slug>)
//   진입 시 쿠키에 셀러 slug 저장.
// - 회원가입(/auth/register) 진입 시 URL의 ref/code 가 우선, 없으면 쿠키 fallback.
// - 만료: 7일, last-click (덮어쓰기).
// - 쿠키는 httpOnly 이며, 클라이언트는 /api/seller/lookup 을 통해 서버에서 값을 읽는다.

import type { PrismaClient } from "@/generated/prisma";
import { syncSellerFanCount } from "@/lib/sellerFans";

export const SELLER_REF_COOKIE = "sb_ref";
export const SELLER_REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7일

export const SELLER_REF_COOKIE_OPTIONS = {
  maxAge: SELLER_REF_COOKIE_MAX_AGE,
  path: "/",
  sameSite: "lax" as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};

/**
 * 셀러 slug 정합성 검사.
 * SellerProfile.slug 는 가입 시 a-z0-9- 패턴으로 생성됨.
 */
export function isValidSellerSlug(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > 64) return false;
  return /^[a-z0-9][a-z0-9-_]*$/i.test(value);
}

/**
 * 신규 구매회원 가입 시 추천인(셀러) 귀속을 처리하는 공통 헬퍼.
 *
 * 호출 측이 후보값 (sellerRef = slug 또는 referralCode) 을 모아 전달하면
 * - 우선순위: referralCode → sellerRef
 * - 미승인 셀러는 매핑하지 않음
 * - BuyerProfile 의 referredBySellerId / primarySellerId / referralCode 채움
 * - 매핑 성공 시 SellerProfile.totalFans 재집계(syncSellerFanCount)
 *
 * 일반 회원가입 API 와 OAuth 가입 이벤트 양쪽에서 재사용.
 * (BuyerProfile 이 아직 없으면 생성, 이미 있으면 추천인 필드만 업데이트)
 */
export interface ReferralLinkInput {
  /** Order.id (Order 가 아님, User.id) */
  userId: string;
  /** 셀러 slug (회원가입 URL ?ref= 또는 쿠키 sb_ref) */
  sellerRef?: string | null;
  /** 추천인 코드 (회원가입 폼 입력 또는 URL ?code=) */
  referralCode?: string | null;
}

export interface ReferralLinkResult {
  mappedSellerId: string | null;
  reason?: string;
}

export async function linkReferralForNewBuyer(
  prisma: PrismaClient,
  input: ReferralLinkInput,
): Promise<ReferralLinkResult> {
  const { userId } = input;
  const rawCode = typeof input.referralCode === "string" ? input.referralCode.trim() : "";
  const rawSlug =
    typeof input.sellerRef === "string" && isValidSellerSlug(input.sellerRef)
      ? input.sellerRef
      : null;

  let mappedSellerId: string | null = null;

  // 1) referralCode 우선 — 정확매치 후 미승인 제외
  if (rawCode) {
    const sellerByCode = await prisma.sellerProfile.findUnique({
      where: { referralCode: rawCode.toUpperCase() },
      select: { id: true, isApproved: true },
    });
    if (sellerByCode && sellerByCode.isApproved) {
      mappedSellerId = sellerByCode.id;
    } else {
      // referralCode 가 사실은 slug 였을 가능성 (관용 처리)
      const sellerBySlug = await prisma.sellerProfile.findFirst({
        where: { slug: rawCode.toLowerCase() },
        select: { id: true, isApproved: true },
      });
      if (sellerBySlug && sellerBySlug.isApproved) {
        mappedSellerId = sellerBySlug.id;
      }
    }
  }

  // 2) sellerRef (slug) 처리
  if (!mappedSellerId && rawSlug) {
    const seller = await prisma.sellerProfile.findUnique({
      where: { slug: rawSlug },
      select: { id: true, isApproved: true },
    });
    if (seller && seller.isApproved) {
      mappedSellerId = seller.id;
    }
  }

  // BuyerProfile upsert — 신규 OAuth 가입 시 NextAuth 가 BuyerProfile 을 만들지 않으므로
  // 여기서 생성/갱신을 함께 처리.
  const recordCode = rawCode || rawSlug || null;
  await prisma.buyerProfile.upsert({
    where: { userId },
    create: {
      userId,
      primarySellerId: mappedSellerId,
      referredBySellerId: mappedSellerId,
      referralCode: recordCode,
    },
    update: mappedSellerId
      ? {
          primarySellerId: mappedSellerId,
          referredBySellerId: mappedSellerId,
          referralCode: recordCode,
        }
      : { referralCode: recordCode },
  });

  if (mappedSellerId) {
    await syncSellerFanCount(mappedSellerId);
  }

  return {
    mappedSellerId,
    reason: mappedSellerId ? "linked" : "no_referral_or_invalid",
  };
}
