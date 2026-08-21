// 전역 설정(Setting) 서버 전용 액세스 레이어.
// - 기능 토글(FeatureFlags) 과 정산일 설정 등을 DB(Setting) 에서 읽고 씁니다.
// - DB 값이 있으면 코드 기본값(featureFlags.ts) 보다 우선합니다.
// 이 모듈은 prisma 를 import 하므로 서버 컴포넌트 / route handler 에서만 사용하세요.

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  FEATURE_DEFAULTS,
  FEATURE_SETTING_KEYS,
  type FeatureFlags,
  type SocialLinks,
} from "@/lib/featureFlags";
import {
  REGISTER_FIELDS_SETTING_KEY,
  normalizeRegisterFieldSettings,
  type RegisterFieldSettings,
} from "@/lib/registerFields";

export const SETTLEMENT_BUSINESS_DAYS_KEY = "settlementBusinessDays";
export const DEFAULT_SETTLEMENT_BUSINESS_DAYS = 5;

// 소셜 링크 설정 키
export const SOCIAL_INSTAGRAM_ENABLED_KEY = "social.instagramEnabled";
export const SOCIAL_INSTAGRAM_URL_KEY = "social.instagramUrl";
export const SOCIAL_YOUTUBE_ENABLED_KEY = "social.youtubeEnabled";
export const SOCIAL_YOUTUBE_URL_KEY = "social.youtubeUrl";
export const SOCIAL_EMAIL_ENABLED_KEY = "social.emailEnabled";
export const SOCIAL_EMAIL_URL_KEY = "social.emailUrl";

// 푸터 회사 정보 설정 키
export const FOOTER_COMPANY_NAME_KEY = "footer.companyName";
export const FOOTER_CEO_NAME_KEY = "footer.ceoName";
export const FOOTER_BIZ_NUM_KEY = "footer.bizNum";
export const FOOTER_MAIL_ORDER_NUM_KEY = "footer.mailOrderNum";
export const FOOTER_PHONE_KEY = "footer.phone";
export const FOOTER_ADDRESS_KEY = "footer.address";
export const FOOTER_COPYRIGHT_KEY = "footer.copyright";

export type FooterSettings = {
  companyName: string;
  ceoName: string;
  bizNum: string;
  mailOrderNum: string;
  phone: string;
  address: string;
  copyright: string;
};

export const FOOTER_DEFAULTS: FooterSettings = {
  companyName: "바닐라폼",
  ceoName: "",
  bizNum: "",
  mailOrderNum: "",
  phone: "",
  address: "",
  copyright: "2026 VanillaForm. All rights reserved.",
};


// SocialLinks 타입은 featureFlags.ts에 정의됨 (클라이언트 공용)
export type { SocialLinks };

// 셀러 출금 수수료율(%) — 최고관리자 설정값, 없으면 0
export const PAYOUT_FEE_RATE_KEY = "payoutFeeRate";
export const DEFAULT_PAYOUT_FEE_RATE = 0;

// 역할별 정산 주기(영업일 기준 N일 후) — 셀러 외 중간관리자/브랜드사
export const MIDDLE_SETTLE_DAYS_KEY = "middleSettleDays";
export const BRAND_SETTLE_DAYS_KEY = "brandSettleDays";
export const DEFAULT_MIDDLE_SETTLE_DAYS = 5;
export const DEFAULT_BRAND_SETTLE_DAYS = 5;

// 한 번의 요청 안에서 Setting 조회를 1회로 묶음(React cache).
export const getSettingsMap = cache(async (): Promise<Record<string, string>> => {
  try {
    const rows = await prisma.setting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    // 테이블 미생성/DB 오류 시 빈 맵 → 코드 기본값으로 폴백
    return {};
  }
});

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

// 기능 토글 값 (DB 우선, 없으면 코드 기본값)
export async function getFeatureFlags(): Promise<FeatureFlags> {
  const map = await getSettingsMap();
  return {
    groupBuy: parseBool(map[FEATURE_SETTING_KEYS.groupBuy], FEATURE_DEFAULTS.groupBuy),
    liveCommerce: parseBool(map[FEATURE_SETTING_KEYS.liveCommerce], FEATURE_DEFAULTS.liveCommerce),
    seller: parseBool(map[FEATURE_SETTING_KEYS.seller], FEATURE_DEFAULTS.seller),
    brix: parseBool(map[FEATURE_SETTING_KEYS.brix], FEATURE_DEFAULTS.brix),
    regNormal: parseBool(map[FEATURE_SETTING_KEYS.regNormal], FEATURE_DEFAULTS.regNormal),
    regGroupBuy: parseBool(map[FEATURE_SETTING_KEYS.regGroupBuy], FEATURE_DEFAULTS.regGroupBuy),
    productRequest: parseBool(map[FEATURE_SETTING_KEYS.productRequest], FEATURE_DEFAULTS.productRequest),
    referral: parseBool(map[FEATURE_SETTING_KEYS.referral], FEATURE_DEFAULTS.referral),
    beeDecoration: parseBool(map[FEATURE_SETTING_KEYS.beeDecoration], FEATURE_DEFAULTS.beeDecoration),
    game: parseBool(map[FEATURE_SETTING_KEYS.game], FEATURE_DEFAULTS.game),
    themSnow: parseBool(map[FEATURE_SETTING_KEYS.themSnow], FEATURE_DEFAULTS.themSnow),
    themCherry: parseBool(map[FEATURE_SETTING_KEYS.themCherry], FEATURE_DEFAULTS.themCherry),
    themHalloween: parseBool(map[FEATURE_SETTING_KEYS.themHalloween], FEATURE_DEFAULTS.themHalloween),
    themChristmas: parseBool(map[FEATURE_SETTING_KEYS.themChristmas], FEATURE_DEFAULTS.themChristmas),
    themValentine: parseBool(map[FEATURE_SETTING_KEYS.themValentine], FEATURE_DEFAULTS.themValentine),
    themRainy: parseBool(map[FEATURE_SETTING_KEYS.themRainy], FEATURE_DEFAULTS.themRainy),
    themSummer: parseBool(map[FEATURE_SETTING_KEYS.themSummer], FEATURE_DEFAULTS.themSummer),
    themAutumn: parseBool(map[FEATURE_SETTING_KEYS.themAutumn], FEATURE_DEFAULTS.themAutumn),
  };
}

