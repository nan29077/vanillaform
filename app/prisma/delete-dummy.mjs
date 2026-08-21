// ─────────────────────────────────────────────────────────────
// 바닐라폼 테스트용 더미 데이터 전체 삭제 스크립트
//
// 실행: app/ 디렉토리에서  node prisma/delete-dummy.mjs
//
// 삭제 대상(더미 식별 패턴만):
//   - 소셜주문서: 더미 셀러(@dummy-test.com) 연결 + address "[TEST]" 마커 (raw 테이블)
//   - 주문:   orderNumber "TESTORD-" prefix
//   - 상품:   name "[TEST]" prefix (+ 연결된 SellerShopProduct / OrderItem 등 cascade)
//   - 유저:   email "@dummy-test.com" 도메인 (+ 프로필/주문 cascade)
//
// 안전 규칙:
//   - "혜선"(김혜선 셀러) 유저는 절대 삭제 대상에 포함하지 않는다.
//     (더미 패턴과 겹치지 않지만, 실행 전 탐지해 보호하고 겹치면 즉시 중단)
//   - 위 3가지 식별 패턴에 매칭되는 레코드만 삭제한다.
// ─────────────────────────────────────────────────────────────

import { createRequire } from "module";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = join(__dirname, "..");

function loadEnv(file) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv(join(appDir, ".env"));
loadEnv(join(appDir, ".env.local"));

if (!process.env.VANILLAFORM_DATABASE_URL) {
  console.error("❌ VANILLAFORM_DATABASE_URL을 .env에서 찾지 못했습니다.");
  process.exit(1);
}

const { PrismaClient } = require("../src/generated/prisma");
const prisma = new PrismaClient();

const DUMMY_DOMAIN = "@dummy-test.com";

async function main() {
  console.log("🗑  더미 데이터 삭제 시작\n");

  // 혜선 보호 확인
  const protectedUsers = await prisma.user.findMany({
    where: { OR: [{ name: { contains: "혜선" } }, { email: { contains: "혜선" } }] },
    select: { id: true, name: true, email: true },
  });
  console.log("🛡  보호 대상(혜선):", protectedUsers.length, "명");
  for (const u of protectedUsers) {
    if (u.email.endsWith(DUMMY_DOMAIN)) {
      console.error("❌ 보호 유저가 더미 도메인을 사용 중입니다. 중단합니다.");
      process.exit(1);
    }
  }

  const dummyUsers = await prisma.user.findMany({
    where: { email: { endsWith: DUMMY_DOMAIN } },
    select: { id: true },
  });
  const dummyUserIds = dummyUsers.map((u) => u.id).filter((id) => !protectedUsers.some((p) => p.id === id));

  // 1) 더미 주문 삭제 (OrderItem/ReferralCommission/MiddleAdminCommission cascade)
  //    - TESTORD- prefix 또는 더미 유저/셀러가 관련된 주문
  const dummyShopSellerIds = (
    await prisma.sellerProfile.findMany({
      where: { userId: { in: dummyUserIds } },
      select: { id: true },
    })
  ).map((s) => s.id);

  const delOrders = await prisma.order.deleteMany({
    where: {
      OR: [
        { orderNumber: { startsWith: "TESTORD-" } },
        { userId: { in: dummyUserIds } },
        { sellerId: { in: dummyShopSellerIds } },
      ],
    },
  });

  // 1-b) 더미 소셜주문서 삭제 (raw 테이블)
  //   - 더미 셀러(@dummy-test.com) 소유 + address "[TEST]" 마커인 행만.
  //   - 실데이터(더미 셀러가 아닌 sellerId)는 매칭되지 않아 안전.
  let delSocial = 0;
  if (dummyShopSellerIds.length) {
    const ph = dummyShopSellerIds.map(() => "?").join(", ");
    delSocial = await prisma.$executeRawUnsafe(
      `DELETE FROM SocialOrder WHERE sellerId IN (${ph}) AND address LIKE '[TEST]%'`,
      ...dummyShopSellerIds
    );
  }

  // 2) 셀러 샵 상품 삭제 ([TEST] 상품 연결분)
  const delShop = await prisma.sellerShopProduct.deleteMany({
    where: { product: { name: { startsWith: "[TEST]" } } },
  });

  // 3) 더미 상품 삭제 ([TEST] prefix) — 연관 이미지/변형/샵상품 등 cascade
  const delProducts = await prisma.product.deleteMany({
    where: { name: { startsWith: "[TEST]" } },
  });

  // 4) 더미 유저 삭제 (프로필/주소/알림 등 cascade) — 혜선 제외
  const delUsers = await prisma.user.deleteMany({
    where: { id: { in: dummyUserIds } },
  });

  console.log("\n✅ 삭제 완료");
  console.table({
    socialOrders: delSocial,
    orders: delOrders.count,
    sellerShopProducts: delShop.count,
    products: delProducts.count,
    users: delUsers.count,
  });
}

main()
  .catch((e) => {
    console.error("❌ 오류:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
