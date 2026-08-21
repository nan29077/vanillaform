# 바닐라폼 - 비즈니스 로직 & 앱 구성 문서

## 1. 플랫폼 개요

바닐라폼는 **인플루언서(셀러) 기반 공동구매 커머스 플랫폼**입니다.
브랜드가 상품을 등록하고, 인플루언서(셀러)가 자신의 팬층을 활용하여 공동구매를 운영하며, 구매자가 셀러를 통해 상품을 구매하는 3자 구조입니다.

---

## 2. 계정 체계 (4가지 역할)

| 역할 | 코드 | 설명 |
|------|------|------|
| **슈퍼관리자** | `SUPER_ADMIN` | 전체 플랫폼 관리. 모든 기능 접근 가능. 브랜드/셀러 승인, 상품 관리, 정산, 배너 관리, 문의 설정 등 |
| **브랜드관리자** | `BRAND_ADMIN` | 자사 브랜드 상품 등록/관리, 셀러에게 상품 분양, 공동구매 생성, 인플루언서 커미션 설정, 콘텐츠 관리 |
| **셀러(인플루언서)** | `SELLER` | 분양받은 상품을 자신의 셀렉트숍에서 판매, 공동구매 참여/운영, 라이브커머스, 콘텐츠 제작, 팬 관리 |
| **구매자** | `BUYER` | 상품 구매, 리뷰 작성, 위시리스트, 셀러 팔로우/Pick, 채널 인증, 추천인 코드 활용 |

### 계정별 접근 경로

```
슈퍼관리자: /admin/*           (대시보드, 상품/셀러/브랜드/배너/정산/문의 관리)
브랜드관리자: /brand/*           (상품 등록, 콘텐츠 관리, 셀러 분양 관리)
셀러: /seller/*                  (셀렉트숍, 상품관리, 캠페인, 라이브, 콘텐츠, 팬, 정산, 주문)
구매자: / (공개 페이지) + /my/*  (마이페이지, 주문내역, 위시리스트, 리뷰, 포인트, 설정)
```

### 계정 상호 관계도

```
                    ┌─────────────────┐
                    │   슈퍼관리자     │
                    │  (SUPER_ADMIN)  │
                    └───────┬─────────┘
                            │ 전체 관리/승인
              ┌─────────────┼─────────────┐
              v             v             v
     ┌────────────┐  ┌────────────┐  ┌────────────┐
     │   브랜드    │  │    셀러    │  │   구매자    │
     │(BRAND_ADMIN)│  │  (SELLER) │  │  (BUYER)   │
     └─────┬──────┘  └──┬───┬────┘  └────┬───────┘
           │ 상품등록    │   │ 콘텐츠/    │ 구매/팔로우
           │ 분양허용    │   │ 라이브     │ Pick/채널인증
           └──────>──────┘   │            │
              분양/승인       └─────<──────┘
                              판매/커미션
```

**핵심 관계:**
- 브랜드 -> 셀러: 상품 분양(승인 후), 커미션율 설정, 최저판매가 설정
- 셀러 -> 구매자: 셀렉트숍 판매, 공동구매 운영, 라이브방송, 콘텐츠
- 구매자 -> 셀러: Pick(전담셀러), 팔로우, 채널인증, 추천인코드
- 관리자: 모든 관계 모니터링, 승인/거절, 정산 처리

---

## 3. 상품 구매 흐름

### 3.1 일반 상품 구매

```
[브랜드/관리자]                    [셀러]                      [구매자]
상품 등록 ──────> 분양 신청 ──────> 승인
                  셀렉트숍 추가 <── 승인 완료
                  판매 개시        상품 탐색/검색
                                   |
                                   v
                                  상품 상세 페이지
                                   |
                                   ├── 옵션 선택
                                   ├── 장바구니 담기
                                   └── 바로 구매
                                   |
                                   v
                                  결제 (카드/페이)
                                   |
                                   v
                                  주문 완료 -> 배송 -> 구매확정 -> 리뷰
```

### 3.2 공동구매 상품 구매

