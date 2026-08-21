// 결제수단 코드 → 한국어 라벨 매핑
// 결제 endpoint(seedpay/smartropay/ongi)에서 저장하는 Order.paymentMethod 값을 표시용으로 변환.
// 값 예시: CARD, BANK, VBANK, CELLPHONE, NAVER, KAKAO, PAYCO, LPAY, PINPAY,
//          SAMSUNGPAY, TOSS, LINEPAY, TMONEYPAY, APPLEPAY, EASYPAY
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CARD: "신용카드",
  BANK: "계좌이체",
  VBANK: "가상계좌",
  CELLPHONE: "휴대폰결제",
  PHONE: "휴대폰결제",
  NAVER: "네이버페이",
  NAVERPAY: "네이버페이",
  KAKAO: "카카오페이",
  KAKAOPAY: "카카오페이",
  PAYCO: "페이코",
  LPAY: "엘페이",
  PINPAY: "핀페이",
  SAMSUNGPAY: "삼성페이",
  TOSS: "토스",
  TOSSPAY: "토스페이",
  LINEPAY: "라인페이",
  TMONEYPAY: "티머니페이",
  APPLEPAY: "애플페이",
  EASYPAY: "간편결제",
};

/**
 * 결제수단 코드를 한국어 라벨로 변환한다.
 * 값이 없으면 "-", 매핑에 없는 값은 원본 문자열을 그대로 반환한다.
 */
export function paymentMethodLabel(method?: string | null): string {
  if (!method) return "-";
  const key = String(method).toUpperCase().trim();
  return PAYMENT_METHOD_LABELS[key] || method;
}
