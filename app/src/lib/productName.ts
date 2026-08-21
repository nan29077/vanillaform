/**
 * 셀러 화면용 상품명 포맷.
 *
 * 상품명 끝에 "(브랜드명 + 중간관리자이름)" 형태가 붙어 있는 경우
 * - 중간관리자 상품(middleAdminId 있음): "(중간관리자이름)" 만 남긴다
 * - 브랜드 직접 등록 상품(middleAdminId 없음): "(브랜드명)" 만 남긴다
 * 패턴에 해당하지 않으면 원본 그대로 반환한다.
 *
 * 주의: 이 접미사는 코드가 붙이는 게 아니라 등록자가 직접 타이핑하는 관례라
 * 괄호 안의 "+" 만으로 판별하면 "(1+1)", "(2+1)" 같은 수량 표기까지 접미사로
 * 오인한다. 실제로 "…150ml(1+1)" 이 셀러 화면에서 "…150ml (1)" 로 잘려
 * 브랜드가 1+1 로 바꾼 상품명이 수정 전 이름처럼 보이는 문제가 있었다.
 * 그래서 양쪽 조각이 모두 "이름처럼 보일 때"(한글/영문 포함)만 접미사로 취급한다.
 */
// 브랜드명·중간관리자명은 최소 한 글자 이상의 한글/영문을 포함한다.
// "1", "2" 같은 수량 토큰은 여기에 걸리지 않으므로 접미사로 오인되지 않는다.
const NAME_LIKE = /[가-힣ㄱ-ㅎA-Za-z]/;

export function formatProductNameForSeller(name: string, middleAdminId: string | null): string {
  const match = name.match(/^(.*?)\s*\(([^+)]+?)\s*\+\s*([^)]+?)\s*\)\s*$/);
  if (match) {
    const baseName = match[1].trimEnd();
    const brandPart = match[2].trim();
    const middlePart = match[3].trim();
    if (!NAME_LIKE.test(brandPart) || !NAME_LIKE.test(middlePart)) return name;
    return middleAdminId
      ? `${baseName} (${middlePart})`
      : `${baseName} (${brandPart})`;
  }
  return name;
}