```
[브랜드/관리자]                    [셀러]                      [구매자]
상품 등록                          
공동구매 캠페인 생성 ──>           캠페인 참여(Join)
  (할인가/기간/목표수량 설정)       팬에게 공유 ────────────>   공동구매 페이지 접속
                                                               |
                                                               v
                                                              공동구매가로 구매
                                                              (campaignPrice 적용)
                                                               |
                                                               v
                                                              목표수량 달성 -> 캠페인 성공
                                                              기간 만료 -> 캠페인 종료
```

**공동구매 상태 흐름:**
```
SCHEDULED (예정) -> ACTIVE (진행중) -> SUCCESS (성공) / ENDED (종료) / CANCELLED (취소)
```

### 3.3 라이브커머스 상품 구매

```
[셀러]                              [구매자]
라이브 방송 생성                     
상품 등록 (라이브특가 설정)          라이브 시청 (공유코드 접속)
방송 시작 ──────────────────────>    실시간 채팅 참여
상품 소개/판매                       |
                                     v
                                    방송 중 상품 클릭
                                     |
                                     v
                                    상품 상세 페이지 -> 구매
                                    (livePrice 적용)
```

**라이브 상태 흐름:**
```
SCHEDULED (예정) -> LIVE (방송중) -> ENDED (종료) / CANCELLED (취소)
```

---

## 4. 상품 등록 로직

### 4.1 등록 주체별 차이

| 등록 주체 | 승인 필요? | 분양 가능? | 공동구매 생성? |
|-----------|-----------|-----------|--------------|
| 슈퍼관리자 | 자동 승인 | O | O |
| 브랜드관리자 | 자동 승인 | O | O |
| 셀러 | 승인 필요 | 자동 자기 숍 추가 | 캠페인 참여만 |

### 4.2 상품 등록 필드

- **기본정보**: 상품명, 카테고리, 브랜드, 가격(판매가/비교가), 설명, 상세내용(HTML)
- **이미지/옵션**: 썸네일, 추가 이미지(정렬순서), 옵션(사이즈/색상 등, 옵션별 가격), 뱃지
- **공동구매 설정**: 캠페인 제목, 공동구매가, 시작/종료일, 목표수량, 1인 구매제한, 최대 주문수량, 배송예정일
- **라이브커머스**: 라이브 특가(livePrice) 설정 가능
- **커미션**: 인플루언서 커미션율(%) - 브랜드/관리자가 등록 시 설정
- **최저판매가(드라이브)**: 브랜드/관리자가 공동구매 최저 판매가 설정
- **뱃지**: FREE_SHIPPING, NEW, BEST, HOT_DEAL, LIMITED, ECO, HANDMADE 등

### 4.3 상품 유형

1. **일반 상품**: 셀러 셀렉트숍에서 상시 판매
2. **공동구매 상품**: 기간/목표 한정 할인 판매 (캠페인 단위)
3. **라이브커머스 상품**: 라이브 방송 중 특가 판매

---

## 5. 가격 & 할인 구조

### 5.1 가격 체계

```
비교가(정가): comparePrice    (할인 전 가격, 취소선 표시)
판매가:      basePrice        (기본 판매 가격)
공동구매가:   campaignPrice    (공동구매 할인 가격)
라이브특가:   livePrice        (라이브 방송 중 특별 할인가)
최저판매가:   drivePrice       (브랜드/관리자가 설정하는 최소 판매 가격)

우선순위: livePrice > campaignPrice > basePrice
```

### 5.2 할인율 계산

```
일반 할인율      = (comparePrice - basePrice) / comparePrice x 100
공동구매 할인율  = (basePrice - campaignPrice) / basePrice x 100
라이브특가 할인율 = (basePrice - livePrice) / basePrice x 100
```

### 5.3 주문 금액 계산

```
총 주문금액 = 상품가(적용가격) x 수량
할인금액    = 추천인 할인 OR Pick+채널인증 할인 적용 (중복 불가)
배송비      = 무료 (기본) or 별도
최종결제금액 = 총 주문금액 - 할인금액 + 배송비
```

---

## 6. 수익 배분 & 커미션 구조

### 6.1 커미션 체계

