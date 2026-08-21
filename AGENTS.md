# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Language

- 응답과 커밋 메시지는 반드시 한국어
- 커밋 형식: `type: 한국어설명` (feat|fix|refactor|docs|style|test|chore)

## Project Overview

바닐라폼 — 브랜드→셀러(인플루언서)→구매자 3자 마켓플레이스. Next.js 14 App Router 기반 풀스택 단일 앱.

## Commands

```bash
cd app                          # 모든 명령은 app/ 디렉토리에서 실행
npm run dev                     # 개발 서버 (localhost:3026)
npm run build                   # 프로덕션 빌드
npx tsc --noEmit                # 타입 체크
npm run lint                    # ESLint
npm run format                  # Prettier

# Prisma (DB)
npx prisma db push              # 스키마를 DB에 반영 (마이그레이션 없이)
npx prisma migrate dev          # 마이그레이션 생성 및 적용
npx prisma generate             # Prisma Client 재생성
npx prisma studio               # DB GUI
npm run db:seed                 # 시드 데이터 투입
```

## ⚠️ DB 및 외부 연동 안전 수칙 (절대 위반 금지)

- Prisma는 `DATABASE_URL`이 아니라 바닐라폼 전용 `VANILLAFORM_DATABASE_URL`만 사용한다.
- 기본 DB는 `127.0.0.1/vanillaform_dev`이며, 원격 DB는 `ALLOW_REMOTE_VANILLAFORM_DATABASE=true`를 명시하지 않으면 안전 검사에서 차단된다.
- 이전 서비스의 DB 주소·도메인·자격증명을 이 저장소에 다시 넣거나 호출하지 않는다.
- `EXTERNAL_INTEGRATIONS_ENABLED=false`가 기본이며, 바닐라폼 전용 계정 준비 전에는 변경하지 않는다.
- **절대 실행 금지**: `prisma migrate reset`, `prisma db push --force-reset`, `prisma db push --accept-data-loss`, `DROP DATABASE` 류의 명령.
- `npm run db:seed`는 바닐라폼 전용 DB임을 확인한 후에만 실행한다.
- `prisma db push` 전에는 반드시 `prisma migrate diff`로 변경 내용을 확인하고, 데이터 손실 경고가 나오면 즉시 중단한다.

## Tech Stack

- **Framework**: Next.js 14 (App Router, Server Components)
- **DB**: MySQL + Prisma 5 ORM
- **Auth**: NextAuth.js v5 (JWT, credentials 방식)
- **Styling**: Tailwind CSS 3 + lucide-react 아이콘
- **Forms**: react-hook-form + zod
- **Path alias**: `@/*` → `./src/*`

## Architecture

### Route Groups (app/src/app/)

| Group | 경로 | 용도 |
|-------|------|------|
| `(public)` | `/`, `/products/*`, `/content/*`, `/shop/*`, `/my/*` | 구매자 & 비회원 (max-width 480px 모바일 퍼스트) |
| `(dashboard)` | `/admin/*`, `/brand/*`, `/seller/*` | 역할별 관리 대시보드 (사이드바 레이아웃) |
| `(live-viewer)` | `/live/[code]` | 라이브 커머스 뷰어 (독립 레이아웃) |

### Role System (4 roles)

- `SUPER_ADMIN` — 전체 관리 (사용자, 상품 승인, 정산)
- `BRAND_ADMIN` — 브랜드 상품 등록, 셀러 관리
- `SELLER` — 샵 운영, 공동구매 캠페인, 콘텐츠, 라이브
- `BUYER` — 구매, 리뷰, 위시리스트, 셀러 팔로우

### Data Flow

브랜드가 상품 등록 → 관리자 승인 → 셀러가 샵에 추가(브랜드 승인 필요) → 셀러가 공동구매/라이브 캠페인 생성 → 구매자가 구매

### MySQL JSON Fields

`ContentPost.images`, `ContentPost.hashtags`, `ContentPost.productTags`, `Review.images`는 `String? @db.Text`로 저장된 JSON 배열. 읽을 때 `parseJsonArray()` (lib/utils.ts), 쓸 때 `JSON.stringify()` 필수.

### Prisma + MySQL 주의사항

- `String[]` (PostgreSQL 배열 타입) 사용 불가 → `String? @db.Text` + JSON 직렬화
- `mode: "insensitive"` 사용 불가 → MySQL은 기본 collation으로 대소문자 무시
- `{ has: }` 배열 연산자 사용 불가 → `{ contains: }` 텍스트 검색 사용

### Component Patterns

- **서버 컴포넌트**: DB 조회, 데이터 직렬화 후 클라이언트에 전달
- **클라이언트 컴포넌트**: 인터랙션 담당, `"use client"` 선언
- **공유 컴포넌트**: `components/shared/` (60+개)
- **관리자 컴포넌트**: `components/admin/` (역할별 CRUD)
- **레이아웃 컴포넌트**: `components/layout/` (Header, Footer, MobileNav)

### API Routes

52개 API route가 `app/src/app/api/`에 위치. 패턴:
- 인증 체크: `const session = await auth()`
- 역할 검증: `(session.user as any).role`
- Decimal → Number 변환: `Number(product.basePrice)`
- 에러 응답: `NextResponse.json({ error: "메시지" }, { status: 코드 })`

## Key Business Concepts

- **공동구매 캠페인**: 시간/수량 제한 할인 판매 (SCHEDULED→ACTIVE→SUCCESS/FAILED)
- **레퍼럴 시스템**: 셀러 추천 코드 → 구매자 할인 + 셀러 커미션
- **채널 인증**: 셀러 SNS 구독 인증 → 추가 할인 (Pick+채널인증)
- **정산**: 캠페인 종료 후 커미션 계산 → 관리자 승인 → 지급

## Documentation

- `docs/BUSINESS_LOGIC.md` — 상세 비즈니스 로직, 가격 구조, 커미션 체계
- `docs/DESIGN.md` — MVP 범위, 정보 구조(IA), RBAC 정의
