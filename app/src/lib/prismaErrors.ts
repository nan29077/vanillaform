// Prisma 오류 판별 유틸
// 스키마 변경이 DB/클라이언트에 아직 반영되지 않은 상태에서 나는 오류를 감지한다:
// - P2021: 테이블 없음 / P2022: 컬럼 없음 → DB에 prisma db push 미실행
// - PrismaClientValidationError: 재생성 전 구형 Prisma Client 가 새 필드를 모르는 경우
//   (dev 서버가 이전 클라이언트를 캐시 중일 때 발생, 서버 재시작으로 해소)
// 이 경우 500 대신 기능별 폴백으로 우아하게 처리한다.
export function isMissingDbColumnError(e: unknown): boolean {
  const err = e as { code?: string; name?: string } | null;
  if (!err) return false;
  if (err.code === "P2021" || err.code === "P2022") return true;
  if (err.name === "PrismaClientValidationError") return true;
  return false;
}

export const DB_MIGRATION_WARNING =
  "서버 DB에 새 스키마(youtubeApiKey 컬럼 등)가 아직 반영되지 않았습니다. app 디렉토리에서 'npx prisma db push' 실행 후 dev 서버를 재시작하고 다시 저장해 주세요.";