| 커미션 유형 | 기본 비율 | 설정 주체 | 수혜자 | DB 필드 |
|------------|----------|----------|--------|---------|
| **셀러 기본 커미션** | 10% | 플랫폼 (조정 가능) | 셀러(인플루언서) | `SellerProfile.commissionRate` |
| **상품별 인플루언서 커미션** | 상품마다 다름 | 브랜드/관리자 | 셀러(인플루언서) | 상품 등록 시 설정 |
| **추천인 커미션** | 3% | 셀러 프로필 설정 | 추천 셀러 | `SellerProfile.referralCommissionRate` |
| **공동구매 캠페인 커미션** | 10% (캠페인별) | 캠페인 설정 | 캠페인 운영 셀러 | `GroupBuyCampaign.commissionRate` |

### 6.2 할인 혜택 구조

| 할인 유형 | 기본 할인율 | 조건 | DB 필드 |
|----------|-----------|------|---------|
| **추천인 코드 할인** | 5% | 셀러의 추천인 코드로 가입한 회원이 구매 시 | `SellerProfile.referralDiscountRate` |
| **Pick + 채널인증 할인** | 3% | 셀러를 Pick하고 SNS 채널 구독 인증 완료한 회원 | `SellerProfile.pickDiscountRate` |

### 6.3 수익 배분 흐름

```
[구매자 결제]    최종결제금액: 100,000원 (예시)
    |
[플랫폼 수신]
    |
    |── (1) 상품 원가 ──────────> 브랜드/공급사    (약 70~80%)
    |
    |── (2) 셀러 커미션 ────────> 판매 셀러        (commissionRate: 10%)
    |                                               = 10,000원
    |
    |── (3) 추천인 커미션 ──────> 추천 셀러        (referralCommissionRate: 3%)
    |       (추천 코드 사용 시)                      = 3,000원
    |
    |── (4) 캠페인 커미션 ──────> 캠페인 운영 셀러  (commissionRate: 10%)
    |       (공동구매 주문 시)
    |
    └── (5) 플랫폼 수수료 ──────> 바닐라폼        (나머지)
```

### 6.4 정산 프로세스

```
주문 완료 -> 배송 완료 -> 구매 확정 (7일 자동 또는 수동)
    |
커미션 정산 상태 흐름:
    PENDING (정산 대기)
      |
    CONFIRMED (정산 확인)
      |
    PAID (정산 완료/입금)

정산 내역:
    |── 셀러 판매 커미션 (매 주문)
    |── 추천인 레퍼럴 커미션 (추천코드 사용 주문)
    └── 공동구매 캠페인 커미션 (캠페인 종료 후)
```

---

## 7. 주문 & 결제 프로세스

### 7.1 주문 상태 (OrderStatus)

```
PENDING (주문 접수)
  |
CONFIRMED (주문 확인)
  |
SHIPPING (배송 중)
  |
DELIVERED (배송 완료)
  |
COMPLETED (구매 확정) ──> 커미션 정산 진행

* CANCELLED (주문 취소) - 결제 전/후 취소
* REFUNDED (환불) - 구매 확정 전 반품/환불
```

### 7.2 결제 상태 (PaymentStatus)

```
PENDING (결제 대기) ──> COMPLETED (결제 완료)
                    ──> FAILED (결제 실패)
                    ──> CANCELLED (결제 취소)
                    ──> REFUNDED (환불)
```

### 7.3 주문 데이터 구조

```
Order
  |── orderNumber (고유 주문번호)
  |── userId (구매자)
  |── sellerId (판매 셀러)
  |── campaignId (공동구매 캠페인, nullable)
  |── status, paymentStatus
  |── totalAmount (총 금액)
  |── shippingFee (배송비)
  |── discountAmount (할인금액)
  |── discountType (할인유형: referral, pick 등)
  |── finalAmount (최종결제금액)
  |── shippingName, shippingPhone, shippingAddress, shippingMemo
  |── paymentMethod (결제수단)
  └── items: OrderItem[]
       |── productId, variantId, sellerId, campaignId
       |── quantity, price, totalPrice
```

---

## 8. 주요 기능별 상세 로직

### 8.1 셀러 셀렉트숍

