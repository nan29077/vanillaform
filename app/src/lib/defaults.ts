// 앱 전반 기본 이미지(placeholder) 통일.
// - 상품 썸네일 없음 → 바닐라폼 브랜드 placeholder(자체 SVG)
// - 셀러샵 상단 배경 기본값 → 깔끔한 실사 이미지(unsplash)
// - 역할별 프로필 기본 이미지 → 역할별 캐릭터 아바타(public/avatars/*.png)

// 바닐라폼 전용 "노이미지" placeholder (public/no-image.png — 바닐라 플라워 노랑+검정 브랜드 톤)
// 상품 썸네일이 없거나(null/빈 문자열) 로드 실패할 때 모든 화면에서 이 이미지를 표시.
export const NO_IMAGE = "/no-image.png";

// 기존 상품 placeholder 상수는 NO_IMAGE 로 통일 (레거시 참조 호환용)
export const DEFAULT_PRODUCT_IMAGE = NO_IMAGE;

// 셀러샵 상단 기본 배너 (깔끔한 실사)
export const DEFAULT_SHOP_BANNER =
  "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1000&q=80&auto=format&fit=crop";

// ─── 역할별 캐릭터 아바타 (public/avatars/*.png) ────────────────────────────

// 최고관리자 (5종)
export const ADMIN_AVATARS = Array.from({ length: 5 }, (_, i) => `/avatars/관리자_${i + 1}.png`);

// 중간관리자·노드 (5종)
export const MIDDLE_ADMIN_AVATARS = Array.from({ length: 5 }, (_, i) => `/avatars/중간관리자_${i + 1}.png`);

// 라이브 셀러 (10종)
export const SELLER_AVATARS = Array.from({ length: 10 }, (_, i) => `/avatars/라이브셀러_${i + 1}.png`);

// 브랜드사 (6종)
export const BRAND_AVATARS = Array.from({ length: 6 }, (_, i) => `/avatars/브랜드사_${i + 1}.png`);

// 구매자 — 여성(13종), 남성(13종)
export const BUYER_FEMALE_AVATARS = Array.from({ length: 13 }, (_, i) => `/avatars/여성구매회원_${i + 1}.png`);
export const BUYER_MALE_AVATARS = Array.from({ length: 13 }, (_, i) => `/avatars/남성구매회원_${i + 1}.png`);
export const ALL_BUYER_AVATARS = [...BUYER_FEMALE_AVATARS, ...BUYER_MALE_AVATARS];

// 전체 아바타 목록 (NodeSettingsClient 등에서 선택 UI용)
// FEMALE_AVATARS / MALE_AVATARS 는 구매자 이미지로 매핑 (레거시 호환용)
export const FEMALE_AVATARS = BUYER_FEMALE_AVATARS;
export const MALE_AVATARS = BUYER_MALE_AVATARS;
export const ALL_AVATARS = [
  ...ADMIN_AVATARS,
  ...MIDDLE_ADMIN_AVATARS,
  ...SELLER_AVATARS,
  ...BRAND_AVATARS,
  ...BUYER_FEMALE_AVATARS,
  ...BUYER_MALE_AVATARS,
];

// ─── 해시 유틸 ────────────────────────────────────────────────────────────────
function computeHash(seed: string): number {
  // seed 가 비어 있어도(select 누락 등) 페이지 전체가 죽지 않도록 방어한다.
  // 아바타는 장식 요소이므로 시드가 없으면 고정 캐릭터로 폴백한다.
  if (!seed) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
}

// ─── 역할 기반 아바타 선택 ────────────────────────────────────────────────────
// role: SUPER_ADMIN | MIDDLE_ADMIN | NODE | SELLER | BRAND_ADMIN | BUYER
// gender: "male" | "female" | null (구매자 풀 선택에만 사용)
export function pickRoleAvatar(seed: string, role: string, gender?: string | null): string {
  const idx = computeHash(seed);
  switch (role) {
    case "SUPER_ADMIN":
      return ADMIN_AVATARS[idx % ADMIN_AVATARS.length];
    case "MIDDLE_ADMIN":
    case "NODE":
      return MIDDLE_ADMIN_AVATARS[idx % MIDDLE_ADMIN_AVATARS.length];
    case "SELLER":
      return SELLER_AVATARS[idx % SELLER_AVATARS.length];
    case "BRAND_ADMIN":
      return BRAND_AVATARS[idx % BRAND_AVATARS.length];
    case "BUYER":
    default:
      return pickBuyerAvatar(seed, gender);
  }
}

// seed(아이디/이름)로 안정적으로 하나의 구매자 캐릭터를 고른다.
// gender 가 있으면 해당 성별 풀에서 선택.
export function pickBuyerAvatar(seed: string, gender?: string | null): string {
  const pool =
    gender === "male"
      ? BUYER_MALE_AVATARS
      : gender === "female"
        ? BUYER_FEMALE_AVATARS
        : ALL_BUYER_AVATARS;
  return pool[computeHash(seed) % pool.length];
}

// seed(아이디)로 셀러 캐릭터를 고른다.
export function pickSellerAvatar(seed: string): string {
  return SELLER_AVATARS[computeHash(seed) % SELLER_AVATARS.length];
}

// seed(brandId 등)로 안정적으로 하나의 브랜드 캐릭터를 고른다.
export function pickBrandAvatar(seed: string): string {
  return BRAND_AVATARS[computeHash(seed) % BRAND_AVATARS.length];
}

// 기본 아바타 — 레거시 호환용. gender 기반 구매자 풀에서 선택.
// 새 코드에서는 pickRoleAvatar 를 사용할 것.
export function pickDefaultAvatar(seed: string, gender?: string | null): string {
  return pickBuyerAvatar(seed, gender);
}

// 신규 가입 등에서 성별 기반으로 랜덤 캐릭터를 고른다(성별 미상이면 전체 랜덤).
export function randomAvatar(gender?: string | null): string {
  const pool = gender === "male" ? BUYER_MALE_AVATARS : gender === "female" ? BUYER_FEMALE_AVATARS : ALL_BUYER_AVATARS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// 정적 placeholder 용 단일 기본 아바타 (SafeImage placeholder 등)
export const DEFAULT_AVATAR = BUYER_FEMALE_AVATARS[0]; // /avatars/여성구매회원_1.png

// ─── 아바타 제외 목록 ──────────────────────────────────────────────────────────
// 아래 이름의 계정은 랜덤 캐릭터를 적용하지 않고 기존 프로필 이미지 또는 이미지 없음 상태 유지.
export const AVATAR_EXCLUSIONS: ReadonlySet<string> = new Set(["김혜선", "천송이 쇼핑"]);

// name 또는 shopName 이 제외 목록에 있으면 false 반환.
export function shouldUseAvatar(name?: string | null, shopName?: string | null): boolean {
  if (name && AVATAR_EXCLUSIONS.has(name)) return false;
  if (shopName && AVATAR_EXCLUSIONS.has(shopName)) return false;
  return true;
}
