// 영업일(Business Day) 계산 유틸.
// - 정산일: 판매(결제완료) 기준일로부터 "영업일 기준 N일 후" 날짜를 산출.
// - 영업일 = 토·일·한국 공휴일을 제외한 날.
// - 한국 공휴일: 고정 양력 공휴일(알고리즘) + 음력 명절/석가탄신일(연도별 표) + 대체공휴일(규칙).
// - prisma 등 서버 전용 의존성이 없어 서버/클라이언트 양쪽에서 import 가능.
//
// 음력 공휴일은 정확한 음→양 변환 대신 2024~2030년 범위의 확정 양력 날짜 표를 사용한다.
// (요구사항: "음력 설/추석 ... 가능한 범위"). 표에 없는 연도는 고정 공휴일만 적용된다.

// ── 날짜 헬퍼 (로컬 타임존 기준, KST 환경 전제) ────────────────
export function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 시각 정보를 버리고 그 날 0시로 정규화한 새 Date 반환
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── 음력 명절·석가탄신일 양력 날짜표 (2024~2030) ──────────────
// 각 항목은 해당 공휴일이 실제로 쉬는 양력 날짜(설날/추석은 연휴 3일 포함).
// 대체공휴일은 아래 substitute 규칙에서 별도 계산하므로 여기엔 본 공휴일만 둔다.
const LUNAR_HOLIDAYS: Record<number, string[]> = {
  2024: [
    "2024-02-09", "2024-02-10", "2024-02-11", // 설날 연휴
    "2024-05-15", // 부처님오신날
    "2024-09-16", "2024-09-17", "2024-09-18", // 추석 연휴
  ],
  2025: [
    "2025-01-28", "2025-01-29", "2025-01-30", // 설날 연휴
    "2025-05-05", // 부처님오신날 (어린이날과 겹침)
    "2025-10-05", "2025-10-06", "2025-10-07", // 추석 연휴
  ],
  2026: [
    "2026-02-16", "2026-02-17", "2026-02-18", // 설날 연휴
    "2026-05-24", // 부처님오신날
    "2026-09-24", "2026-09-25", "2026-09-26", // 추석 연휴
  ],
  2027: [
    "2027-02-06", "2027-02-07", "2027-02-08", // 설날 연휴
    "2027-05-13", // 부처님오신날
    "2027-09-14", "2027-09-15", "2027-09-16", // 추석 연휴
  ],
  2028: [
    "2028-01-26", "2028-01-27", "2028-01-28", // 설날 연휴
    "2028-05-02", // 부처님오신날
    "2028-10-02", "2028-10-03", "2028-10-04", // 추석 연휴 (개천절과 겹침)
  ],
  2029: [
    "2029-02-12", "2029-02-13", "2029-02-14", // 설날 연휴
    "2029-05-20", // 부처님오신날
    "2029-09-21", "2029-09-22", "2029-09-23", // 추석 연휴
  ],
  2030: [
    "2030-02-02", "2030-02-03", "2030-02-04", // 설날 연휴
    "2030-05-09", // 부처님오신날
    "2030-09-11", "2030-09-12", "2030-09-13", // 추석 연휴
  ],
};

// 대체공휴일 적용 대상 (양력 고정 공휴일 중)
// 삼일절·어린이날·광복절·개천절·한글날·성탄절은 토/일/타공휴일과 겹치면 대체공휴일 발생.
// 신정·현충일은 대체공휴일 대상이 아니다.
interface FixedHoliday {
  mmdd: string; // "MM-DD"
  name: string;
  substitute: boolean;
}

const FIXED_HOLIDAYS: FixedHoliday[] = [
  { mmdd: "01-01", name: "신정", substitute: false },
  { mmdd: "03-01", name: "삼일절", substitute: true },
  { mmdd: "05-05", name: "어린이날", substitute: true },
  { mmdd: "06-06", name: "현충일", substitute: false },
  { mmdd: "08-15", name: "광복절", substitute: true },
  { mmdd: "10-03", name: "개천절", substitute: true },
  { mmdd: "10-09", name: "한글날", substitute: true },
  { mmdd: "12-25", name: "성탄절", substitute: true },
];

// 음력 표에서 대체공휴일 대상(설날·추석·부처님오신날)은 모두 substitute=true.
// (설/추석은 3일 연휴 중 일요일/중복과 겹치면 대체 발생)

