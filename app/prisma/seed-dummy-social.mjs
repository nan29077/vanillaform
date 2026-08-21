// ─────────────────────────────────────────────────────────────
// 바닐라폼 테스트용 "소셜주문서" 더미 데이터 시드 스크립트
//
// 실행: app/ 디렉토리에서  node prisma/seed-dummy-social.mjs
//
// 전제:
//   - seed-dummy.mjs 를 먼저 실행해 더미 셀러(test-seller-a/b/c)와
//     더미 상품([TEST] prefix)이 존재해야 한다.
//
// SocialOrder 는 Prisma 스키마 밖의 raw 테이블이므로 $queryRawUnsafe /
// $executeRawUnsafe 로 직접 접근한다. (schema.prisma 에 모델 없음)
//
// 안전 규칙:
//   - "혜선"(김혜선 셀러) 관련 데이터는 절대 건드리지 않는다.
//   - 더미 소셜주문서는 오직 더미 셀러(test-seller-a/b/c) + [TEST] 상품에만
//     연결하며, address 를 "[TEST] " 로 시작시켜 식별 가능하게 한다.
//   - id 는 결정적(csoctest0001…)으로 부여하고 ON DUPLICATE KEY UPDATE 를
//     사용하므로 여러 번 실행해도 중복이 쌓이지 않는다(idempotent).
//   - 기존 실데이터(sellerId 가 더미 셀러가 아닌 행)는 절대 수정/삭제하지 않는다.
//
// 필요한 컬럼(snsPlatform/snsHandle/snsNickname/quantity/status)이 없으면
// db push 없이 ALTER TABLE 로만 추가한다.
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

const NOW = new Date();
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

// information_schema 로 컬럼 존재 확인 후 없을 때만 ALTER TABLE (db push 금지)
async function ensureColumn(table, column, definition) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    table,
    column
  );
  const exists = Number(rows[0].n) > 0;
  if (exists) {
    console.log(`   · ${table}.${column} 이미 존재`);
    return;
  }
  await prisma.$executeRawUnsafe(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  console.log(`   + ${table}.${column} 추가 (${definition})`);
}

