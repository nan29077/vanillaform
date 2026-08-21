// ─────────────────────────────────────────────────────────────
// 바닐라폼 테스트용 더미 데이터 시드 스크립트
//
// 실행: app/ 디렉토리에서  node prisma/seed-dummy.mjs
//
// 안전 규칙:
//  - 모든 더미 유저 이메일은 @dummy-test.com 도메인
//  - 모든 더미 상품 이름은 "[TEST] " prefix
//  - 모든 더미 주문번호는 "TESTORD-" prefix
//  → 나중에 delete-dummy.mjs 로 한 번에 삭제 가능
//
//  - "혜선"(김혜선 셀러) 관련 유저의 기존 데이터는 절대 건드리지 않음
//    (이 스크립트는 더미 패턴 레코드만 생성/재생성하며, 실행 전 혜선 유저를
//     탐지해 보호 대상임을 로그로 확인한다)
//
//  - 재실행 가능(idempotent): 자기 자신이 만든 더미 패턴 레코드만
//    upsert / 삭제-재생성 하므로 여러 번 실행해도 중복이 쌓이지 않는다.
// ─────────────────────────────────────────────────────────────

import { createRequire } from "module";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = join(__dirname, "..");

// ── .env 로드 (dotenv 미설치 → 수동 파싱) ──
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
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// ── 상수 ──
const DUMMY_DOMAIN = "@dummy-test.com";
const PW_PLAIN = "test1234!";
const NOW = new Date();
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

