import { PrismaClient } from "../src/generated/prisma";
import { BRANCH_SELLER, ensureBranchSeller } from "./branchSeller";

// 테스트 셀러 "바닐라폼 지점" 만 단독으로 만든다.
// 전체 시드(seed.ts)와 달리 다른 계정·데이터는 전혀 건드리지 않으므로 실서버에도 안전하게 실행할 수 있다.
//   npm run db:seed-branch
const prisma = new PrismaClient();

async function main() {
  const { created } = await ensureBranchSeller(prisma);
  console.log(
    created
      ? "바닐라폼 지점 셀러를 만들었습니다."
      : "바닐라폼 지점 셀러가 이미 있어 변경하지 않았습니다.",
  );
  console.log(
    `  - 아이디: ${BRANCH_SELLER.email} / 비밀번호: ${BRANCH_SELLER.password}`,
  );
  console.log(
    `  - 샵: ${BRANCH_SELLER.shopName} (/shop/${BRANCH_SELLER.slug})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
