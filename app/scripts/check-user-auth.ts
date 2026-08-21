/**
 * 특정 이메일의 가입 상태(로그인 방식)를 진단한다.
 *
 * 사용법:
 *   cd app
 *   npx tsx scripts/check-user-auth.ts foo@gmail.com
 *
 * "다른 방식으로 가입된 이메일입니다" (OAuthAccountNotLinked) /
 * "이미 일반 가입된 이메일입니다" (EmailExists) 팝업의 실제 원인을 확인한다.
 * 진단 로직은 lib/auth.ts 의 signIn 콜백과 동일하게 맞춰져 있다.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROVIDER_LABEL: Record<string, string> = {
  credentials: "일반(이메일+비밀번호)",
  kakao: "카카오",
  naver: "네이버",
  google: "구글",
};

function label(provider: string) {
  return PROVIDER_LABEL[provider] ?? provider;
}

async function main() {
  const email = process.argv[2]?.trim();
  if (!email) {
    console.error("❌ 이메일을 인자로 넘겨주세요.  예: npx tsx scripts/check-user-auth.ts foo@gmail.com");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { accounts: true },
  });

  console.log("\n──────────────────────────────────────────────");
  console.log(`🔎 조회 이메일: ${email}`);
  console.log("──────────────────────────────────────────────");

  if (!user) {
    console.log("✅ 해당 이메일로 가입된 User 없음 → 신규 가입 가능 (어떤 소셜/일반으로도 가입됨).");
    console.log("   ※ 카카오 로그인에서 막힌다면, 카카오가 준 '실제 이메일'이 아래 다른 이메일로");
    console.log("     이미 가입돼 있을 수 있습니다. 의심되는 이메일로 한 번 더 조회해보세요.");
    return;
  }

  console.log(`👤 User id     : ${user.id}`);
  console.log(`   name        : ${user.name}`);
  console.log(`   role        : ${user.role}`);
  console.log(`   isActive    : ${user.isActive}`);
  console.log(`   비밀번호    : ${user.password ? "있음 (일반 가입 가능)" : "없음 (OAuth 전용)"}`);
  console.log(`   생성일      : ${user.createdAt.toISOString()}`);

  const accounts = user.accounts ?? [];
  console.log(`\n🔗 연결된 OAuth 계정: ${accounts.length}개`);
  for (const a of accounts) {
    console.log(`   - ${label(a.provider)}  (provider=${a.provider}, providerAccountId=${a.providerAccountId})`);
  }

  // 이 User 가 가진 "로그인 가능한 방식" 요약
  const methods: string[] = [];
  if (user.password) methods.push("일반(비밀번호)");
  for (const a of accounts) methods.push(label(a.provider));

  console.log("\n──────────────────────────────────────────────");
  console.log("📋 진단");
  console.log("──────────────────────────────────────────────");
  console.log(`이 이메일은 다음 방식으로 로그인 가능: ${methods.length ? methods.join(", ") : "(없음 — 비정상 상태)"}`);

  const hasKakao = accounts.some((a: { provider: string }) => a.provider === "kakao");
  const hasOnlyCredentials = accounts.length === 0 && !!user.password;

  if (hasKakao) {
    console.log("✅ 카카오 계정이 이미 연결돼 있음 → 카카오 로그인 정상 동작해야 함.");
    console.log("   여전히 막힌다면 카카오가 주는 providerAccountId 가 위 값과 다른지 확인하세요.");
  } else if (hasOnlyCredentials) {
    console.log('⚠️  일반(비밀번호) 가입만 존재 → 카카오 로그인 시 "EmailExists"');
    console.log('   팝업 문구: "이미 일반 가입된 이메일입니다. 비밀번호로 로그인해주세요."');
  } else {
    console.log('⚠️  카카오 외 다른 소셜이 연결돼 있음 → 카카오 로그인 시 "OAuthAccountNotLinked"');
    console.log('   팝업 문구: "다른 방식으로 가입된 이메일입니다. 기존 가입 방식으로 로그인해주세요."');
    console.log(`   → 위에 표시된 방식(${methods.join(", ")})으로 로그인해야 합니다.`);
  }

  // placeholder 이메일 중복 가능성 안내
  if (email.endsWith("@no-email.local")) {
    console.log("\n💡 이 이메일은 카카오/네이버 이메일 미동의 시 생성되는 placeholder 입니다.");
    console.log("   사용자가 이후 이메일 동의를 하면 '실제 이메일'로 별도 계정이 갈라질 수 있습니다.");
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
