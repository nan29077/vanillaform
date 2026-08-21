# 정산/출금 시스템 문제점 및 수정 계획

> 2026-07-10 코드 감사 결과. 셀러 정산 흐름(주문 → `getSellerSettlementSummary` 집계 → `PayoutRequest` 출금 신청 → 최고관리자 승인/지급) 기준.
> 완료 시 체크박스를 갱신하고 수정 커밋을 기록한다.

## 🔴 심각 — 실제 금전 손실 가능

### 1. 이중 출금 가능 — [x] 완료 (2026-07-10)
- `lib/settlement.ts`: `withdrawableAmount = availableTotal - PAID 출금액`만 차감. REQUESTED/APPROVED 진행 중 출금 미차감.
- 셀러가 전액 출금 신청 후 지급 처리 전에 재신청 가능 → 관리자가 둘 다 지급하면 이중 지급.
- `api/seller/payouts` POST에 트랜잭션/락 없음 → 동시 요청 레이스.
- **수정**: 진행 중(REQUESTED/APPROVED) 출금도 가용 금액에서 차감 + 신청을 트랜잭션(셀러 행 `FOR UPDATE` 잠금)으로 직렬화.

### 2. 관리자 출금 처리에 상태 전이 검증 없음 — [x] 완료 (2026-07-10)
- `api/admin/payouts` POST가 현재 상태 확인 없이 상태를 덮어씀.
- PAID 건을 REJECTED로 바꾸면 지급된 금액이 가용 금액으로 되살아나 재출금 가능. REJECTED 건 재지급도 가능.
- 지급(pay) 시점에 셀러 가용 잔액 재검증 없음.
- **수정**: 전이 규칙 강제(approve: REQUESTED만 / pay: REQUESTED·APPROVED만 / reject: REQUESTED·APPROVED만) + pay 시 잔액 재검증.

### 3. 출금-주문 연결(스냅샷) 부재 — [x] 부분 완료 (2026-07-10)
- `PayoutRequest`는 총액만 저장. 어떤 주문 정산분이 어느 출금에 포함됐는지 기록 없음.
- 수수료율(`SellerProfile.commissionRate`, `PlatformFeeSettings`)·`Product.supplyPrice`·`Product.commissionRate` 변경 시 과거 주문 정산액이 소급 재계산됨 (OrderItem 가격만 스냅샷, 나머지는 현재 값 참조).
- 지급 후 주문 취소 시 가용 금액만 소급 감소 → 과지급 상태가 `Math.max(0,...)` 클램프에 가려져 인지 불가.
- **수정**: 출금 시점 주문 목록+정산액 고정 저장(조인 테이블 또는 `Settlement` 모델 활용). 스키마 변경 → 운영 DB 주의.
- **진행 (2026-07-10)**: `PayoutRequestOrder` 테이블 추가. 출금 신청 시 정산일 빠른 주문부터 FIFO로 배분해 주문별 정산액/배분액을 스냅샷으로 기록.
- **남은 것**: ① 가용 금액 계산 자체는 여전히 라이브 재계산(수수료율 변경 시 소급 영향 잔존 — 근본 해결은 주문 시점 요율 스냅샷 필요) ② 스냅샷 도입 이전의 기존 출금 건에는 배분 기록이 없어 FIFO 기준점이 근사치 ③ 관리자/셀러 화면에 출금별 포함 주문 내역 표시.
- **실제 발생 확인 (2026-07-12)**: 셀러 김혜선의 7/10 출금신청액이 5,727,076원(39건)이었는데, 동일한 39건을 7/12에 재계산하니 5,863,583원. 정산 기준액 6,204,850원에 요율을 대입하면 7%(실효 7.7%)→5,727,076원, 5%(실효 5.5%)→5,863,583원으로 원 단위까지 일치. 즉 그 사이 `SellerProfile.commissionRate`가 7%→5%로 변경되면서 **이미 판매가 끝난 6월 주문의 정산액이 소급 재계산됨**(차액 136,507원). 운영 판단으로 5% 적용해 지급하기로 결정. 요율 스냅샷이 없으면 이 문제는 요율을 바꿀 때마다 재발한다.

### 4. `Settlement` 모델이 실제 플로우와 단절 — [x] 부분 완료 (2026-07-10, cancel-request 판단 로직 교체 완료 / 실제 정산금 차감은 이슈 3 스냅샷과 함께 진행)
- `prisma.settlement`은 seed 라우트에서만 생성. 운영 플로우에서 생성 안 됨.
- `api/orders/[id]/cancel-request`가 이 빈 테이블로 `cancelFromSettlement`(정산금 차감 가능 여부)를 판단 → 운영에서 항상 0.
- `cancelFromSettlement=true`여도 실제 정산금 차감 로직이 어디에도 없음(플래그/배지 표시뿐).
- **수정**: `getSellerSettlementSummary` 기반 실제 가용 금액으로 판단 교체. 실제 차감은 이슈 3의 스냅샷과 함께 설계.

