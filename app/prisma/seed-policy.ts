import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

// 라이브 셀러샵 표준 정책 — 최고관리자 "사이트관리 > 라이브 셀러샵 정책"에서 관리하는 기본값.
// Setting(key/value) 테이블에 upsert 한다.
// 표시 위치:
//   - refundPolicy  → 상품 상세 "배송/교환" 탭 (ProductDetailTabs)
//   - shippingPolicy→ 상품 상세 "배송/교환" 탭 (ProductDetailTabs)
//   - usagePolicy   → 셀러샵 풋터 "이용 안내" (SellerShopFooter)
const POLICIES: Record<string, string> = {
  refundPolicy: `교환·환불 규정

1. 교환·환불 신청 기간
   - 상품 수령 후 7일 이내 신청 가능합니다.
   - 단순 변심에 의한 반품은 상품 수령 후 7일 이내에만 가능합니다.

2. 교환·환불 불가 사유
   - 고객의 책임 있는 사유로 상품이 훼손된 경우
   - 상품 사용 또는 일부 소비로 상품 가치가 감소한 경우
   - 포장을 개봉하여 상품 가치가 현저히 감소한 경우
   - 시간 경과로 재판매가 곤란한 경우

3. 교환·환불 절차
   - 셀러샵 내 주문 내역에서 교환/환불 신청
   - 셀러 확인 후 처리 (영업일 기준 3~5일 소요)
   - 환불은 결제 수단으로 원래 결제금액 환불

4. 반품 배송비
   - 단순 변심: 고객 부담 (편도 3,000원)
   - 상품 하자·오배송: 판매자 부담`,

  shippingPolicy: `배송 정책

1. 배송 방법
   - 택배 배송 (CJ대한통운, 로젠택배 등)
   - 도서·산간 지역은 추가 배송비가 발생할 수 있습니다.

2. 배송 기간
   - 결제 완료 후 영업일 기준 1~3일 이내 출고
   - 출고 후 1~2일 내 수령 (도서·산간 지역 제외)
   - 공휴일 및 연휴에는 배송이 지연될 수 있습니다.

3. 배송비
   - 기본 배송비: 3,000원
   - 50,000원 이상 구매 시 무료배송
   - 제주 및 도서·산간 지역: 추가 배송비 3,000~5,000원

4. 배송 조회
   - 출고 완료 후 문자(SMS)로 송장번호 안내
   - 셀러샵 주문 내역에서 배송 현황 조회 가능`,

  usagePolicy: `이용 안내

1. 회원가입 및 로그인
   - 바닐라폼는 시청자 회원 가입 후 이용 가능합니다.
   - 소셜 로그인(카카오, 네이버 등) 또는 이메일로 가입할 수 있습니다.

2. 주문 및 결제
   - 상품 선택 → 옵션 선택 → 장바구니 또는 바로 구매
   - 결제 수단: 신용/체크카드, 가상계좌, 무통장입금
   - 주문 완료 후 주문 확인 이메일이 발송됩니다.

3. 공동구매 캠페인
   - 공동구매는 목표 수량 달성 시 할인 적용됩니다.
   - 캠페인 기간 내 목표 미달성 시 자동 취소 및 전액 환불됩니다.

4. 라이브 커머스
   - 라이브 방송 중 특가 상품을 구매할 수 있습니다.
   - 라이브 전용 쿠폰 및 할인 혜택이 제공될 수 있습니다.

5. 고객센터
   - 이용 문의: 셀러샵 내 1:1 문의 또는 이메일 문의
   - 운영 시간: 평일 09:00 ~ 18:00 (점심 12:00 ~ 13:00 제외)
   - 주말 및 공휴일 휴무`,
};

async function main() {
  console.log("🌱 라이브 셀러샵 표준 정책 시드 시작...");

  for (const [key, value] of Object.entries(POLICIES)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    console.log(`  ✔ ${key} 저장 완료 (${value.length}자)`);
  }

  console.log("✅ 정책 시드 완료");
}

main()
  .catch((e) => {
    console.error("❌ 정책 시드 실패:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