- 셀러가 브랜드 상품을 분양 신청하여 자기 숍에 추가
- `SellerShopProduct` 테이블로 관리 (셀러-상품 매핑)
- 판매 시작/일시중지/중지/재시작 제어 가능 (`isActive` 토글)
- 숍별 테마 색상, 배너, 로고 커스터마이징
- 숍 URL: `/shop/{slug}`

### 8.2 공동구매 캠페인

- `GroupBuyCampaign` 테이블로 관리
- 상태 흐름: `SCHEDULED` -> `ACTIVE` -> `SUCCESS` / `ENDED` / `CANCELLED`
- 목표수량(`goalQuantity`) 설정 시 달성률 프로그레스 바 표시
- 기간 한정: 시작일(`startDate`)/종료일(`endDate`) 필수
- 참여자 수(`participantCount`), 현재 판매 수량(`currentQuantity`) 실시간 추적
- 1인 구매제한(`limitPerPerson`), 최소주문수량(`minOrderQuantity`)
- 총 매출(`totalRevenue`) 자동 집계
- 셀러가 다른 브랜드의 공동구매에 참여(Join) 가능

### 8.3 라이브커머스

- `LiveStream` 테이블로 관리
- 상태: `SCHEDULED` -> `LIVE` -> `ENDED` / `CANCELLED`
- 라이브 중 상품 전시 (`LiveStreamProduct`, 정렬순서/라이브특가 설정)
- 실시간 채팅 (`LiveChatMessage`, 매니저/시스템 메시지 구분)
- 시청자 수(`viewerCount`), 최대 시청자(`peakViewerCount`), 좋아요(`likeCount`) 추적
- VOD 저장 기능 (`isVodSaved`, `vodUrl`)
- 테마 시스템: default, modern, simple, lovely, natural, luxury
- 공유 코드(`shareCode`)로 라이브 접속 (`/live/{shareCode}`)

### 8.4 콘텐츠/룩북

- `ContentPost` 테이블로 관리
- 이미지 + 쇼핑 태그 (`ShoppingTag`: 이미지 내 상품 위치 x,y 마킹)
- 좋아요(`ContentLike`), 댓글(`ContentComment`, 대댓글 지원)
- 해시태그 시스템 (`hashtags` 배열)
- 관리자 승인 후 노출 (`isApproved`)
- 조회수(`viewCount`), 좋아요수(`likeCount`) 추적

### 8.5 추천인(레퍼럴) 시스템

```
1. 셀러가 고유 추천인 코드 보유 (referralCode)
2. 구매자가 가입 시 추천인 코드 입력 (BuyerProfile.referredBySellerId)
3. 해당 구매자의 구매 시 추천 셀러에게 커미션 발생 (ReferralCommission)
4. 구매자는 추천인 할인(referralDiscountRate: 5%) 혜택
```

### 8.6 Pick + 채널인증 시스템

```
1. 구매자가 특정 셀러를 "Pick" (BuyerProfile.primarySellerId 설정)
2. 셀러의 SNS 채널(유튜브, 인스타 등) 구독 인증 (ChannelVerification)
3. 인증 상태: PENDING -> APPROVED / REJECTED
4. 인증 완료 시 추가 할인(pickDiscountRate: 3%) 혜택
```

---

## 9. 데이터 모델 관계도

### 핵심 테이블 관계

