/**
 * SellerProfile.totalFans 백필 스크립트
 *
 * 사용법:
 *   cd app
 *   npx tsx scripts/backfill-total-fans.ts                      # 전체 dry-run (DB 변경 없음)
 *   npx tsx scripts/backfill-total-fans.ts --slug=byjoo2025     # 특정 셀러만 dry-run
 *   npx tsx scripts/backfill-total-fans.ts --slug=byjoo2025 --apply   # 특정 셀러만 실제 반영
 *   npx tsx scripts/backfill-total-fans.ts --apply              # 전체 실제 반영
 *
 *   --slug 을 주면 해당 셀러만 대상으로 삼는다. 시드로 만든 데모 계정의 큰 숫자를
 *   유지하면서 실제 운영 셀러만 교정하고 싶을 때 사용한다.
 *
 * 배경:
 *   totalFans 는 prisma/seed.ts 가 넣은 더미 기준선(15420 / 23100 / 8750 / 5300)이
 *   그대로 남아 있는 비정규화 컬럼이다. 증감 로직(Pick·라이브 팔로우·레퍼럴 가입·
 *   인증 거절 차감)은 정상이므로, 기준선만 실제 값으로 한 번 맞추면 된다.
 *
 *   이 컬럼은 셀러 목록·검색·큐레이션·브랜드 캠페인 셀러 선택의 정렬 기준
 *   (orderBy totalFans desc)이라, 어긋나 있으면 노출 순위가 왜곡된다.
 *
 * 집계 기준:
 *   lib/sellerFans.ts 의 getSellerFanCount 와 동일하게
 *   팔로워(Pick) ∪ 추천인 유입 ∪ 주력팬 을 buyerId 기준으로 중복 제거해 센다.
 *   (팬 관리 화면이 목록으로 보여주는 모집단과 같다)
 */
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const SLUG = process.argv.find((a) => a.startsWith("--slug="))?.slice("--slug=".length) ?? null;

async function main() {
  const sellers = await prisma.sellerProfile.findMany({
    where: SLUG ? { slug: SLUG } : {},
    select: { id: true, shopName: true, slug: true, totalFans: true },
    orderBy: { totalFans: "desc" },
  });

  if (SLUG && sellers.length === 0) {
    console.error(`slug "${SLUG}" 에 해당하는 셀러를 찾지 못했습니다. 중단합니다.`);
    process.exit(1);
  }
  if (SLUG) console.log(`\n대상 한정: slug="${SLUG}" (${sellers.length}명)`);

  const rows: {
    shopName: string;
    slug: string | null;
    현재: number;
    실제: number;
    차이: number;
  }[] = [];

  for (const s of sellers) {
    const [followers, referred, primary] = await Promise.all([
      prisma.sellerFollower.findMany({ where: { sellerId: s.id }, select: { buyerId: true } }),
      prisma.buyerProfile.findMany({ where: { referredBySellerId: s.id }, select: { id: true } }),
      prisma.buyerProfile.findMany({ where: { primarySellerId: s.id }, select: { id: true } }),
    ]);

    const buyerIds = new Set<string>();
    for (const f of followers) buyerIds.add(f.buyerId);
    for (const b of referred) buyerIds.add(b.id);
    for (const b of primary) buyerIds.add(b.id);

    const actual = buyerIds.size;
    rows.push({
      shopName: s.shopName,
      slug: s.slug,
      현재: s.totalFans,
      실제: actual,
      차이: actual - s.totalFans,
    });

    if (APPLY && actual !== s.totalFans) {
      await prisma.sellerProfile.update({
        where: { id: s.id },
        data: { totalFans: actual },
      });
    }
  }

  const changed = rows.filter((r) => r.차이 !== 0);

  console.log(`\n총 셀러 ${rows.length}명 / 변경 대상 ${changed.length}명\n`);
  console.table(rows);

  if (changed.length > 0) {
    console.log("\n── 변경 대상만 ──");
    console.table(changed);
    const totalDelta = changed.reduce((sum, r) => sum + r.차이, 0);
    console.log(`합계 증감: ${totalDelta.toLocaleString()}`);
  }

  console.log(
    APPLY
      ? "\n✅ --apply 지정됨 — 위 변경을 DB에 반영했습니다."
      : "\n🔍 DRY-RUN — DB를 변경하지 않았습니다. 실제 반영하려면 --apply 를 붙여 실행하세요.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
