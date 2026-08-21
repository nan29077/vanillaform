# 바닐라폼 운영 정책 & 기능 정의

> 코드 기준: `app/prisma/schema.prisma` + API 라우트 실측  
> 마지막 업데이트: 2026-07-05

---

## 목차

1. [계정 유형 체계](#1-계정-유형-체계)
2. [계정 유형별 정산 프로세스](#2-계정-유형별-정산-프로세스)
3. [계정 유형별 상품 등록 프로세스](#3-계정-유형별-상품-등록-프로세스)
4. [계정 유형별 상품 노출 프로세스](#4-계정-유형별-상품-노출-프로세스)
5. [공동구매 캠페인 운영 프로세스](#5-공동구매-캠페인-운영-프로세스)
6. [레퍼럴 및 커미션 체계](#6-레퍼럴-및-커미션-체계)
7. [노드/중간관리자 계층 구조](#7-노드중간관리자-계층-구조)

---

## 1. 계정 유형 체계

스키마(`enum Role`)에 정의된 6가지 역할:

| 역할 코드 | 명칭 | 설명 |
|-----------|------|------|
| `SUPER_ADMIN` | 최고관리자 | 전체 플랫폼 관리. 모든 승인·정산 권한 |
| `NODE` | 노드 | 중간관리자·브랜드를 관리하는 지역/채널 단위 파트너. 상품에 노드 마진 설정 후 최종 등록 |
| `MIDDLE_ADMIN` | 중간관리자 | 브랜드·셀러를 모집·관리하는 중간 파트너. 주문 발생 시 마진 적립 |
| `BRAND_ADMIN` | 브랜드관리자 | 상품 등록 및 셀러에게 분양. 공동구매 캠페인 생성 |
| `SELLER` | 셀러(인플루언서) | 분양받은 상품을 셀렉트숍에서 판매. 공동구매·라이브커머스·콘텐츠 운영 |
| `BUYER` | 구매자 | 상품 구매·리뷰·위시리스트·셀러 팔로우 |

**시스템 전역 스위치**: `SystemConfig.nodeEnabled`가 `false`이면 NODE 계층 없이 운영 (SUPER_ADMIN이 직접 중간관리자·브랜드를 관리).

**플랫폼 수수료율 설정**: `PlatformFeeSettings` 테이블(단일 레코드)에서 역할별 수수료율을 관리.

| 항목 | 필드 | 기본값 |
|------|------|--------|
| 셀러 수수료율 | `sellerFeeRate` | 5% |
| 중간관리자 수수료율 | `middleAdminFeeRate` | 5% |
| 브랜드 수수료율 | `brandFeeRate` | 5% |
| 노드 수수료율 | `nodeFeeRate` | 5% |

---

## 2. 계정 유형별 정산 프로세스

### 2.1 SELLER (셀러) 정산

**수익 발생 방식**

- 판매된 주문의 커미션(`SellerProfile.commissionRate`, 기본 5%)
- 추천인 레퍼럴 커미션(`SellerProfile.referralCommissionRate`)
- 공동구매 캠페인 커미션(`GroupBuyCampaign.commissionRate`, 기본 10%)

**정산 흐름**

```
[셀러] 출금 요청 생성 (PayoutRequest, status=REQUESTED)
    │
[SUPER_ADMIN] 검토 및 승인 → status=APPROVED
    │
[SUPER_ADMIN] 실제 입금 처리 → status=PAID
    │  (DepositTransfer: 쿠콘 입금이체 PG로 은행 자동 이체 가능)
    │
반려 시 → status=REJECTED (note에 사유 기록)
```

**관련 모델**

- `PayoutRequest` — 출금 요청 단위. `amount`, `netAmount`, `orderCount`, `bankName/accountNumber/accountHolder`
- `Settlement` — 캠페인 단위 정산 내역 (`SettlementStatus`: PENDING → CALCULATED → APPROVED → PAID / REJECTED)
- `ReferralCommission` — 레퍼럴 커미션 내역 (`CommissionStatus`: PENDING → CONFIRMED → PAID / CANCELLED)
- `DepositTransfer` — 쿠콘 PG 이체 로그

**관련 API**

| 엔드포인트 | 역할 | 설명 |
|-----------|------|------|
| `POST /api/admin/payouts` | SUPER_ADMIN | 출금요청 승인(approve) / 지급완료(pay) / 반려(reject) |
| `GET/POST /api/seller/referral` | SELLER | 추천인 코드 조회/생성 |
| `GET /api/admin/deposit-transfer/balance` | SUPER_ADMIN | 이체 가능 잔액 조회 |

---

### 2.2 BRAND_ADMIN (브랜드) 정산

**수익 발생 방식**

- 자사 상품 판매 시 공급가(`supplyPrice`) 기준 정산
- `priceModel=COMMISSION`인 상품은 판매가에서 커미션을 제외한 금액이 브랜드 몫

**정산 흐름**

```
[SUPER_ADMIN] 기간별 판매 현황 집계 (브랜드별 주문 내역 조회)
    │
[SUPER_ADMIN] BrandSettlement 레코드 수동 생성
    │ (periodLabel, totalSupply, totalSales, orderCount 입력)
    │
[BRAND_ADMIN] 정산 내역 확인
    │
[BRAND_ADMIN] 세금계산서 발급 요청 (invoiceStatus: NONE → REQUESTED)
    │
[SUPER_ADMIN] 세금계산서 발급 처리 (invoiceStatus: REQUESTED → ISSUED)
    │
[SUPER_ADMIN] isPaid=true로 지급 처리 (paidAt 기록)
```

**관련 모델**

- `BrandSettlement` — 브랜드 정산 레코드. `isPaid`, `invoiceStatus`(NONE/REQUESTED/ISSUED), `invoiceNumber`
- `BrandProfile.bankName/accountNumber/accountHolder` — 정산 계좌

**관련 API**

| 엔드포인트 | 역할 | 설명 |
|-----------|------|------|
| `GET /api/admin/brand-settlements` | SUPER_ADMIN | 브랜드별 미정산 집계 + 정산 이력 조회 |
| `POST /api/admin/brand-settlements` | SUPER_ADMIN | 정산 레코드 생성 |
| `PATCH /api/admin/brand-settlements` | SUPER_ADMIN | 지급 처리 / 세금계산서 발급 |
| `GET /api/brand/settlements` | BRAND_ADMIN | 내 정산 내역 조회 |
| `POST /api/brand/settlements` | BRAND_ADMIN | 세금계산서 발급 요청 |

---

### 2.3 MIDDLE_ADMIN (중간관리자) 정산

**수익 발생 방식**

- 관리 중인 브랜드·셀러의 주문 발생 시 주문별 마진 적립 (`MiddleAdminCommission`)
- 마진은 `MarginMethod`(PERCENTAGE / SUPPLY_BASE)와 `MarginBase`(SUPPLY / SALE)에 따라 계산

**정산 흐름**

```
[주문 발생] MiddleAdminCommission 생성 (status=PENDING, marginAmount 기록)
    │
[SUPER_ADMIN] 미지급 마진 집계 조회 (중간관리자별 PENDING 합산)
    │
[SUPER_ADMIN] 정산 처리: PENDING 커미션 묶어 MiddleAdminSettlement 생성 → 즉시 PAID 처리
    │ (periodStart~periodEnd 지정 가능, MiddleAdminCommission.status → PAID)
    │
[MIDDLE_ADMIN] 정산 내역 확인
    │
[MIDDLE_ADMIN] 세금계산서 발급 요청 (invoiceStatus: NONE → REQUESTED)
    │
[SUPER_ADMIN] 세금계산서 발급 처리 (REQUESTED → ISSUED, invoiceNumber 기록)
```

**관련 모델**

- `MiddleAdminCommission` — 주문별 마진 적립 (`CommissionStatus`: PENDING → PAID)
- `MiddleAdminSettlement` — 기간 정산 레코드 (`SettlementStatus`, `invoiceStatus`)
- `MiddleManagerSettlement` — 관리자가 직접 생성하는 중간관리자 정산 (수기 처리용)
- `MiddleAdminProfile.commissionRate` — 기본 수수료율 (기본 5%)

**관련 API**

| 엔드포인트 | 역할 | 설명 |
|-----------|------|------|
| `GET /api/admin/middle-settlements` | SUPER_ADMIN | 중간관리자별 미지급 마진 집계 |
| `POST /api/admin/middle-settlements` | SUPER_ADMIN | 정산 처리 (PENDING → PAID 일괄 처리) |
| `PATCH /api/admin/middle-settlements` | SUPER_ADMIN | 세금계산서 발급 처리 |
| `GET /api/middle/settlements` | MIDDLE_ADMIN | 내 정산 내역 + 하위 브랜드 지급 현황 |
| `POST /api/middle/settlements` | MIDDLE_ADMIN | 세금계산서 발급 요청 |

---

### 2.4 NODE (노드) 정산

**수익 발생 방식**

- 관리 중인 중간관리자·브랜드 거래 실적에서 노드 마진 수취 (확인 필요: 자동 집계 로직 미확인)
- `NodeSettlement` 레코드로 관리

**정산 흐름**

```
[SUPER_ADMIN] NodeSettlement 레코드 수동 생성
    │ (periodLabel, totalAmount, memo)
    │
[SUPER_ADMIN] status 변경: PENDING → APPROVED → PAID (paidAt 기록)
```

**관련 모델**

- `NodeSettlement` — 노드 정산 레코드 (`SettlementStatus`)
- `User.nodeSettlements` — 노드 계정에 귀속된 정산 내역

**관련 API**: 확인 필요 (전용 API 라우트 미확인)

---

### 2.5 SUPER_ADMIN (최고관리자) 정산

- 플랫폼 수수료 수익은 별도 정산 모델 없이 운영 관리
- 모든 정산의 최종 승인·지급 주체
- `ManualSettlement` 모델로 수기 정산 처리 가능 (recipientType / recipientId로 대상 지정)

---

## 3. 계정 유형별 상품 등록 프로세스

### 3.1 가격 모델 (PriceModel)

상품 등록 시 `priceModel` 필드로 가격 제공 방식을 결정:

| 모델 | 설명 | 셀러 판매가 결정 |
|------|------|-----------------|
| `SUPPLY` | 공급가 제공 — 브랜드는 `supplyPrice`만 입력 | 셀러가 직접 결정 (`SellerShopProduct.sellerPrice`) |
| `COMMISSION` | 수수료 제공 — 브랜드가 `basePrice`와 `commissionRate` 지정 | 고정 판매가, 셀러는 수수료만 수취 |

### 3.2 SUPER_ADMIN 상품 등록

- **등록 경로**: `/admin/products` (관리자 대시보드)
- **승인**: 자동 승인 (`isApproved=true` 즉시 설정)
- **가격**: 공급가(`supplyPrice`), 판매가(`basePrice`), 관리자 마진(`adminMargin`) 직접 입력
- **노드 마진**: `nodeEnabled=true`인 경우, 노드가 추가로 마진 설정 후 `nodeApprovedAt` 기록
- **분양**: 모든 셀러에게 분양 허용 가능

### 3.3 BRAND_ADMIN 상품 등록

- **등록 경로**: `/brand/products` (브랜드 대시보드)
- **승인**: 자동 승인 (단, `isApproved=false`로 시작 — 확인 필요: MIDDLE_ADMIN 또는 NODE 승인 필요 여부)
- **노드 마진**: `nodeEnabled=true`인 경우, 노드(`NODE`)가 `nodeMargin`을 설정하고 최종 등록
- **귀속**: `BrandProfile.middleAdminId` 또는 `BrandProfile.assignedNodeId`에 따라 승인 주체 결정
- **커미션 설정**: 상품별 셀러 커미션율 지정 가능

### 3.4 SELLER 상품 등록

- **등록 가능 여부**: 직접 상품 등록 가능하나 승인 필요 (`Product.isApproved=false`로 시작)
- **등록 방식**: 브랜드 상품에 분양 신청(`SellerShopProduct` 생성) 또는 직접 상품 등록 후 승인 대기
- **자기 숍 자동 추가**: 셀러가 직접 등록한 상품은 자신의 숍에 자동으로 추가됨
- **공동구매 참여**: 자신의 캠페인 생성 또는 다른 브랜드의 공동구매에 Join 가능

### 3.5 상품 등록 필드 요약

| 카테고리 | 필드 |
|----------|------|
| 기본 정보 | `name`, `slug`, `categoryId`, `brandId`, `description`, `detailContent` |
| 가격 | `basePrice`, `comparePrice`, `supplyPrice`, `priceModel`, `commissionRate` |
| 마진 | `middleAdminMargin`, `adminMargin`, `nodeMargin`, `nodeMarginType` |
| 재고·배송 | `totalStock`, `shippingFee`, `freeShipping`, `freeShippingThreshold`, `remoteAreaFee` |
| 옵션 | `optionGroups`(JSON), `ProductVariant[]` |
| 기능 플래그 | `allowGroupBuy`, `allowLiveCommerce`, `isActive`, `isApproved` |
| 뱃지 | `badges` (FREE_SHIPPING, NEW, BEST, HOT_DEAL, LIMITED, ECO, HANDMADE 등) |

---

## 4. 계정 유형별 상품 노출 프로세스

등록된 상품이 구매자에게 노출되기까지의 전체 흐름:

```
[브랜드/관리자] 상품 등록
    │  (Product.isApproved=false, isActive=true)
    │
[노드 - nodeEnabled=true인 경우] 마진 설정 후 최종 등록
    │  (Product.nodeMargin 설정, nodeApprovedAt 기록, nodeId 설정)
    │
[관리자/중간관리자] 상품 승인
    │  (Product.isApproved=true)
    │
[셀러] 분양 신청 (샵에 상품 추가 요청)
    │  (SellerShopProduct 생성: isApproved=false, isActive=false)
    │
[승인 주체] 셀러 분양 승인
    │  승인 주체: approverType (SUPER_ADMIN / MIDDLE_ADMIN / BRAND_ADMIN)
    │  (SellerShopProduct.isApproved=true)
    │
[셀러] 판매 시작
    │  (SellerShopProduct.isActive=true)
    │
[구매자] 셀러 숍(/shop/{slug})에서 상품 노출 및 구매 가능
```

**노출 제어 항목**

| 레벨 | 필드 | 설명 |
|------|------|------|
| 상품 전체 | `Product.isActive` | false이면 모든 숍에서 미노출 |
| 상품 전체 | `Product.isApproved` | false이면 구매자에게 미노출 |
| 셀러 숍 단위 | `SellerShopProduct.isActive` | 해당 셀러 숍에서만 미노출 |
| 셀러 숍 단위 | `SellerShopProduct.isApproved` | 분양 미승인 상태 |
| 셀러 숍 단위 | `SellerShopProduct.sellerPrice` | 공급가 모델에서 셀러가 설정한 판매가 |

**반려 처리**: `SellerShopProduct.rejectionReason`에 사유 기록 → 셀러에게 표시

---

## 5. 공동구매 캠페인 운영 프로세스

### 5.1 상태 머신

```
SCHEDULED (예정)
    │ startDate 도달
    ▼
ACTIVE (진행중)
    │
    ├──> SUCCESS (성공): goalQuantity 달성 또는 기간 내 판매 완료
    │       │
    │       ▼
    │     SETTLED (정산완료)
    │
    ├──> FAILED (실패): endDate 도달, goalQuantity 미달
    │       │
    │       ▼
    │     REFUNDING (환불중) → REFUNDED (환불완료)
    │
    ├──> SOLDOUT (품절): 재고 소진
    │
    └──> CANCELLED (취소): 수동 취소 (SCHEDULED 또는 ACTIVE 상태에서)
```

### 5.2 캠페인 생성 조건 및 주체

| 역할 | 캠페인 생성 | 조건 |
|------|------------|------|
| SELLER | 자신의 셀렉트숍 상품으로 생성 | 상품이 `allowGroupBuy=true`여야 함. 생성 시 자동으로 `allowGroupBuy=true` 설정 |
| BRAND_ADMIN | 자사 상품으로 생성 | 확인 필요 |
| SUPER_ADMIN | 모든 상품으로 생성 | 제한 없음 |

**셀러 캠페인 생성 로직** (`POST /api/seller/campaigns`):
- 상품이 셀러 숍에 없으면 `SellerShopProduct` 자동 생성
- `startDate <= now`이면 즉시 `ACTIVE`, 미래이면 `SCHEDULED`
- 필수 입력: `productId`, `campaignPrice`, `startDate`, `endDate`

### 5.3 캠페인 핵심 필드

| 필드 | 설명 |
|------|------|
| `campaignPrice` | 공동구매 할인가 |
| `originalPrice` | 원래 판매가 (기준가) |
| `goalQuantity` | 목표 수량 (nullable — 없으면 수량 제한 없이 기간만 운영) |
| `limitPerPerson` | 1인 구매 제한 (기본 10) |
| `minOrderQuantity` | 최소 주문 수량 (기본 1) |
| `maxOrderQuantity` | 최대 주문 수량 (nullable) |
| `currentQuantity` | 현재 판매 수량 (실시간 집계) |
| `participantCount` | 참여자 수 |
| `totalRevenue` | 총 매출 |
| `commissionRate` | 캠페인 커미션율 (기본 10%) |
| `estimatedDelivery` | 배송 예정일 |

### 5.4 캠페인 관련 API

| 엔드포인트 | 역할 | 설명 |
|-----------|------|------|
| `GET/POST /api/seller/campaigns` | SELLER | 내 캠페인 목록 / 캠페인 생성 |
| `GET/POST /api/brand/campaigns` | BRAND_ADMIN | 브랜드 캠페인 관리 |
| `GET/POST /api/seller/available-campaigns` | SELLER | 참여 가능한 캠페인 조회 / 참여 신청 |
| `GET /api/campaigns` | 공개 | 공동구매 목록 (구매자) |

---

## 6. 레퍼럴 및 커미션 체계

### 6.1 추천인(레퍼럴) 시스템

**코드 생성**: 셀러 slug 기반 + 4자리 랜덤 (`POST /api/seller/referral`)  
예: `shopname-A3X9`

**흐름**

```
1. 셀러 → 추천인 코드 보유 (SellerProfile.referralCode)
2. 구매자 → 가입 시 추천인 코드 입력 (BuyerProfile.referredBySellerId 설정)
3. 해당 구매자 구매 시 → ReferralCommission 생성
   - commissionRate: SellerProfile.referralCommissionRate (기본 0%)
   - commissionAmount: orderAmount × commissionRate
   - status: PENDING → CONFIRMED → PAID
4. 구매자 할인 적용
   - discountRate: SellerProfile.referralDiscountRate (기본 0%)
   - Order.discountType = "referral"
```

### 6.2 Pick + 채널인증 할인

```
1. 구매자 → 특정 셀러 Pick (BuyerProfile.primarySellerId 설정)
2. 구매자 → 셀러의 SNS 채널 구독 인증 제출 (ChannelVerification, screenshotUrl)
   - channelType: "youtube" | "instagram" | "tiktok" 등
3. 셀러/관리자 → 인증 승인 (status: PENDING → APPROVED / REJECTED)
4. 인증 완료 시 → 해당 셀러 구매 시 추가 할인
   - discountRate: SellerProfile.pickDiscountRate (기본 0%)
   - Order.discountType = "pick"
```

### 6.3 커미션 요약표

| 커미션 유형 | 수혜자 | 기본값 | 설정 주체 | DB 필드 |
|------------|--------|--------|----------|---------|
| 셀러 판매 커미션 | 판매 셀러 | 5% | 플랫폼/관리자 | `SellerProfile.commissionRate` |
| 레퍼럴 커미션 | 추천 셀러 | 0% | 셀러 설정 가능 | `SellerProfile.referralCommissionRate` |
| 공동구매 캠페인 커미션 | 캠페인 운영 셀러 | 10% | 캠페인 설정 | `GroupBuyCampaign.commissionRate` |
| 중간관리자 마진 | 중간관리자 | 5% | 관리자 설정 | `MiddleAdminProfile.commissionRate` |

### 6.4 할인 요약표

| 할인 유형 | 혜택 대상 | 기본값 | 설정 주체 | DB 필드 |
|----------|----------|--------|----------|---------|
| 추천인 가입 할인 | 추천 코드로 가입한 구매자 | 0% | 셀러 설정 가능 | `SellerProfile.referralDiscountRate` |
| Pick + 채널인증 할인 | Pick + 인증 완료 구매자 | 0% | 셀러 설정 가능 | `SellerProfile.pickDiscountRate` |

> **참고**: 추천인 할인과 Pick+채널인증 할인은 중복 적용 불가 (둘 중 하나만 적용, `Order.discountType`으로 구분)

### 6.5 주문 금액 계산

```
총 주문금액 = 상품 적용가 × 수량
  ※ 가격 우선순위: livePrice > campaignPrice > basePrice

할인금액    = 총 주문금액 × 할인율 (referral 또는 pick, 중복 불가)

최종결제금액 = 총 주문금액 - 할인금액 + shippingFee
```

---

## 7. 노드/중간관리자 계층 구조

### 7.1 전체 계층도

```
SUPER_ADMIN (최고관리자)
    │ 전체 관리·승인·정산
    ├──> NODE (노드)
    │       │ 채널/지역 단위 파트너
    │       ├──> MiddleAdminProfile (중간관리자)
    │       │       │ 브랜드·셀러 모집·관리
    │       │       ├──> BrandProfile (브랜드)
    │       │       └──> SellerProfile (셀러)
    │       └──> BrandProfile (중간관리자 없이 노드에 직접 귀속된 브랜드)
    │
    └──> (nodeEnabled=false일 때)
            ├──> MiddleAdminProfile (중간관리자, 관리자 직속)
            └──> BrandProfile (관리자 직속)
```

### 7.2 NODE 역할

- **계정 생성**: SUPER_ADMIN이 직접 `User.role=NODE` 계정 생성
- **관할 범위**: `MiddleAdminProfile.assignedNodeId`, `BrandProfile.assignedNodeId`로 귀속 관리
- **핵심 권한**: 상품에 노드 마진 설정 후 최종 등록 승인

**노드 마진 설정 방식**:

| 필드 | 설명 |
|------|------|
| `Product.nodeMargin` | 노드 마진 금액 또는 비율 |
| `Product.nodeMarginType` | `"AMOUNT"` (정액) / `"RATE"` (비율) |
| `Product.nodeApprovedAt` | 노드 최종 등록 완료 시각 |
| `Product.nodeId` | 등록한 노드 계정 User.id |

**노드 정산**: `NodeSettlement` 모델 (SUPER_ADMIN이 수동 생성, `SettlementStatus` 관리)

### 7.3 MIDDLE_ADMIN (중간관리자) 역할

- **계정 생성**: SUPER_ADMIN이 `POST /api/admin/middle-admins`로 생성 (비밀번호 포함)
- **귀속 설정**: `MiddleAdminProfile.assignedNodeId`로 노드 배정
- **관할**: 하위 브랜드(`BrandProfile.middleAdminId`)와 셀러(`SellerProfile.middleAdminId`) 관리

**마진 산정 방식** (`MarginMethod`):

| 방식 | 설명 |
|------|------|
| `PERCENTAGE` | `marginRate(%)` × 기준가 (공급가 또는 판매가 `MarginBase`로 선택) |
| `SUPPLY_BASE` | 상품마다 공급가·마진·판매가를 직접 입력 |

**중간관리자 수수료 API**

| 엔드포인트 | 역할 | 설명 |
|-----------|------|------|
| `GET /api/admin/middle-admins` | SUPER_ADMIN | 중간관리자 목록 조회 |
| `POST /api/admin/middle-admins` | SUPER_ADMIN | 중간관리자 등록 |
| `PUT /api/admin/middle-admins` | SUPER_ADMIN | 정보 수정 (commissionRate 포함) |
| `GET /api/middle/profile` | MIDDLE_ADMIN | 내 프로필 조회 |
| `GET /api/middle/brands` | MIDDLE_ADMIN | 관할 브랜드 목록 |
| `GET /api/middle/sellers` | MIDDLE_ADMIN | 관할 셀러 목록 |

### 7.4 셀러 승인 프로세스

```
[구매자] 셀러 전환 신청 (POST /api/my/apply-seller)
    │  (SellerProfile 생성, isApproved=false)
    │
[SUPER_ADMIN] 셀러 승인 (POST /api/admin/sellers/approve)
    │  (SellerProfile.isApproved=true, User.role=SELLER로 변경)
    │
또는
    │
[SUPER_ADMIN] 셀러 반려 (POST /api/admin/sellers/reject)
```

### 7.5 브랜드 승인 프로세스

- `BrandProfile.isApproved=false`로 시작
- SUPER_ADMIN이 `/api/admin/brands`를 통해 승인 처리
- 중간관리자 귀속: `BrandProfile.middleAdminId` 설정으로 중간관리자 관리 하에 배치

---

## 부록: 주요 상태 코드 요약

| 모델 | 상태 필드 | 가능한 값 |
|------|----------|----------|
| `GroupBuyCampaign` | `status` | SCHEDULED / ACTIVE / SUCCESS / FAILED / SOLDOUT / CANCELLED / SETTLED / REFUNDING / REFUNDED |
| `Order` | `status` | PENDING / PAID / CONFIRMED / SHIPPING / DELIVERED / CANCELLED / REFUND_REQUESTED / REFUNDED |
| `PayoutRequest` | `status` | REQUESTED / APPROVED / PAID / REJECTED |
| `Settlement` | `status` | PENDING / CALCULATED / APPROVED / PAID / REJECTED |
| `ReferralCommission` | `status` | PENDING / CONFIRMED / PAID / CANCELLED |
| `MiddleAdminCommission` | `status` | PENDING / CONFIRMED / PAID / CANCELLED |
| `ChannelVerification` | `status` | PENDING / APPROVED / REJECTED |
| `LiveStream` | `status` | SCHEDULED / LIVE / ENDED / CANCELLED |
| `DepositTransfer` | `status` | REQUESTED / SUCCESS / FAILED / PROCESSING / UNKNOWN |
| `BrandSettlement` | `isPaid` | boolean |
| `MiddleAdminSettlement` | `status` | PENDING / CALCULATED / APPROVED / PAID / REJECTED |
