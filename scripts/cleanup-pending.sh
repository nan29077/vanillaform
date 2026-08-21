#!/usr/bin/env bash
# 방치된 미결제 PENDING 주문 정리 — /api/cron/cleanup-pending 호출용 래퍼.
#
# 왜 필요한가:
#   주문은 결제 전에 PENDING 으로 먼저 생성되고, 그 시점에 재고를 선점한다(lib/orderStock).
#   구매자가 결제창을 정상적으로 닫으면 abort 라우트가 재고를 되돌리지만,
#   브라우저 강제 종료·네트워크 단절이면 abort 가 호출되지 않는다.
#   이 크론이 없으면 그 재고가 영구히 묶여 재고 1개짜리 상품이 "품절"로 굳는다.
#   (정리 기준 30분, 대상 판정은 app/src/lib/orderCleanup.ts 가 담당)
#
# 사용:
#   bash scripts/cleanup-pending.sh
#
# 환경변수(선택):
#   REPO_DIR     기본: 이 스크립트의 상위 디렉토리
#   CLEANUP_URL  기본: http://127.0.0.1:3000/api/cron/cleanup-pending
#                (외부 도메인 대신 로컬 호출 — TLS/DNS 왕복 없이 앱에 직접 붙는다)
#
# CRON_SECRET 은 app/.env 에서 읽는다. 크론 라인에 시크릿을 노출하지 않기 위함이다.

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
ENV_FILE="$REPO_DIR/app/.env"
CLEANUP_URL="${CLEANUP_URL:-http://127.0.0.1:3026/api/cron/cleanup-pending}"

ts() { date -Iseconds; }

if [ ! -f "$ENV_FILE" ]; then
  echo "[cleanup-pending] $(ts) ERROR: .env 없음: $ENV_FILE" >&2
  exit 1
fi

# 값에 = 가 들어가도 잘리지 않도록 첫 = 뒤 전체를 취하고, 감싼 따옴표만 제거한다.
SECRET="$(sed -n 's/^CRON_SECRET=//p' "$ENV_FILE" | head -n1 | sed 's/^["'\'']//; s/["'\'']$//')"
if [ -z "$SECRET" ]; then
  echo "[cleanup-pending] $(ts) ERROR: CRON_SECRET 미설정 ($ENV_FILE)" >&2
  exit 1
fi

# --fail 로 4xx/5xx 를 종료코드로 드러낸다(인증 실패·503 을 조용히 넘기지 않기 위함).
RESPONSE="$(curl -sS --fail --max-time 60 \
  -H "Authorization: Bearer ${SECRET}" \
  "$CLEANUP_URL")" || {
  echo "[cleanup-pending] $(ts) ERROR: 호출 실패 (exit $?) url=$CLEANUP_URL" >&2
  exit 1
}

echo "[cleanup-pending] $(ts) $RESPONSE"
