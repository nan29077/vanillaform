/**
 * 기존 유저 아바타 소급 적용 스크립트
 *
 * 사용법:
 *   cd app
 *   npx tsx scripts/apply-avatars.ts
 *
 * image 필드가 /avatars/ 경로로 시작하지 않는 유저에게
 * 역할/성별에 맞는 새 아바타를 배정하고 DB를 업데이트한다.
 */
import { PrismaClient } from "../src/generated/prisma";
import { getRandomAvatar } from "../src/lib/avatars";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, role: true, gender: true, image: true, avatar: true },
  });

  const stats: Record<string, number> = {};
  let skipped = 0;
  let updated = 0;

  for (const user of users) {
    const currentImage = user.image ?? user.avatar ?? null;

    // 이미 새 아바타 경로이면 skip
    if (currentImage && currentImage.startsWith("/avatars/")) {
      skipped++;
      continue;
    }

    // 성별 변환: DB는 "male"/"female" (소문자) → getRandomAvatar는 "MALE"/"FEMALE"
    const genderUpper =
      user.gender === "male"
        ? "MALE"
        : user.gender === "female"
        ? "FEMALE"
        : null;

    const newAvatar = getRandomAvatar(user.role, genderUpper);

    await prisma.user.update({
      where: { id: user.id },
      data: { image: newAvatar, avatar: newAvatar },
    });

    stats[user.role] = (stats[user.role] ?? 0) + 1;
    updated++;
  }

  console.log("\n✅ 아바타 소급 적용 완료");
  console.log(`   총 유저: ${users.length}명`);
  console.log(`   업데이트: ${updated}명`);
  console.log(`   스킵(이미 적용됨): ${skipped}명`);
  console.log("\n역할별 업데이트 수:");
  for (const [role, count] of Object.entries(stats).sort()) {
    console.log(`   ${role}: ${count}명`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