// 회원가입 항목 권한(필수/선택/숨김) 설정 조회 (DB JSON 우선, 없으면 코드 기본값)
export async function getRegisterFieldSettings(): Promise<RegisterFieldSettings> {
  const map = await getSettingsMap();
  const raw = map[REGISTER_FIELDS_SETTING_KEY];
  if (!raw) return normalizeRegisterFieldSettings(undefined);
  try {
    return normalizeRegisterFieldSettings(JSON.parse(raw));
  } catch {
    return normalizeRegisterFieldSettings(undefined);
  }
}

// 정산일(영업일 기준 N일 후)
function parseDays(raw: string | undefined, fallback: number): number {
  const n = raw === undefined ? NaN : parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function getSettlementBusinessDays(): Promise<number> {
  const map = await getSettingsMap();
  return parseDays(map[SETTLEMENT_BUSINESS_DAYS_KEY], DEFAULT_SETTLEMENT_BUSINESS_DAYS);
}

export async function getMiddleSettleDays(): Promise<number> {
  const map = await getSettingsMap();
  return parseDays(map[MIDDLE_SETTLE_DAYS_KEY], DEFAULT_MIDDLE_SETTLE_DAYS);
}

export async function getBrandSettleDays(): Promise<number> {
  const map = await getSettingsMap();
  return parseDays(map[BRAND_SETTLE_DAYS_KEY], DEFAULT_BRAND_SETTLE_DAYS);
}

// 셀러 출금 수수료율(%) 조회 — 최고관리자가 설정한 값, 미설정/비정상 값이면 0
export async function getPayoutFeeRate(): Promise<number> {
  const map = await getSettingsMap();
  const raw = map[PAYOUT_FEE_RATE_KEY];
  const n = raw === undefined ? NaN : parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_PAYOUT_FEE_RATE;
}

// 소셜 링크 설정 조회
export async function getSocialLinks(): Promise<import("@/lib/featureFlags").SocialLinks> {
  const map = await getSettingsMap();
  return {
    instagramEnabled: map[SOCIAL_INSTAGRAM_ENABLED_KEY] === "true",
    instagramUrl: map[SOCIAL_INSTAGRAM_URL_KEY] ?? "",
    youtubeEnabled: map[SOCIAL_YOUTUBE_ENABLED_KEY] === "true",
    youtubeUrl: map[SOCIAL_YOUTUBE_URL_KEY] ?? "",
    emailEnabled: map[SOCIAL_EMAIL_ENABLED_KEY] === "true",
    emailUrl: map[SOCIAL_EMAIL_URL_KEY] ?? "",
  };
}


// 푸터 회사정보 조회
export async function getFooterSettings(): Promise<FooterSettings> {
  const map = await getSettingsMap();
  return {
    companyName: map[FOOTER_COMPANY_NAME_KEY] ?? FOOTER_DEFAULTS.companyName,
    ceoName: map[FOOTER_CEO_NAME_KEY] ?? FOOTER_DEFAULTS.ceoName,
    bizNum: map[FOOTER_BIZ_NUM_KEY] ?? FOOTER_DEFAULTS.bizNum,
    mailOrderNum: map[FOOTER_MAIL_ORDER_NUM_KEY] ?? FOOTER_DEFAULTS.mailOrderNum,
    phone: map[FOOTER_PHONE_KEY] ?? FOOTER_DEFAULTS.phone,
    address: map[FOOTER_ADDRESS_KEY] ?? FOOTER_DEFAULTS.address,
    copyright: map[FOOTER_COPYRIGHT_KEY] ?? FOOTER_DEFAULTS.copyright,
  };
}

// 여러 설정을 한 번에 저장(upsert)
export async function setSettings(entries: Record<string, string>): Promise<void> {
  const keys = Object.keys(entries);
  await prisma.$transaction(
    keys.map((key) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: entries[key] },
        update: { value: entries[key] },
      }),
    ),
  );
}
