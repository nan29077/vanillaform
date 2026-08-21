// 금융기관 코드 — 쿠콘 입금이체PG 가이드 [참조1] (클라이언트 공용)
export const BANK_CODES: { code: string; name: string }[] = [
  { code: "002", name: "산업은행" },
  { code: "003", name: "기업은행" },
  { code: "004", name: "국민은행" },
  { code: "007", name: "수협은행" },
  { code: "011", name: "농협은행" },
  { code: "012", name: "지역농축협" },
  { code: "020", name: "우리은행" },
  { code: "023", name: "SC제일은행" },
  { code: "027", name: "씨티은행" },
  { code: "031", name: "대구은행" },
  { code: "032", name: "부산은행" },
  { code: "034", name: "광주은행" },
  { code: "035", name: "제주은행" },
  { code: "037", name: "전북은행" },
  { code: "039", name: "경남은행" },
  { code: "045", name: "새마을금고" },
  { code: "048", name: "신협" },
  { code: "050", name: "저축은행" },
  { code: "064", name: "산림조합" },
  { code: "071", name: "우체국" },
  { code: "081", name: "하나은행" },
  { code: "088", name: "신한은행" },
  { code: "089", name: "케이뱅크" },
  { code: "090", name: "카카오뱅크" },
  { code: "092", name: "토스뱅크" },
];

export function bankName(code: string): string {
  return BANK_CODES.find((b) => b.code === code)?.name ?? code;
}
