#!/usr/bin/env bash
# 바닐라폼 전용 서버 배포 + 재시작 스크립트.
#
# 사용 방법:
#   1) 로컬(Windows)에서: scripts/deploy-remote.ps1 가 이 파일을 SSH stdin 으로 실행
#   2) 서버에서 직접:    bash scripts/deploy.sh   (또는 chmod +x 후 ./scripts/deploy.sh)
#
# 인자/환경변수 (인자 우선):
#   $1 / REPO_DIR       기본 /home/ubuntu/vanillaform
#   $2 / BRANCH         기본 main
#   $3 / PM2_APP_NAME   기본 vanillaform

# `sh deploy.sh` 처럼 dash 로 호출돼도 bash 로 재실행되도록 가드 (pipefail 등 bashism 사용).
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

REPO_DIR="${1:-${REPO_DIR:-/home/ubuntu/vanillaform}}"
BRANCH="${2:-${BRANCH:-main}}"
PM2_APP_NAME="${3:-${PM2_APP_NAME:-vanillaform}}"
APP_DIR="$REPO_DIR/app"

log() { printf '[deploy] %s\n' "$*"; }

log "시작: $(date -Iseconds)"
log "REPO_DIR=$REPO_DIR  BRANCH=$BRANCH  PM2=$PM2_APP_NAME"

if [ ! -d "$REPO_DIR/.git" ]; then
  log "ERROR: $REPO_DIR 가 git 저장소가 아님" >&2
  exit 1
fi

cd "$REPO_DIR"

log "git fetch / checkout / pull --ff-only"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

cd "$APP_DIR"

log "npm ci"
npm ci

log "prisma generate"
npx prisma generate

# 스키마 변경 시에는 별도로 직접 실행 (자동화하지 않음):
#   npx prisma migrate deploy
#   또는 npx prisma db push

log "next build"
npm run build

if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  log "pm2 restart $PM2_APP_NAME"
  pm2 restart "$PM2_APP_NAME" --update-env
  pm2 save
else
  log "PM2 앱 '$PM2_APP_NAME' 미등록. 최초 1회는 직접 등록 필요:" >&2
  log "  cd $APP_DIR && pm2 start ecosystem.config.cjs && pm2 save" >&2
  exit 1
fi

log "=== 완료 ==="
pm2 status