// 연도별 공휴일 집합 캐시
const holidayCache: Record<number, Set<string>> = {};

function dateFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// 해당 연도의 모든 공휴일(대체공휴일 포함) 양력 날짜 집합("YYYY-MM-DD")
export function getKoreanHolidays(year: number): Set<string> {
  if (holidayCache[year]) return holidayCache[year];

  // substitute 대상 여부를 함께 보관
  const eligible = new Set<string>(); // 대체공휴일 대상인 본 공휴일 날짜
  const base = new Set<string>();

  for (const h of FIXED_HOLIDAYS) {
    const ymd = `${year}-${h.mmdd}`;
    base.add(ymd);
    if (h.substitute) eligible.add(ymd);
  }
  for (const ymd of LUNAR_HOLIDAYS[year] ?? []) {
    base.add(ymd);
    eligible.add(ymd); // 음력 명절·석탄일은 모두 대체 대상
  }

  // 대체공휴일 계산:
  // 대상 공휴일이 일요일이거나(설/추석은 일요일), 다른 공휴일과 겹치면
  // 그 다음 "공휴일이 아닌 평일"을 대체공휴일로 지정한다.
  // (현행 한국 규정 근사: 토요일도 대체 대상에 포함 — 어린이날·광복절·개천절 등)
  const result = new Set(base);
  const sorted = Array.from(eligible).sort();
  for (const ymd of sorted) {
    const date = dateFromYmd(ymd);
    const dow = date.getDay(); // 0=일,6=토
    // 토/일이거나, 같은 날 다른 공휴일이 있을 때(겹침) 대체 발생
    const overlaps =
      dow === 0 ||
      dow === 6 ||
      // 다른 본 공휴일과 같은 날인지: base에는 한 키만 들어가므로
      // 겹침은 음력+고정이 같은 날일 때만 의미. 그 경우는 한 항목으로 합쳐지므로
      // 일/토 판정으로 충분하지만, 평일 겹침(예: 어린이날=석탄일)도 대체 발생시킨다.
      false;

    // 평일 겹침 판정: 동일 mmdd가 fixed와 lunar 양쪽에 존재하는지
    const isWeekdayOverlap = FIXED_HOLIDAYS.some(
      (f) => `${year}-${f.mmdd}` === ymd && f.substitute,
    )
      ? (LUNAR_HOLIDAYS[year] ?? []).includes(ymd)
      : false;

    if (overlaps || isWeekdayOverlap) {
      // 다음 평일·비공휴일 찾기
      let cursor = new Date(date);
      // 같은 연휴 안에서 연속 대체가 일어나도 잘 동작하도록 result 기준으로 탐색
      do {
        cursor.setDate(cursor.getDate() + 1);
      } while (
        cursor.getDay() === 0 ||
        cursor.getDay() === 6 ||
        result.has(toYmd(cursor))
      );
      result.add(toYmd(cursor));
    }
  }

  holidayCache[year] = result;
  return result;
}

// 한국 공휴일 여부 (주말 제외, 순수 공휴일만)
export function isKoreanHoliday(date: Date): boolean {
  return getKoreanHolidays(date.getFullYear()).has(toYmd(date));
}

// 영업일 여부 (토·일·공휴일이 아니면 true)
export function isBusinessDay(date: Date): boolean {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return false;
  return !isKoreanHoliday(date);
}

// 기준일(saleDate)로부터 "영업일 기준 N일 후" 날짜를 반환.
// N=0 이면 기준일 당일(0시 정규화)을 반환.
// N>=1 이면 기준일 다음날부터 세어 N번째 영업일을 반환.
export function addBusinessDays(saleDate: Date, n: number): Date {
  const cursor = startOfDay(saleDate);
  if (n <= 0) return cursor;
  let counted = 0;
  while (counted < n) {
    cursor.setDate(cursor.getDate() + 1);
    if (isBusinessDay(cursor)) counted++;
  }
  return cursor;
}

// 정산 가능일 = 판매일 + 영업일 N일
export function getSettlementDate(saleDate: Date, businessDays: number): Date {
  return addBusinessDays(saleDate, businessDays);
}

// 두 날짜가 같은 '일자'인지 (시각 무시)
export function isSameYmd(a: Date, b: Date): boolean {
  return toYmd(a) === toYmd(b);
}