async function main() {
  console.log("🌱 소셜주문서 더미 시드 시작\n");

  // ── 0. 혜선 보호 확인 ──
  const protectedUsers = await prisma.user.findMany({
    where: { OR: [{ name: { contains: "혜선" } }, { email: { contains: "혜선" } }] },
    select: { id: true, name: true, email: true },
  });
  console.log("🛡  보호 대상(혜선) 유저:", protectedUsers.length, "명");

  // ── 1. 필요한 컬럼 보장 (ALTER TABLE only) ──
  console.log("① SocialOrder 컬럼 보장");
  await ensureColumn("SocialOrder", "snsPlatform", "VARCHAR(50) NULL");
  await ensureColumn("SocialOrder", "snsHandle", "VARCHAR(191) NULL");
  await ensureColumn("SocialOrder", "snsNickname", "VARCHAR(100) NULL");
  await ensureColumn("SocialOrder", "quantity", "INT NULL DEFAULT 1");
  await ensureColumn("SocialOrder", "status", "VARCHAR(30) NULL");

  // ── 2. 더미 셀러 / 상품 조회 (slug / [TEST] 이름 기준) ──
  console.log("\n② 더미 셀러·상품 조회");
  const sellers = await prisma.sellerProfile.findMany({
    where: { slug: { in: ["test-seller-a", "test-seller-b", "test-seller-c"] } },
    select: { id: true, slug: true, shopName: true },
  });
  const sellerBySlug = Object.fromEntries(sellers.map((s) => [s.slug, s]));
  const need = ["test-seller-a", "test-seller-b", "test-seller-c"].filter((s) => !sellerBySlug[s]);
  if (need.length) {
    console.error(`❌ 더미 셀러 누락: ${need.join(", ")}\n   → 먼저 node prisma/seed-dummy.mjs 실행 필요`);
    process.exit(1);
  }

  const products = await prisma.product.findMany({
    where: { name: { startsWith: "[TEST]" } },
    select: { id: true, name: true },
  });
  const productByName = Object.fromEntries(products.map((p) => [p.name, p]));
  function prod(name) {
    const p = productByName[name];
    if (!p) {
      console.error(`❌ 더미 상품 누락: ${name}\n   → 먼저 node prisma/seed-dummy.mjs 실행 필요`);
      process.exit(1);
    }
    return p;
  }

  const sellerA = sellerBySlug["test-seller-a"];
  const sellerB = sellerBySlug["test-seller-b"];
  const sellerC = sellerBySlug["test-seller-c"];

  // ── 3. 더미 소셜주문서 정의 ──
  // [buyerName, seller, product, quantity, status, snsHandle, snsNickname, 제출일]
  console.log("\n③ 소셜주문서 정의");
  const defs = [
    // 셀러A (3건)
    ["테스트구매자A", sellerA, prod("[TEST] 직접등록상품-스킨케어세트"), 1, "결제완료", "test_youtube_1234", "테스트대화명A", daysAgo(3)],
    ["테스트구매자B", sellerA, prod("[TEST] 공급가상품-비타민C세럼"), 2, "결제완료", "test_youtube_5678", "테스트대화명B", daysAgo(2)],
    ["테스트구매자A", sellerA, prod("[TEST] 직접등록상품-스킨케어세트"), 1, "입금대기", "test_youtube_1234", "테스트대화명A", daysAgo(1)],
    // 셀러B (2건)
    ["테스트구매자B", sellerB, prod("[TEST] 공급가상품-콜라겐크림"), 1, "결제완료", "test_youtube_5678", "테스트대화명B", daysAgo(4)],
    ["테스트구매자A", sellerB, prod("[TEST] 직접등록상품-헤어케어"), 2, "발송완료", "test_youtube_1234", "테스트대화명A", daysAgo(5)],
    // 셀러C (1건)
    ["테스트구매자B", sellerC, prod("[TEST] 수수료상품-프리미엄앰플"), 1, "결제완료", "test_youtube_5678", "테스트대화명B", daysAgo(1)],
  ];

  // ── 4. 기존 더미 소셜주문서 정리 (더미 셀러 + [TEST] address 마커만) ──
  const dummySellerIds = [sellerA.id, sellerB.id, sellerC.id];
  const placeholders = dummySellerIds.map(() => "?").join(", ");
  const delRes = await prisma.$executeRawUnsafe(
    `DELETE FROM SocialOrder WHERE sellerId IN (${placeholders}) AND address LIKE '[TEST]%'`,
    ...dummySellerIds
  );
  console.log(`\n④ 기존 더미 소셜주문서 정리: ${delRes}건 삭제`);

  // ── 5. 삽입 (결정적 id + ON DUPLICATE KEY UPDATE) ──
  console.log("⑤ 소셜주문서 생성");
  let n = 0;
  for (const [buyerName, seller, product, quantity, status, snsHandle, snsNickname, createdAt] of defs) {
    n++;
    const id = "csoctest" + String(n).padStart(4, "0"); // varchar(25) 이내, 결정적
    const suffix = buyerName.slice(-1); // A or B
    const address = `[TEST] 서울시 강남구 테헤란로 ${100 + n}, ${n}층 (테스트배송지-${suffix})`;
    const phone = `010-0000-${String(1000 + n).slice(-4)}`;
    const depositorName = buyerName;
    const snsAccounts = JSON.stringify([{ platform: "유튜브", handle: snsHandle }]);

    await prisma.$executeRawUnsafe(
      `INSERT INTO SocialOrder
         (id, productId, sellerId, name, address, phone, depositorName, snsAccounts,
          quantity, status, snsPlatform, snsHandle, snsNickname, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         productId=VALUES(productId), sellerId=VALUES(sellerId), name=VALUES(name),
         address=VALUES(address), phone=VALUES(phone), depositorName=VALUES(depositorName),
         snsAccounts=VALUES(snsAccounts), quantity=VALUES(quantity), status=VALUES(status),
         snsPlatform=VALUES(snsPlatform), snsHandle=VALUES(snsHandle),
         snsNickname=VALUES(snsNickname), updatedAt=VALUES(updatedAt)`,
      id,
      product.id,
      seller.id,
      buyerName,
      address,
      phone,
      depositorName,
      snsAccounts,
      quantity,
      status,
      "유튜브",
      snsHandle,
      snsNickname,
      createdAt,
      createdAt
    );
    console.log(`   [${seller.shopName}] ${buyerName} · ${product.name} · ${quantity}개 · ${status}`);
  }

  // ── 결과 확인 ──
  const cnt = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS n FROM SocialOrder WHERE sellerId IN (${placeholders}) AND address LIKE '[TEST]%'`,
    ...dummySellerIds
  );
  console.log(`\n✅ 소셜주문서 더미 시드 완료 — 더미 소셜주문서 ${Number(cnt[0].n)}건`);
}

main()
  .catch((e) => {
    console.error("❌ 오류:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
