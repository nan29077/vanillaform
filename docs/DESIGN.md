# 바닐라폼 (VanillaForm) — MVP 설계 문서

## 1. 핵심 가정

### 비즈니스 가정
- **서비스 유형**: 인플루언서 팬덤 기반 공동구매 샵인샵 커머스 플랫폼
- **타깃**: 패션/뷰티/라이프스타일에 관심 있는 20~30대 여성 (확장 가능)
- **수익 모델**: 공동구매 수수료 (캠페인별 셀러 수수료율 설정)
- **MVP 범위**: 즉시결제 + 캠페인 상태관리, 실패 시 환불 구조 설계

### 기술 가정
- Next.js 15 App Router (Server Components + Server Actions)
- PostgreSQL + Prisma ORM
- NextAuth.js v5 (credentials 기반, 소셜 확장 가능)
- Tailwind CSS + shadcn/ui
- 이미지: placeholder URL 사용 (실제 S3 연동 구조만 설계)
- 결제: Mock Payment Provider (실제 PG 확장 가능)

### 정책 가정
- 구매회원 1명 = 1 primary seller 귀속
- 장바구니는 셀러별 분리 (다른 셀러 상품 혼합 불가)
- 재고는 상품/옵션 단위로 브랜드/관리자가 관리
- 가격: 정상가(상품) + 공동구매가(캠페인)
- 셀러 수수료: 캠페인별 설정

## 2. 핵심 기능 요구사항 (MVP)

### 공개 페이지
- 랜딩페이지 (에디토리얼 커머스)
- 셀러 목록/상세(셀러샵)
- 공동구매 캠페인 목록/상세
- 상품 상세
- 로그인/회원가입
- 검색/카테고리

### 구매회원
- 셀러 귀속 가입, 장바구니, 주문/결제(mock), 주문내역, 리뷰, 마이페이지

### 셀러
- 대시보드, 샵 관리, 상품 추가, 캠페인 생성/관리, 팬 목록, 정산 조회

### 브랜드
- 상품 CRUD, 옵션/재고, 판매 현황

### 최고관리자
- 전체 대시보드, 사용자/셀러/브랜드/상품/캠페인/주문/정산/배너 관리

## 3. 정보구조 (IA)

```
/ (랜딩)
├── /campaigns (공동구매 목록)
│   └── /campaigns/[id] (캠페인 상세)
├── /sellers (셀러 목록)
├── /shop/[slug] (셀러샵)
├── /products/[id] (상품 상세)
├── /categories/[slug] (카테고리)
├── /search (검색)
├── /auth/login
├── /auth/register
├── /cart (장바구니)
├── /checkout (주문/결제)
├── /my (마이페이지)
│   ├── /my/orders
│   ├── /my/reviews
│   ├── /my/addresses
│   └── /my/seller (내 셀러 확인)
├── /seller (셀러 대시보드)
│   ├── /seller/shop
│   ├── /seller/products
│   ├── /seller/campaigns
│   ├── /seller/orders
│   ├── /seller/fans
│   └── /seller/settlements
├── /brand (브랜드 대시보드)
│   ├── /brand/products
│   ├── /brand/orders
│   └── /brand/stats
└── /admin (최고관리자)
    ├── /admin/dashboard
    ├── /admin/users
    ├── /admin/sellers
    ├── /admin/brands
    ├── /admin/products
    ├── /admin/campaigns
    ├── /admin/orders
    ├── /admin/settlements
    └── /admin/banners
```

## 4. RBAC 역할

| 역할 | 코드 | 접근 범위 |
|------|------|----------|
| 최고관리자 | SUPER_ADMIN | 전체 |
| 브랜드관리자 | BRAND_ADMIN | 자기 브랜드 상품/주문 |
| 셀러 | SELLER | 자기 샵/캠페인/팬 |
| 구매회원 | BUYER | 쇼핑/주문/마이페이지 |

## 5. 공동구매 캠페인 상태 머신

```
SCHEDULED → ACTIVE → SUCCESS / FAILED / SOLDOUT
                  → CANCELLED
SUCCESS → SETTLED
FAILED → REFUNDING → REFUNDED
```
