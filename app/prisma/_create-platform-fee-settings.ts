// platform_fee_settings 테이블 생성 + 기본 레코드 1건 삽입 (prisma db push 대신 raw SQL)
// 실행: npx tsx prisma/_create-platform-fee-settings.ts
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS platform_fee_settings (
      id INT NOT NULL AUTO_INCREMENT,
      sellerFeeRate DECIMAL(5,2) NOT NULL DEFAULT 5.00,
      middleAdminFeeRate DECIMAL(5,2) NOT NULL DEFAULT 5.00,
      brandFeeRate DECIMAL(5,2) NOT NULL DEFAULT 5.00,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    )
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO platform_fee_settings (sellerFeeRate, middleAdminFeeRate, brandFeeRate)
    SELECT 5.00, 5.00, 5.00
    WHERE NOT EXISTS (SELECT 1 FROM platform_fee_settings)
  `);

  const rows = await prisma.$queryRawUnsafe(`SELECT * FROM platform_fee_settings`);
  console.log("platform_fee_settings:", rows);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
