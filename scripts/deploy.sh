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
#
# 저사양 서버(RAM 911MB / 디스크 6.8G) 대응 기본값 — 필요 시 환경변수로 덮어쓴다:
#   PUPPETEER_SKIP_DOWNLOAD=true  puppeteer 가 Chrome(300MB+)을 받지 않도록 차단
#   SKIP_BUILD_CHECKS=true        빌드 중 타입/린트 검사 생략(OOM 방지). 로컬에서 `npx tsc --noEmit` 로 검증할 것
#   NODE_OPTIONS=--max-old-space-size=1536
#   MIN_FREE_MB=1200              빌드 시작 전 요구 디스크 여유(MB)
#   STOP_APP_DURING_BUILD=auto    auto|true|false — auto 는 RAM 2GB 미만이면 빌드 동안 앱 정지
#
# 안전 장치:
#   - 빌드 전 디스크 여유를 검사하고, 부족하면 빌드를 시작하지 않고 중단한다(서비스 유지).
#   - 기존 빌드(.next)를 .next.bak 으로 보존했다가 빌드 실패 시 되돌린다.

# `sh deploy.sh` 처럼 dash 로 호출돼도 bash 로 재실행되도록 가드 (pipefail 등 bashism 사용).
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

REPO_DIR="${1:-${REPO_DIR:-/home/ubuntu/vanillaform}}"
BRANCH="${2:-${BRANCH:-main}}"
PM2_APP_NAME="${3:-${PM2_APP_NAME:-vanillaform}}"
APP_DIR="$REPO_DIR/app"

export PUPPETEER_SKIP_DOWNLOAD="${PUPPETEER_SKIP_DOWNLOAD:-true}"
export SKIP_BUILD_CHECKS="${SKIP_BUILD_CHECKS:-true}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}"
export NEXT_TELEMETRY_DISABLED="${NEXT_TELEMETRY_DISABLED:-1}"
MIN_FREE_MB="${MIN_FREE_MB:-1200}"
STOP_APP_DURING_BUILD="${STOP_APP_DURING_BUILD:-auto}"

log() { printf '[deploy] %s\n' "$*"; }
die() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

# 지정 경로가 속한 파일시스템의 여유 공간(MB)
free_mb() { df -Pm "$1" | awk 'NR==2 {print $4}'; }
# 디렉토리 크기(MB). 없으면 0
dir_mb() { [ -d "$1" ] && du -sm "$1" 2>/dev/null | awk '{print $1}' || echo 0; }
# 총 메모리(MB)
total_ram_mb() { awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo; }

log "시작: $(date -Iseconds)"
log "REPO_DIR=$REPO_DIR  BRANCH=$BRANCH  PM2=$PM2_APP_NAME"
log "SKIP_BUILD_CHECKS=$SKIP_BUILD_CHECKS  PUPPETEER_SKIP_DOWNLOAD=$PUPPETEER_SKIP_DOWNLOAD  NODE_OPTIONS=$NODE_OPTIONS"

[ -d "$REPO_DIR/.git" ] || die "$REPO_DIR 가 git 저장소가 아님"

cd "$REPO_DIR"

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  log "경고: 서버 작업 트리에 수정된 파일이 있음 (아래 목록). pull 이 막히면 서버에서 직접 정리할 것."
  git status --short --untracked-files=no | sed 's/^/[deploy]   /'
fi

log "git fetch / checkout / pull --ff-only"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

cd "$APP_DIR"

log "npm ci"
npm ci --no-audit --no-fund

# npm ci 가 채운 캐시는 빌드에 불필요하므로 즉시 회수(수백 MB).
log "npm 캐시 정리"
npm cache clean --force >/dev/null 2>&1 || true

log "prisma generate"
npx prisma generate

# 스키마 변경 시에는 별도로 직접 실행 (자동화하지 않음):
#   npx prisma migrate deploy
#   또는 npx prisma db push

# ── 빌드 전 점검 ─────────────────────────────────────────────
rm -rf "$APP_DIR/.next.bak"

FREE_MB="$(free_mb "$APP_DIR")"
NEXT_MB="$(dir_mb "$APP_DIR/.next")"
RAM_MB="$(total_ram_mb)"
log "디스크 여유 ${FREE_MB}MB / 기존 빌드 ${NEXT_MB}MB / RAM ${RAM_MB}MB"

if [ "$FREE_MB" -lt "$MIN_FREE_MB" ]; then
  die "디스크 여유 ${FREE_MB}MB < 요구 ${MIN_FREE_MB}MB. 빌드를 시작하지 않고 중단한다(서비스는 계속 동작).
       정리 방법: sudo apt-get clean; sudo rm -rf /var/lib/apt/lists/*; sudo journalctl --vacuum-size=50M
       그래도 부족하면 EBS 볼륨을 늘릴 것."
fi

# 기존 빌드를 보존할 수 있으면 보존한다(같은 파일시스템이라 mv 자체는 공간을 쓰지 않음).
# 다만 빌드 중에는 구/신 빌드가 공존하므로 그만큼의 여유가 필요하다.
BACKED_UP=0
if [ "$NEXT_MB" -gt 0 ] && [ "$FREE_MB" -gt "$((NEXT_MB + MIN_FREE_MB))" ]; then
  log "기존 빌드를 .next.bak 으로 보존"
  mv "$APP_DIR/.next" "$APP_DIR/.next.bak"
  BACKED_UP=1
elif [ "$NEXT_MB" -gt 0 ]; then
  log "경고: 여유 공간이 부족해 기존 빌드를 보존하지 않는다. 빌드 실패 시 서비스가 중단될 수 있음."
fi

# 저사양 서버에서는 빌드 동안 앱을 내려 메모리를 확보한다(빌드 OOM 방지).
STOPPED_APP=0
case "$STOP_APP_DURING_BUILD" in
  true) DO_STOP=1 ;;
  false) DO_STOP=0 ;;
  *) [ "$RAM_MB" -lt 2000 ] && DO_STOP=1 || DO_STOP=0 ;;
esac

if [ "$DO_STOP" = "1" ] && pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  log "메모리 확보를 위해 빌드 동안 pm2 앱 정지 (RAM ${RAM_MB}MB)"
  pm2 stop "$PM2_APP_NAME" >/dev/null
  STOPPED_APP=1
fi

restore_and_fail() {
  log "빌드 실패 — 복구 시작"
  rm -rf "$APP_DIR/.next"
  if [ "$BACKED_UP" = "1" ]; then
    mv "$APP_DIR/.next.bak" "$APP_DIR/.next"
    log "이전 빌드로 되돌림"
  else
    log "되돌릴 이전 빌드가 없음. 공간 확보 후 재배포 필요."
  fi
  if [ "$STOPPED_APP" = "1" ]; then
    pm2 start "$PM2_APP_NAME" >/dev/null 2>&1 || pm2 restart "$PM2_APP_NAME" >/dev/null 2>&1 || true
    log "pm2 앱 재기동"
  fi
  die "next build 실패"
}

log "next build"
npm run build || restore_and_fail

rm -rf "$APP_DIR/.next.bak"
log "빌드 성공 (디스크 여유 $(free_mb "$APP_DIR")MB)"

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
