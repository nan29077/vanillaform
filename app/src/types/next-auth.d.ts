import type { DefaultSession } from "next-auth";

// Prisma schema 의 `enum Role` 과 1:1 로 일치해야 한다.
// (누락돼 있던 NODE/MIDDLE_ADMIN 때문에 `role === "MIDDLE_ADMIN"` 같은 정상 분기가
//  "겹치지 않는 비교"로 타입 에러가 나고, 실제 권한 분기가 죽은 코드처럼 보였다)
type AppRole =
  | "SUPER_ADMIN"
  | "NODE"
  | "MIDDLE_ADMIN"
  | "BRAND_ADMIN"
  | "SELLER"
  | "BUYER";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      sellerSlug: string | null;
      brandId: string | null;
      /** MiddleAdminProfile.id — 중간관리자 전용 API 의 소유권 검사에 사용 */
      middleAdminId: string | null;
      mustResetPassword: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: AppRole;
    sellerSlug: string | null;
    brandId: string | null;
    middleAdminId: string | null;
    mustResetPassword: boolean;
  }
}
