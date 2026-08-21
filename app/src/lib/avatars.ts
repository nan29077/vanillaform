// 역할별 아바타 목록
export const AVATAR_SETS = {
  // BUYER (구매회원)
  BUYER_MALE: Array.from({ length: 13 }, (_, i) => `/avatars/남성구매회원_${i + 1}.png`),
  BUYER_FEMALE: Array.from({ length: 13 }, (_, i) => `/avatars/여성구매회원_${i + 1}.png`),

  // SUPER_ADMIN (관리자)
  ADMIN: Array.from({ length: 5 }, (_, i) => `/avatars/관리자_${i + 1}.png`),
  ADMIN_MALE: [
    "/avatars/관리자_2.png",
    "/avatars/관리자_3.png",
    "/avatars/관리자_5.png",
  ],
  ADMIN_FEMALE: ["/avatars/관리자_1.png", "/avatars/관리자_4.png"],

  // MIDDLE_ADMIN & NODE (중간관리자)
  MIDDLE_ADMIN: Array.from({ length: 5 }, (_, i) => `/avatars/중간관리자_${i + 1}.png`),
  MIDDLE_ADMIN_MALE: [
    "/avatars/중간관리자_1.png",
    "/avatars/중간관리자_2.png",
    "/avatars/중간관리자_3.png",
  ],
  MIDDLE_ADMIN_FEMALE: [
    "/avatars/중간관리자_4.png",
    "/avatars/중간관리자_5.png",
  ],

  // SELLER (라이브셀러)
  SELLER: Array.from({ length: 10 }, (_, i) => `/avatars/라이브셀러_${i + 1}.png`),

  // BRAND_ADMIN (브랜드사)
  BRAND_ADMIN: Array.from({ length: 6 }, (_, i) => `/avatars/브랜드사_${i + 1}.png`),
  BRAND_ADMIN_MALE: [
    "/avatars/브랜드사_1.png",
    "/avatars/브랜드사_3.png",
    "/avatars/브랜드사_5.png",
  ],
  BRAND_ADMIN_FEMALE: [
    "/avatars/브랜드사_2.png",
    "/avatars/브랜드사_4.png",
    "/avatars/브랜드사_6.png",
  ],
};

function randomFrom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 역할과 성별에 따라 랜덤 아바타 URL 반환
 * @param role - 사용자 역할
 * @param gender - 성별 ('MALE' | 'FEMALE' | null/undefined = 랜덤)
 */
export function getRandomAvatar(role: string, gender?: string | null): string {
  switch (role) {
    case "BUYER": {
      if (gender === "MALE") return randomFrom(AVATAR_SETS.BUYER_MALE);
      if (gender === "FEMALE") return randomFrom(AVATAR_SETS.BUYER_FEMALE);
      // 성별 미구분 → 50/50 랜덤
      return randomFrom(
        Math.random() < 0.5 ? AVATAR_SETS.BUYER_MALE : AVATAR_SETS.BUYER_FEMALE
      );
    }
    case "SUPER_ADMIN": {
      if (gender === "MALE") return randomFrom(AVATAR_SETS.ADMIN_MALE);
      if (gender === "FEMALE") return randomFrom(AVATAR_SETS.ADMIN_FEMALE);
      return randomFrom(AVATAR_SETS.ADMIN);
    }
    case "MIDDLE_ADMIN":
    case "NODE": {
      if (gender === "MALE") return randomFrom(AVATAR_SETS.MIDDLE_ADMIN_MALE);
      if (gender === "FEMALE") return randomFrom(AVATAR_SETS.MIDDLE_ADMIN_FEMALE);
      return randomFrom(AVATAR_SETS.MIDDLE_ADMIN);
    }
    case "BRAND_ADMIN": {
      if (gender === "MALE") return randomFrom(AVATAR_SETS.BRAND_ADMIN_MALE);
      if (gender === "FEMALE") return randomFrom(AVATAR_SETS.BRAND_ADMIN_FEMALE);
      return randomFrom(AVATAR_SETS.BRAND_ADMIN);
    }
    case "SELLER":
      return randomFrom(AVATAR_SETS.SELLER);
    default:
      return randomFrom(AVATAR_SETS.SELLER);
  }
}
