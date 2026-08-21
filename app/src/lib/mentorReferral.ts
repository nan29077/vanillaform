/**
 * 셀러 추천인(멘토-멘티) 시스템 유틸리티
 *
 * - sellerReferralCode: User 테이블에 저장되는 셀러가입 추천인코드 (예: SB4K9M2X)
 * - 구매자 레퍼럴(SellerProfile.referralCode)과 완전히 별개
 */

import type { PrismaClient } from "@/generated/prisma";

/** 셀러가입 추천인코드 생성 (SB + 6자리 영문대문자+숫자) */
export function generateSellerReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 혼동되는 문자(I, O, 0, 1) 제외
  let code = "SB";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** 중복 없는 코드 생성 (최대 10회 재시도) */
export async function generateUniqueSellerReferralCode(
  prisma: PrismaClient
): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateSellerReferralCode();
    const existing = await (prisma as any).user.findUnique({
      where: { sellerReferralCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  // 재시도 초과 시 타임스탬프 기반 코드 사용
  return `SB${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

/**
 * 셀러가입 추천인코드로 멘토 User를 조회
 * - 유효하지 않거나 SELLER 역할이 아닌 경우 null 반환
 */
export async function findMentorByReferralCode(
  prisma: PrismaClient,
  code: string
): Promise<{ id: string; name: string } | null> {
  if (!code || typeof code !== "string") return null;
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  const user = await (prisma as any).user.findUnique({
    where: { sellerReferralCode: normalized },
    select: { id: true, name: true, role: true, isActive: true },
  });

  if (!user || user.role !== "SELLER" || !user.isActive) return null;
  return { id: user.id, name: user.name };
}

/**
 * 기존 SELLER 계정에 sellerReferralCode가 없는 경우 일괄 발급
 * (최초 1회 마이그레이션용)
 */
export async function backfillSellerReferralCodes(
  prisma: PrismaClient
): Promise<number> {
  const sellers = await (prisma as any).user.findMany({
    where: { role: "SELLER", sellerReferralCode: null },
    select: { id: true },
  });

  let updated = 0;
  for (const seller of sellers) {
    const code = await generateUniqueSellerReferralCode(prisma);
    await (prisma as any).user.update({
      where: { id: seller.id },
      data: { sellerReferralCode: code },
    });
    updated++;
  }
  return updated;
}
