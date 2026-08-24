/**
 * 목록 API 의 page/limit 같은 숫자 쿼리 파라미터 정규화 유틸.
 *
 * parseInt 결과를 그대로 쓰면
 *  - `?page=abc`  → NaN → `skip: NaN` 으로 Prisma 예외
 *  - `?page=-5`   → 음수 skip 으로 Prisma 예외
 *  - `?limit=1e9` → 테이블 전체를 한 번에 읽어오는 DoS
 * 가 가능하다. 모든 목록 API 는 이 함수를 거쳐 값을 받는다.
 */
export function clampInt(
  raw: string | null | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw == null || raw === "") return fallback;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/** 목록 API 기본 페이지 크기 상한 */
export const MAX_PAGE_LIMIT = 100;
