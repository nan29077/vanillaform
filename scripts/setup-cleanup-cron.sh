#!/usr/bin/env bash
# 미결제 PENDING 주문 정리를 5분마다 실행하도록 crontab 에 등록.
#
# - 마커 주석으로 기존 등록을 찾아 교체하므로 여러 번 실행해도 중복되지 않음(멱등)
# - DB 백업 크론(setup-backup-cron.sh)과 같은 방식. 기존 등록은 건드리지 않는다.
#
# 사용:
#   bash scripts/setup-cleanup-cron.sh
#
# 사전 조건: app/.env 에 CRON_SECRET 설정 + 앱 재시작(pm2 restart --update-env)

if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
CLEANUP_SCRIPT="$REPO_DIR/scripts/cleanup-pending.sh"
LOG_FILE="$REPO_DIR/logs/cleanup-pending.log"
MARKER="# vanillaform-cleanup-pending"

log() { printf '[setup-cleanup-cron] %s\n' "$*"; }

if [ ! -f "$CLEANUP_SCRIPT" ]; then
  echo "[setup-cleanup-cron] ERROR: 스크립트 없음: $CLEANUP_SCRIPT" >&2
  exit 1
fi

chmod +x "$CLEANUP_SCRIPT"
mkdir -p "$(dirname "$LOG_FILE")"

if command -v systemctl >/dev/null 2>&1; then
  if ! systemctl is-active --quiet cron 2>/dev/null; then
    log "경고: cron 서비스가 비활성 상태일 수 있음. 활성화: sudo systemctl enable --now cron"
  fi
fi

# 5분마다. 정리 기준이 30분이라 5분 주기면 재고가 최대 35분 묶인다.
CRON_JOB_LINE="*/5 * * * * bash ${CLEANUP_SCRIPT} >> ${LOG_FILE} 2>&1 ${MARKER}"

# 기존 마커 라인 제거 후 새로 추가 (멱등). 다른 크론(DB 백업 등)은 그대로 유지.
CURRENT="$(crontab -l 2>/dev/null || true)"
CLEANED="$(printf '%s\n' "$CURRENT" | grep -vF "$MARKER" || true)"

{
  printf '%s\n' "$CLEANED" | sed '/^$/d'
  printf '%s\n' "$CRON_JOB_LINE"
} | crontab -

log "crontab 등록 완료:"
crontab -l | grep -F "$MARKER" || true
log ""
log "실행 주기: 5분마다"
log "로그 확인:  tail -f $LOG_FILE"
log "즉시 테스트: bash $CLEANUP_SCRIPT"
