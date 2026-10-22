import bcrypt from "bcryptjs";
import { Role, type PrismaClient } from "../src/generated/prisma";

// 테스트 셀러 "바닐라폼 지점" — 뷰티메이트의 "뷰티메이트 지점"과 같은 역할.
// 셀러 찾기(/sellers)에 노출되고, 충전 결제 화면 머리글의 판매처로 표시된다.
// 앱 코드는 이 slug 로 지점을 찾는다 (src/lib/walletShared.ts 의 BRANCH_SELLER_SLUG 와 일치해야 함).
export const BRANCH_SELLER = {
  email: "branch@vanillaform.local",
  // 실서버에서는 BRANCH_SELLER_PASSWORD 로 다른 비밀번호를 지정할 수 있다 (기본: 다른 테스트 계정과 동일)
  password: process.env.BRANCH_SELLER_PASSWORD || "password123",
  name: "바닐라폼 지점",
  slug: "vanillaform-branch",
  shopName: "바닐라폼 지점",
  shopDescription:
    "바닐라폼 공식 테스트 지점입니다. 충전 결제(목업) 흐름 확인용 셀러입니다.",
};

/**
 * 바닐라폼 지점 셀러를 만든다. 이미 있으면 건드리지 않는다(멱등).
 * - 계정이 있으면 비밀번호·역할을 바꾸지 않는다.
 * - 셀러 프로필이 없을 때만 새로 만든다.
 */
export async function ensureBranchSeller(
  prisma: PrismaClient,
): Promise<{ created: boolean }> {
  const existing = await prisma.user.findUnique({
    where: { email: BRANCH_SELLER.email },
    select: { id: true, role: true, sellerProfile: { select: { id: true } } },
  });
  if (existing && existing.role !== Role.SELLER) {
    console.warn(
      `  ! ${BRANCH_SELLER.email} 계정이 셀러가 아니라(${existing.role}) 지점 셀러를 만들지 않았습니다.`,
    );
    return { created: false };
  }

  let userId = existing?.id;
  let created = false;

  if (!userId) {
    const pw = await bcrypt.hash(BRANCH_SELLER.password, 12);
    const user = await prisma.user.create({
      data: {
        email: BRANCH_SELLER.email,
        name: BRANCH_SELLER.name,
        password: pw,
        role: Role.SELLER,
      },
      select: { id: true },
    });
    userId = user.id;
    created = true;
  }

  if (!existing?.sellerProfile) {
    // slug 가 다른 계정에 이미 쓰이고 있으면 프로필 생성을 건너뛴다(기존 데이터 보호)
    const slugTaken = await prisma.sellerProfile.findUnique({
      where: { slug: BRANCH_SELLER.slug },
      select: { userId: true },
    });
    if (slugTaken && slugTaken.userId !== userId) {
      console.warn(
        `  ! slug "${BRANCH_SELLER.slug}" 가 다른 계정에 이미 사용 중이라 지점 프로필 생성을 건너뜁니다.`,
      );
      return { created };
    }
    if (!slugTaken) {
      await prisma.sellerProfile.create({
        data: {
          userId,
          slug: BRANCH_SELLER.slug,
          shopName: BRANCH_SELLER.shopName,
          shopDescription: BRANCH_SELLER.shopDescription,
          isApproved: true,
          commissionRate: 10,
        },
      });
      created = true;
    }
  }

  return { created };
}
