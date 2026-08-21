# 바닐라폼

브랜드 → 셀러(인플루언서) → 구매자를 연결하는 3자 마켓플레이스 플랫폼

## 기술 스택

| 분류 | 기술 |
|------|------|
| Framework | Next.js 14 (App Router, Server Components) |
| DB | MySQL + Prisma 5 ORM |
| Auth | NextAuth.js v5 (JWT, credentials) |
| Styling | Tailwind CSS 3 + lucide-react |
| Forms | react-hook-form + zod |

## 시작하기

### 1. 사전 준비

- Node.js 18+
- MySQL 서버

### 2. 환경변수 설정

```bash
cd app
cp .env.example .env
```

`.env` 파일을 열어 본인 환경에 맞게 수정:

```env
VANILLAFORM_DATABASE_URL="mysql://vanillaform_local:local_password@127.0.0.1:3306/vanillaform_dev"
AUTH_SECRET="your-secret-key"
AUTH_URL="http://localhost:3026"
NEXTAUTH_URL="http://localhost:3026"
NEXT_PUBLIC_APP_URL="http://localhost:3026"
NEXT_PUBLIC_APP_NAME="바닐라폼"
EXTERNAL_INTEGRATIONS_ENABLED="false"
```

### 3. 설치 및 실행

```bash
cd app
npm install              # 의존성 설치
npx prisma generate      # Prisma Client 생성
npx prisma db push       # DB 스키마 반영
npm run db:seed          # 시드 데이터 투입 (선택)
npm run dev              # 개발 서버 실행 → http://localhost:3026
```

## 주요 명령어

```bash
# 모든 명령어는 app/ 디렉토리에서 실행
npm run dev              # 개발 서버
npm run build            # 프로덕션 빌드
npm run start            # 프로덕션 서버
npm run lint             # ESLint 검사
npm run format           # Prettier 포맷팅
npx tsc --noEmit         # 타입 체크

# DB 관련
npx prisma db push       # 스키마 → DB 반영 (마이그레이션 없이)
npx prisma migrate dev   # 마이그레이션 생성 및 적용
npx prisma generate      # Prisma Client 재생성
npx prisma studio        # DB GUI (브라우저)
npm run db:seed          # 시드 데이터 투입
```

## 프로젝트 구조

```
app/
├── src/
│   ├── app/
│   │   ├── (public)/          # 구매자 & 비회원 (모바일 퍼스트)
│   │   │   ├── /              # 홈
│   │   │   ├── /products/*    # 상품
│   │   │   ├── /content/*     # 콘텐츠
│   │   │   ├── /shop/*        # 셀러 샵
│   │   │   └── /my/*          # 마이페이지
│   │   ├── (dashboard)/       # 관리 대시보드 (사이드바 레이아웃)
│   │   │   ├── /admin/*       # 슈퍼 관리자
│   │   │   ├── /brand/*       # 브랜드 관리자
│   │   │   └── /seller/*      # 셀러 관리
│   │   ├── (live-viewer)/     # 라이브 커머스 뷰어
│   │   └── api/               # API 라우트
│   ├── components/
│   │   ├── shared/            # 공용 컴포넌트
│   │   ├── admin/             # 관리자 컴포넌트
│   │   └── layout/            # 레이아웃 (Header, Footer, MobileNav)
│   └── lib/                   # 유틸리티, DB 클라이언트
├── prisma/
│   └── schema.prisma          # DB 스키마
└── package.json
```

## 역할 시스템

| 역할 | 설명 |
|------|------|
| `SUPER_ADMIN` | 전체 관리 (사용자, 상품 승인, 정산) |
| `BRAND_ADMIN` | 브랜드 상품 등록, 셀러 관리 |
| `SELLER` | 샵 운영, 공동구매 캠페인, 콘텐츠, 라이브 |
| `BUYER` | 구매, 리뷰, 위시리스트, 셀러 팔로우 |

## 비즈니스 흐름

```
브랜드가 상품 등록
  → 관리자 승인
    → 셀러가 샵에 추가 (브랜드 승인 필요)
      → 셀러가 공동구매/라이브 캠페인 생성
        → 구매자가 구매
```

## 테스트 계정

`npm run db:seed` 로 시드 데이터를 투입하면 아래 계정으로 로그인할 수 있습니다.
비밀번호는 전부 동일하게 `password123` 입니다.

| 역할 | 이메일 | 비밀번호 | 용도 |
|------|--------|----------|------|
| `SUPER_ADMIN` (관리자) | `admin@vanillaform.local` | `password123` | 전체 관리 |
| `BRAND_ADMIN` (브랜드) | `brand1@vanillaform.local` | `password123` | 상품 관리 |
| `SELLER` (셀러) | `seller1@vanillaform.local` | `password123` | 샵 운영 |
| `BUYER` (구매자) | `buyer1@example.com` | `password123` | 쇼핑 |

> 운영/인증 환경에서는 노출하지 않도록 주의하세요. 로컬 개발·QA 전용입니다.
