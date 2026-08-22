import { PrismaClient, Role } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("시드 데이터 생성 시작...");

  const pw = await bcrypt.hash("password123", 12);

  // 최고관리자
  await prisma.user.upsert({
    where: { email: "admin@vanillaform.local" },
    update: {},
    create: {
      email: "admin@vanillaform.local",
      name: "관리자",
      password: pw,
      role: Role.SUPER_ADMIN,
    },
  });

  // 셀러1
  const seller1 = await prisma.user.upsert({
    where: { email: "seller1@vanillaform.local" },
    update: {},
    create: {
      email: "seller1@vanillaform.local",
      name: "테스트셀러",
      password: pw,
      role: Role.SELLER,
    },
  });

  // SellerProfile upsert
  const existingProfile = await prisma.sellerProfile.findUnique({ where: { userId: seller1.id } });
  if (!existingProfile) {
    await prisma.sellerProfile.create({
      data: {
        userId: seller1.id,
        slug: "test-seller-shop",
        shopName: "테스트 셀러샵",
        isApproved: true,
        commissionRate: 10,
      },
    });
  }

  // 구매자1
  await prisma.user.upsert({
    where: { email: "buyer1@example.com" },
    update: {},
    create: {
      email: "buyer1@example.com",
      name: "테스트구매자",
      password: pw,
      role: Role.BUYER,
    },
  });

  console.log("시드 데이터 생성 완료!");
  console.log("  - 관리자: admin@vanillaform.local / password123");
  console.log("  - 셀러1: seller1@vanillaform.local / password123 (테스트 셀러샵)");
  console.log("  - 구매자1: buyer1@example.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