### 9. 셀러가 사업자 여부를 스스로 선택해 원천징수 3.3% 회피 가능 — [x] 완료 (2026-07-12)
- `api/seller/payouts` POST가 클라이언트 body의 `isBusiness`를 그대로 신뢰(`typeof isBusiness === "boolean" ? isBusiness : profileIsBusiness`).
- 셀러 화면(`SellerSettlementClient`)의 사업자/개인 버튼은 셀러가 자유롭게 선택 가능 → 비사업자가 "사업자"로 신청하면 원천징수 0원.
- 미징수된 소득세는 플랫폼이 국세청에 대신 부담하게 됨. (김혜선 건 기준 193,498원)
- **수정**: 서버가 `SellerProfile.isBusinessOperator || businessType === "business"` 로만 판정하고 클라이언트 값은 무시. 화면의 토글은 프로필 값 표시(읽기 전용)로 변경해 원천징수 미리보기가 실제 지급액과 일치하도록 함.

## 🗄️ 운영 DB 스키마 드리프트 — 2026-07-12

### 10. `liveSiteSettings` 미반영으로 셀러 정산 페이지가 통째로 죽음 — [x] 완료 (2026-07-12)
- 커밋 `8b6c241`이 `SellerProfile.liveSiteSettings`, `Product.coupangLowestPrice/naverLowestPrice`를 스키마에 추가했으나 운영 DB에 미반영.
- `seller/settlements/page.tsx`가 `select` 없이 `sellerProfile.findUnique`를 호출 → Prisma가 없는 컬럼까지 SELECT → P2022.
- 해당 코드의 `catch { redirect("/") }` 가 에러를 삼켜서 **셀러는 아무 안내 없이 홈으로 튕김** → 출금 신청 자체가 불가능했음.
- **수정**: `migrate diff`로 비파괴(nullable 컬럼 3개 ADD)임을 확인 후 운영 DB에 ALTER 적용. 적용 후 drift 없음(`migrate diff` = empty).
- **교훈**: `select` 없는 전체 조회는 스키마 드리프트에 취약하다. 스키마 변경 커밋은 반드시 DB 반영과 함께 배포할 것.

## 🟡 중간 — 정합성/회계 문제

### 5. 취소 요청 중 주문이 출금 가능 금액에 포함 — [x] 완료 (2026-07-10)
- 정산 집계가 `Order.status`만 확인. 취소 요청은 `cancelStatus`만 세우고 `status`는 승인 시점에야 CANCELLED.
- 취소 요청 걸린 주문의 정산금을 승인 전에 출금 가능 → 취소 승인 후 회수 불가.
- **수정**: `cancelStatus`가 REQUESTED/DEPOSIT_CONFIRMED/APPROVED인 주문은 가용 집계에서 제외.

### 6. 취소 승인 시 연관 커미션 미정리 — [x] 완료 (2026-07-10)
- `cancel-approve`가 주문만 CANCELLED 처리. `MiddleAdminCommission`/`ReferralCommission`/`MentorCommission`은 그대로 남아 별도 정산 경로에서 지급될 수 있음.
- **수정**: 취소 승인 시 트랜잭션으로 세 커미션의 미지급분(PENDING/CONFIRMED)을 CANCELLED 처리. 이미 지급(PAID)된 커미션은 건드리지 않음(회수는 수동).

### 7. PayoutRequest 금액 필드 Float — [x] 완료 (2026-07-10)
- `commissionAmount`/`withholdingTaxAmount`/`actualPayoutAmount`/`commissionRate`가 Float (같은 모델의 amount/netAmount는 Decimal). 부동소수점 오차 누적 가능.
- **수정**: Decimal 통일 완료. `prisma migrate diff`로 비파괴(MODIFY) 확인 후 `db push` 반영.

## 💳 결제(PG) 콜백 — 2026-07-10 재점검에서 발견

### 8. 스마트로 중복 콜백이 결제완료 주문을 취소로 덮어씀 — [x] 완료 (2026-07-10)
- seedpay `/result`에는 멱등성 가드(이미 COMPLETED면 무시)가 있었으나 smartropay `/result`에는 없어, 중복 콜백/취소 콜백이 정상 결제 주문을 CANCELLED/FAILED로 덮어쓸 수 있었음.
- **수정**: 상단 멱등성 가드 + `markOrderFailed` 내부 가드를 seedpay와 동일하게 적용.

### 재점검에서 이상 없음을 확인한 항목
- 주문 생성(`api/orders`): 가격·할인·배송비 전부 서버 DB 기준 계산, 클라이언트 금액 무시 ✓
- seedpay/smartropay 콜백: 주문 금액과 PG 결제 금액 교차 검증(AMOUNT_MISMATCH) ✓
- ongi 콜백·abort: 결제완료 주문 보호 가드 존재 ✓
- seedpay: signData 불일치 시 경고 로그만 남기고 진행 — 승인 단계 해시 검증 + 금액 교차 검증이 있어 위험도 낮으나, 차단으로 강화 검토 여지 있음 (미수정)

## 🟢 낮음 — 개선 권장

- 상품 하드 삭제 시 해당 아이템 정산액이 조용히 0 처리 (`productInfoMap` 미스).
- 정산 요약이 매 조회마다 셀러 전체 주문 풀스캔. `Order`에 `(sellerId, paymentStatus, status)` 복합 인덱스 없음.
- 공휴일 표(`lib/businessDays.ts`)가 2030년까지만 존재 — 이후 음력 명절이 영업일로 계산됨.
- `PayoutRequest.orderCount`가 출금액과 무관하게 신청 시점 가용 주문 수를 저장 (의미 불명확).