async function main() {
  console.log("🌱 더미 데이터 시드 시작\n");

  const hashedPw = await bcrypt.hash(PW_PLAIN, 12);

  // ── 0. 혜선(김혜선 셀러) 보호 확인 ──
  const protectedUsers = await prisma.user.findMany({
    where: {
      OR: [{ name: { contains: "혜선" } }, { email: { contains: "혜선" } }],
    },
    select: { id: true, name: true, email: true, role: true },
  });
  console.log("🛡  보호 대상(혜선) 유저:", protectedUsers.length, "명");
  for (const u of protectedUsers) {
    console.log(`   - [${u.role}] ${u.name} <${u.email}> (id=${u.id}) → 건드리지 않음`);
  }
  const protectedIds = new Set(protectedUsers.map((u) => u.id));
  // 방어: 더미 이메일이 보호 유저와 겹치면 즉시 중단
  for (const u of protectedUsers) {
    if (u.email.endsWith(DUMMY_DOMAIN)) {
      console.error("❌ 보호 유저가 더미 도메인을 사용 중입니다. 중단합니다.");
      process.exit(1);
    }
  }
  console.log("");

  // 카운터
  const counts = {
    users: 0,
    sellerProfiles: 0,
    brandProfiles: 0,
    middleAdminProfiles: 0,
    buyerProfiles: 0,
    products: 0,
    shopProducts: 0,
    orders: 0,
    orderItems: 0,
  };

  // ── 유저 upsert 헬퍼 ──
  async function upsertUser(email, name, role) {
    if (protectedIds.size) {
      // 안전상 재확인: 절대 보호 유저 이메일과 겹치지 않음
    }
    const user = await prisma.user.upsert({
      where: { email },
      update: { name, role, password: hashedPw, isActive: true },
      create: { email, name, role, password: hashedPw, isActive: true },
    });
    counts.users++;
    return user;
  }

  // ── 1. 더미 유저 ──
  console.log("① 더미 유저 생성/갱신");
  const brandAUser = await upsertUser("brandA" + DUMMY_DOMAIN, "테스트브랜드A", "BRAND_ADMIN");
  const brandBUser = await upsertUser("brandB" + DUMMY_DOMAIN, "테스트브랜드B", "BRAND_ADMIN");
  const middleUser = await upsertUser("middle1" + DUMMY_DOMAIN, "테스트중간관리자", "MIDDLE_ADMIN");
  const sellerAUser = await upsertUser("sellerA" + DUMMY_DOMAIN, "테스트셀러A", "SELLER");
  const sellerBUser = await upsertUser("sellerB" + DUMMY_DOMAIN, "테스트셀러B", "SELLER");
  const sellerCUser = await upsertUser("sellerC" + DUMMY_DOMAIN, "테스트셀러C", "SELLER");
  const buyerAUser = await upsertUser("buyerA" + DUMMY_DOMAIN, "테스트구매자A", "BUYER");
  const buyerBUser = await upsertUser("buyerB" + DUMMY_DOMAIN, "테스트구매자B", "BUYER");

  // ── 2. 중간관리자 프로필 ──
  const middleProfile = await prisma.middleAdminProfile.upsert({
    where: { userId: middleUser.id },
    update: { name: "테스트중간관리자", isActive: true, isApproved: true },
    create: {
      userId: middleUser.id,
      name: "테스트중간관리자",
      isActive: true,
      isApproved: true,
      commissionRate: 5,
    },
  });
  counts.middleAdminProfiles++;

  // ── 3. 브랜드 프로필 ──
  const brandAProfile = await prisma.brandProfile.upsert({
    where: { userId: brandAUser.id },
    update: { brandName: "테스트브랜드A", isApproved: true },
    create: { userId: brandAUser.id, brandName: "테스트브랜드A", isApproved: true },
  });
  counts.brandProfiles++;
  // 브랜드B 는 중간관리자 소속
  const brandBProfile = await prisma.brandProfile.upsert({
    where: { userId: brandBUser.id },
    update: { brandName: "테스트브랜드B", isApproved: true, middleAdminId: middleProfile.id },
    create: {
      userId: brandBUser.id,
      brandName: "테스트브랜드B",
      isApproved: true,
      middleAdminId: middleProfile.id,
    },
  });
  counts.brandProfiles++;

  // ── 4. 셀러 프로필 ──
  async function upsertSeller(user, slug, shopName, opts = {}) {
    const p = await prisma.sellerProfile.upsert({
      where: { userId: user.id },
      update: { shopName, isApproved: true, ...opts },
      create: { userId: user.id, slug, shopName, isApproved: true, commissionRate: 5, ...opts },
    });
    counts.sellerProfiles++;
    return p;
  }
  const sellerA = await upsertSeller(sellerAUser, "test-seller-a", "테스트셀러A샵");
  const sellerB = await upsertSeller(sellerBUser, "test-seller-b", "테스트셀러B샵", {
    middleAdminId: middleProfile.id,
  });
  const sellerC = await upsertSeller(sellerCUser, "test-seller-c", "테스트셀러C샵");

  // ── 5. 구매자 프로필 ──
  for (const bu of [buyerAUser, buyerBUser]) {
    await prisma.buyerProfile.upsert({
      where: { userId: bu.id },
      update: {},
      create: { userId: bu.id },
    });
    counts.buyerProfiles++;
  }

  // ── 6. 카테고리(있으면 재사용) ──
  const skincareCat = await prisma.category.findFirst({ where: { slug: "skincare" } });

  // ── 7. 상품 upsert 헬퍼 ──
  console.log("② 더미 상품 생성/갱신");
  async function upsertProduct(slug, data) {
    const p = await prisma.product.upsert({
      where: { slug },
      update: { ...data },
      create: { slug, ...data },
    });
    counts.products++;
    return p;
  }

  // Case 1 — 셀러 직접 등록 (sellerId 지정, isApproved true)
  const prodSkincare = await upsertProduct("test-skincare-set", {
    name: "[TEST] 직접등록상품-스킨케어세트",
    description: "테스트용 셀러 직접등록 상품",
    basePrice: 35000,
    priceModel: "SUPPLY",
    sellerId: sellerA.id,
    categoryId: skincareCat?.id ?? null,
    isApproved: true,
    isActive: true,
  });
  const prodHaircare = await upsertProduct("test-haircare", {
    name: "[TEST] 직접등록상품-헤어케어",
    description: "테스트용 셀러 직접등록 상품",
    basePrice: 28000,
    priceModel: "SUPPLY",
    sellerId: sellerB.id,
    isApproved: true,
    isActive: true,
  });

  // Case 2A — 공급가(SUPPLY) 기반 (브랜드 → 셀러)
  const prodVitaminC = await upsertProduct("test-vitamin-c-serum", {
    name: "[TEST] 공급가상품-비타민C세럼",
    description: "테스트용 공급가 기반 상품(브랜드A)",
    basePrice: 45000,
    supplyPrice: 30000,
    priceModel: "SUPPLY",
    brandId: brandAProfile.id,
    isApproved: true,
    isActive: true,
  });
  const prodCollagen = await upsertProduct("test-collagen-cream", {
    name: "[TEST] 공급가상품-콜라겐크림",
    description: "테스트용 공급가 기반 상품(브랜드B + 중간관리자)",
    basePrice: 55000,
    supplyPrice: 38000,
    priceModel: "SUPPLY",
    brandId: brandBProfile.id,
    middleAdminId: middleProfile.id,
    isApproved: true,
    isActive: true,
  });

  // Case 2B — 수수료(COMMISSION) 기반 (브랜드 → 셀러)
  const prodAmpoule = await upsertProduct("test-premium-ampoule", {
    name: "[TEST] 수수료상품-프리미엄앰플",
    description: "테스트용 수수료 기반 상품(브랜드A, 셀러 커미션 30%)",
    basePrice: 78000,
    priceModel: "COMMISSION",
    commissionRate: 30,
    brandId: brandAProfile.id,
    isApproved: true,
    isActive: true,
  });

  // ── 8. 셀러 샵 상품 (SellerShopProduct) ──
  console.log("③ 셀러 샵 상품 신청/승인");
  async function upsertShopProduct(seller, product, sellerPrice, approverType, approverId) {
    await prisma.sellerShopProduct.upsert({
      where: { sellerId_productId: { sellerId: seller.id, productId: product.id } },
      update: { sellerPrice, isApproved: true, isActive: true, approverType, approverId },
      create: {
        sellerId: seller.id,
        productId: product.id,
        sellerPrice,
        isApproved: true,
        isActive: true,
        approverType,
        approverId,
      },
    });
    counts.shopProducts++;
  }
  // 2A: 셀러A가 비타민C 를 45000 으로 신청 → 브랜드A 승인
  await upsertShopProduct(sellerA, prodVitaminC, 45000, "BRAND_ADMIN", brandAProfile.id);
  // 2A: 셀러B가 콜라겐 55000 신청 → 중간관리자 승인
  await upsertShopProduct(sellerB, prodCollagen, 55000, "MIDDLE_ADMIN", middleProfile.id);
  // 2B: 셀러C가 앰플 신청 → 브랜드A 승인 (고정 판매가 78000)
  await upsertShopProduct(sellerC, prodAmpoule, 78000, "BRAND_ADMIN", brandAProfile.id);

  // ── 9. 주문 ──
  console.log("④ 더미 주문 생성");
  // 주문 정의: [주문번호, 구매자, 셀러, 상품, 단가, 수량, status, 결제일(paidAt)]
  //  - 완료(구매확정) 주문: status=CONFIRMED, paymentStatus=COMPLETED
  //    → 정산 집계 대상. 일부는 15일 전 백데이트하여 '정산 가능'으로 노출
  //  - 진행중 주문: status=PAID, paymentStatus=COMPLETED, 최근 결제
  const orderDefs = [
    // Case 1
    ["TESTORD-0001", buyerAUser, sellerA, prodSkincare, 35000, 2, "CONFIRMED", daysAgo(15)],
    ["TESTORD-0002", buyerBUser, sellerB, prodHaircare, 28000, 1, "CONFIRMED", daysAgo(15)],
    // Case 2A
    ["TESTORD-0003", buyerAUser, sellerA, prodVitaminC, 45000, 1, "CONFIRMED", daysAgo(15)],
    ["TESTORD-0004", buyerBUser, sellerB, prodCollagen, 55000, 2, "CONFIRMED", daysAgo(15)],
    // Case 2B
    ["TESTORD-0005", buyerAUser, sellerC, prodAmpoule, 78000, 1, "CONFIRMED", daysAgo(15)],
    // 진행중(PAID) 주문
    ["TESTORD-0006", buyerBUser, sellerA, prodSkincare, 35000, 1, "PAID", daysAgo(1)],
    ["TESTORD-0007", buyerAUser, sellerB, prodHaircare, 28000, 1, "PAID", daysAgo(1)],
  ];

  // 기존 더미 주문(정확히 이 주문번호들)만 삭제 후 재생성 (items 는 cascade)
  const orderNumbers = orderDefs.map((d) => d[0]);
  await prisma.order.deleteMany({ where: { orderNumber: { in: orderNumbers } } });

  for (const [orderNumber, buyer, seller, product, unitPrice, qty, status, paidAt] of orderDefs) {
    const amount = unitPrice * qty;
    await prisma.order.create({
      data: {
        orderNumber,
        userId: buyer.id,
        sellerId: seller.id,
        status,
        paymentStatus: "COMPLETED",
        totalAmount: amount,
        shippingFee: 0,
        discountAmount: 0,
        finalAmount: amount,
        shippingName: buyer.name,
        paymentMethod: "TEST",
        paidAt,
        createdAt: paidAt,
        items: {
          create: [
            {
              productId: product.id,
              productName: product.name,
              price: unitPrice,
              quantity: qty,
              totalPrice: amount,
            },
          ],
        },
      },
    });
    counts.orders++;
    counts.orderItems++;
  }

  // ── 결과 요약 ──
  console.log("\n✅ 더미 데이터 시드 완료");
  console.table(counts);

  // DB 실측 카운트
  const [uCnt, pCnt, sCnt, oCnt] = await Promise.all([
    prisma.user.count({ where: { email: { endsWith: DUMMY_DOMAIN } } }),
    prisma.product.count({ where: { name: { startsWith: "[TEST]" } } }),
    prisma.sellerShopProduct.count({
      where: { product: { name: { startsWith: "[TEST]" } } },
    }),
    prisma.order.count({ where: { orderNumber: { startsWith: "TESTORD-" } } }),
  ]);
  console.log("\n📊 DB 실측:");
  console.log(`   더미 유저(@dummy-test.com): ${uCnt}`);
  console.log(`   더미 상품([TEST]):          ${pCnt}`);
  console.log(`   셀러 샵 상품:               ${sCnt}`);
  console.log(`   더미 주문(TESTORD-):        ${oCnt}`);
  console.log(`\n🔐 더미 계정 비밀번호: ${PW_PLAIN}`);
}

main()
  .catch((e) => {
    console.error("❌ 오류:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