```
User (사용자)
  |
  |── BuyerProfile (구매자 프로필)
  |     |── referredBySellerId (추천인 셀러)
  |     |── primarySellerId (Pick 셀러)
  |     |── ChannelVerification (채널인증)
  |     └── SellerFollower (셀러 팔로우)
  |
  |── SellerProfile (셀러 프로필)
  |     |── SellerShopProduct (숍 상품 매핑)
  |     |── GroupBuyCampaign (공동구매 캠페인)
  |     |── LiveStream (라이브 방송)
  |     |     └── LiveStreamProduct (라이브 상품)
  |     |     └── LiveChatMessage (라이브 채팅)
  |     |── ContentPost (콘텐츠)
  |     |     └── ShoppingTag (쇼핑 태그)
  |     |── Settlement (정산)
  |     └── Order (판매 주문, "SellerOrders")
  |
  |── BrandProfile (브랜드 프로필)
  |
  |── Order (구매 주문)
  |     |── OrderItem (주문 상품)
  |     └── ReferralCommission (추천인 커미션)
  |
  |── Review (리뷰)
  |── Wishlist (찜)
  |── Notification (알림)
  |── ContentLike (좋아요)
  └── ContentComment (댓글)

Product (상품)
  |── Brand (브랜드)
  |── Category (카테고리, 계층 구조)
  |── ProductVariant (옵션/사이즈)
  |── ProductImage (상품 이미지)
  |── Review (리뷰)
  |── SellerShopProduct (셀러 숍 매핑)
  |── GroupBuyCampaign (공동구매)
  └── LiveStreamProduct (라이브 상품)

Category (카테고리)
  └── parentId -> Category (계층 구조, 자기 참조)

Banner (배너, CMS 관리)
  |── position: "hero" | "middle"
  └── isActive, sortOrder
```

---

## 10. 수수료 & 비율 요약

| 항목 | 기본 비율 | DB 필드 | 설명 |
|------|----------|---------|------|
| 셀러 기본 커미션 | **10%** | `SellerProfile.commissionRate` | 판매 건당 셀러에게 지급 |
| 추천인 커미션 | **3%** | `SellerProfile.referralCommissionRate` | 추천 코드 사용 주문 시 추천 셀러에게 |
| 추천인 가입 할인 | **5%** | `SellerProfile.referralDiscountRate` | 추천 코드 가입 구매자의 할인 |
| Pick+채널인증 할인 | **3%** | `SellerProfile.pickDiscountRate` | Pick+인증 완료 구매자의 할인 |
| 공동구매 캠페인 커미션 | **10%** | `GroupBuyCampaign.commissionRate` | 캠페인별 설정, 운영 셀러에게 |
| 상품별 인플루언서 커미션 | 상품마다 다름 | 상품 등록 시 설정 | 브랜드가 상품별로 설정 |

> 모든 비율은 관리자/브랜드가 조정 가능합니다.

---

## 11. API 엔드포인트

### 주요 API

| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/api/products/register` | POST/GET | 상품 등록 / 카테고리 목록 |
| `/api/products/manage` | POST | 상품 관리 (판매 시작/중지/삭제) |
| `/api/upload` | POST | 이미지 업로드 |
| `/api/live` | GET/POST | 라이브 조회/채팅/관리 |
| `/api/seller/available-campaigns` | GET/POST | 참여 가능한 공동구매 조회/참여 |
| `/api/seller/shop` | GET/POST | 셀러 숍 정보 관리 |
| `/api/admin/brands` | GET/POST | 브랜드 관리 (관리자) |
| `/api/admin/contact-settings` | GET/POST | 고객센터 설정 관리 |
| `/api/wishlist` | POST/PUT | 위시리스트 추가/제거/조회 |
| `/api/cart` | GET/POST | 장바구니 조회/추가 |
| `/api/orders` | GET/POST | 주문 생성/조회 |

---

## 12. 페이지 라우트 구조

### 공개 페이지 (/)
| 경로 | 설명 |
|------|------|
| `/` | 홈 (배너, 카테고리, 인기상품, 공동구매, AI추천 등) |
| `/products/[id]` | 상품 상세 |
| `/campaigns/[id]` | 공동구매 상세 |
| `/search` | 상품 검색 |
| `/sellers` | 셀러 목록 |
| `/shop/[slug]` | 셀러 숍 페이지 |
| `/content` | 콘텐츠 목록 |
| `/content/[id]` | 콘텐츠 상세 |
| `/live/[code]` | 라이브 시청 |
| `/cart` | 장바구니 |
| `/my/*` | 마이페이지 (주문, 리뷰, 위시리스트, 설정 등) |

### 대시보드 페이지
| 경로 | 역할 | 설명 |
|------|------|------|
| `/admin/*` | SUPER_ADMIN | 관리자 대시보드 |
| `/brand/*` | BRAND_ADMIN | 브랜드 대시보드 |
| `/seller/*` | SELLER | 셀러 대시보드 |

---

*마지막 업데이트: 2026-04-04*
