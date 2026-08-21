// 한국 공휴일 / 영업일 계산 공개 API.
//
// 실제 구현·공휴일 데이터(2024~2030 고정 양력 + 음력 명절/석가탄신일 + 대체공휴일)는
// 이미 lib/businessDays.ts 에 존재하며, 정산 로직(lib/settlement.ts)과
// 정산 캘린더 UI(components/seller/SellerSettlementClient.tsx)에서 사용 중이다.
//
// 이 파일은 공휴일/영업일 유틸의 진입점(@/lib/koreanHolidays)을 제공하기 위한 얇은 재노출 레이어다.
// 공휴일 데이터를 이중으로 관리하면 두 표가 서로 어긋날 수 있으므로,
// 데이터는 businessDays.ts 한 곳에서만 관리하고 여기서는 재노출만 한다.

export {
  // 공휴일 여부 확인: 토·일 제외, 순수 공휴일만 true
  isKoreanHoliday,
  // 해당 연도 전체 공휴일(대체공휴일 포함) 양력 날짜 집합("YYYY-MM-DD")
  getKoreanHolidays,
  // 영업일 여부: 토·일·공휴일이 아니면 true
  isBusinessDay,
  // 기준일로부터 "영업일 기준 days일 후" 날짜 반환(토·일·공휴일 제외)
  addBusinessDays,
  // 정산 가능일 = 판매일 + 영업일 businessDays일
  getSettlementDate,
  // 날짜 헬퍼
  toYmd,
  startOfDay,
  isSameYmd,
} from "@/lib/businessDays";
