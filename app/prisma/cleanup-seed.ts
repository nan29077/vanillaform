import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

const KEEP_EMAILS = [
  "admin@vanillaform.local",
  "seller1@vanillaform.local",
  "buyer1@example.com",
];

async function main() {
  console.log("데이터 정리 시작...");

  // 더미 데이터 전부 삭제
  await prisma.review.deleteMany({});
  await prisma.shoppingTag.deleteMany({});
  await prisma.contentPost.deleteMany({});
  await prisma.groupBuyCampaign.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.sellerShopProduct.deleteMany({});
  await prisma.productImage.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.product.deleteMany({});

  // 유지 3개 계정을 제외한 모든 User 삭제 (관련 profile CASCADE 전제)
  await prisma.user.deleteMany({
    where: {
      email: { notIn: KEEP_EMAILS },
    },
  });

  console.log("데이터 정리 완료!");
  console.log("  유지된 계정:", KEEP_EMAILS.join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
