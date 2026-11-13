#!/usr/bin/env bash
# Fight IQ 서버 배포 (blue/green).
#
#   ./deploy.sh               앱 배포 (새 슬롯을 띄워 건강 확인 후 트래픽 전환, 워커 재시작)
#   ./deploy.sh --nginx       앱 배포 + 호스트 nginx vhost(fightiq.runvia.app) 설치·갱신 — 처음 한 번
#   ./deploy.sh --nginx-only  nginx vhost 만 설치·갱신 (앱 배포 전에 도메인부터 연결할 때)
#
# nginx: *.runvia.app 의 HTTPS 는 /etc/nginx/conf.d/runvia-wildcard-ssl.conf 가 받아 :80 으로 넘기므로
#        여기서는 HTTP vhost 하나만 둔다 (sdrift 등 다른 runvia 서비스와 같은 방식).
#        sites-available/enabled 는 nginx-admin 그룹이 쓸 수 있어 sudo 없이 설치하고,
#        다시 읽기(reload)는 sudo 가 비밀번호 없이 되면 바로, 아니면 실행할 명령을 안내한다.
#
# 환경 변수:
#   BRANCH=main              배포할 git 브랜치 (git 원격 저장소가 있을 때)
#   SKIP_PULL=1              git pull 없이 지금 파일 그대로 배포
set -euo pipefail

cd "$(dirname "$(readlink -f "$0")")"

BRANCH="${BRANCH:-main}"
DOMAIN="fightiq.runvia.app"
RUN_NGINX=0
NGINX_ONLY=0

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

usage() {
  printf 'Usage: %s [--nginx | --nginx-only]\n' "${0##*/}"
  printf '  --nginx       앱 배포 후 호스트 nginx vhost 도 설치·갱신\n'
  printf '  --nginx-only  호스트 nginx vhost 만 설치·갱신\n'
}

for arg in "$@"; do
  case "$arg" in
    --nginx) RUN_NGINX=1 ;;
    --nginx-only) NGINX_ONLY=1 ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; die "알 수 없는 인자: $arg" ;;
  esac
done

APP_PORT="$( (grep -E '^APP_PORT=' .env 2>/dev/null || true) | tail -n1 | cut -d= -f2-)"
APP_PORT="${APP_PORT:-6060}"

install_nginx() {
  local avail="/etc/nginx/sites-available/$DOMAIN.conf"
  local enabled="/etc/nginx/sites-enabled/$DOMAIN.conf"
  local tmp changed=0
  [ -d /etc/nginx/sites-available ] || die "/etc/nginx/sites-available 가 없습니다 (nginx 설치 확인)"
  tmp="$(mktemp)"
  sed "s|__APP_PORT__|$APP_PORT|g" "nginx/$DOMAIN.conf" > "$tmp"

  if ! cmp -s "$tmp" "$avail" 2>/dev/null; then
    # 호스트 설정을 건드리기 전에 일회용 nginx 컨테이너로 문법 검사
    if ! docker run --rm --network none --entrypoint nginx -v "$tmp:/etc/nginx/conf.d/default.conf:ro" nginx:1.28-alpine -t -q; then
      rm -f "$tmp"
      die "nginx/$DOMAIN.conf 문법 오류 — 호스트 설정은 그대로입니다"
    fi
    if [ -w /etc/nginx/sites-available ]; then
      install -m 664 "$tmp" "$avail"
    else
      sudo -n install -m 644 "$tmp" "$avail" 2>/dev/null || { rm -f "$tmp"; die "$avail 에 쓸 권한이 없습니다 (nginx-admin 그룹 또는 sudo 필요)"; }
    fi
    changed=1
    log "nginx vhost 설치: $avail (→ 127.0.0.1:$APP_PORT)"
  fi
  rm -f "$tmp"

  if [ ! -L "$enabled" ]; then
    ln -sf "$avail" "$enabled" 2>/dev/null || sudo -n ln -sf "$avail" "$enabled" 2>/dev/null || die "$enabled 링크를 만들 권한이 없습니다"
    changed=1
    log "nginx vhost 활성화: $enabled"
  fi

  if [ "$changed" = "0" ]; then
    log "nginx vhost 변경 없음"
  elif sudo -n true 2>/dev/null; then
    sudo nginx -t && sudo systemctl reload nginx && log "nginx 다시 읽음"
  else
    warn "nginx 설정이 바뀌었습니다. 아래 명령을 한 번 실행해 주세요:"
    warn "  sudo nginx -t && sudo systemctl reload nginx"
  fi
}

if [ "$NGINX_ONLY" = "1" ]; then
  command -v docker >/dev/null || die "docker 가 설치돼 있지 않습니다"
  install_nginx
  exit 0
fi

# --- 1. 사전 확인 ----------------------------------------------------------------
command -v docker >/dev/null || die "docker 가 설치돼 있지 않습니다"
docker compose version >/dev/null 2>&1 || die "docker compose 플러그인이 없습니다"
command -v curl >/dev/null || die "curl 이 설치돼 있지 않습니다"

if [ ! -f .env ]; then
  cp .env.example .env
  die ".env.example 로 .env 를 만들었습니다 — 값을 채운 뒤 ./deploy.sh 를 다시 실행하세요."
fi

# --- 2. 코드 갱신 ----------------------------------------------------------------
if [ "${SKIP_PULL:-0}" != "1" ] && [ -d .git ] && git remote get-url origin >/dev/null 2>&1; then
  log "origin/$BRANCH 가져오는 중"
  before="$(git rev-parse HEAD)"
  git fetch --quiet origin "$BRANCH"
  git checkout --quiet "$BRANCH"
  git merge --ff-only --quiet "origin/$BRANCH"
  after="$(git rev-parse HEAD)"
  if [ "$before" != "$after" ] && ! git diff --quiet "$before" "$after" -- deploy.sh; then
    log "deploy.sh 가 바뀌어 새 스크립트로 다시 실행합니다"
    SKIP_PULL=1 exec "$0" "$@"
  fi
  log "현재 $(git log -1 --format='%h %s')"
else
  log "git pull 건너뜀 (지금 파일 그대로 배포)"
fi

# --- 3. blue/green 배포 -----------------------------------------------------------
mkdir -p .deploy/nginx

active=""
if [ -f .deploy/active-slot ]; then
  active="$(tr -d '[:space:]' < .deploy/active-slot)"
fi
if [ "$active" != "blue" ] && [ "$active" != "green" ]; then active=""; fi
if [ "$active" = "blue" ]; then target="green"; else target="blue"; fi
target_service="app-$target"

git_revision="$(git rev-parse --short=12 HEAD 2>/dev/null || date -u +%H%M%S)"
release="$(date -u +%Y%m%d%H%M%S)-$git_revision"
log "릴리스 $release 를 $target 슬롯에 빌드"
IMAGE_TAG="$release" DEPLOYMENT_VERSION="$release" docker compose build --pull "$target_service"

log "DB 와 $target_service 시작"
docker compose up -d db
IMAGE_TAG="$release" DEPLOYMENT_VERSION="$release" docker compose up -d --no-deps --force-recreate "$target_service"

log "$target_service 건강 확인 대기"
healthy=0
for _ in $(seq 1 60); do
  if IMAGE_TAG="$release" docker compose exec -T "$target_service" \
    wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep 2
done
if [ "$healthy" != "1" ]; then
  IMAGE_TAG="$release" docker compose logs --tail=80 "$target_service"
  die "$target_service 가 건강해지지 않았습니다. 기존 릴리스는 그대로입니다."
fi
log "$target_service 정상"

write_gateway_config() {
  slot="$1"
  sed "s|__APP_SERVICE__|app-$slot|g" nginx/gateway.conf > .deploy/nginx/default.conf.tmp
  mv .deploy/nginx/default.conf.tmp .deploy/nginx/default.conf
}

write_gateway_config "$target"
if docker compose ps --status running --quiet gateway | grep -q .; then
  log "트래픽을 $target 슬롯으로 전환"
  docker compose exec -T gateway nginx -t
  docker compose exec -T gateway nginx -s reload
else
  log "내부 게이트웨이 시작 (127.0.0.1:$APP_PORT)"
  docker compose up -d --no-deps gateway
fi

log "전환된 게이트웨이 확인"
gateway_healthy=0
for _ in $(seq 1 15); do
  if curl -fsS "http://127.0.0.1:$APP_PORT/api/health" >/dev/null 2>&1; then
    gateway_healthy=1
    break
  fi
  sleep 1
done
if [ "$gateway_healthy" != "1" ]; then
  if [ -n "$active" ]; then
    warn "게이트웨이 확인 실패 — $active 슬롯으로 되돌립니다"
    write_gateway_config "$active"
    docker compose exec -T gateway nginx -t
    docker compose exec -T gateway nginx -s reload
  fi
  die "게이트웨이가 정상 응답하지 않습니다"
fi
printf '%s\n' "$target" > .deploy/active-slot
log "트래픽이 $target 슬롯에 있습니다. 이전 슬롯은 롤백용으로 남겨 둡니다."

# 문제 생성 워커 — 브릿지 키가 있을 때만
if grep -qE '^FIQ_BRIDGE_KEY=.+' .env; then
  if docker network inspect junlab-ai >/dev/null 2>&1; then
    log "문제 생성 워커 빌드·재시작"
    IMAGE_TAG="$release" docker compose --profile worker build worker
    IMAGE_TAG="$release" docker compose --profile worker up -d --no-deps --force-recreate worker
  else
    warn "junlab-ai 네트워크가 없어 워커를 건너뜁니다 (desktop-ai 가 떠 있어야 함)"
  fi
else
  log "FIQ_BRIDGE_KEY 가 없어 워커는 띄우지 않음"
fi

# 오래된 이미지 정리 (현재·직전 릴리스는 남긴다)
docker image ls fight-iq-worker --format '{{.Tag}}' | sort -r | tail -n +3 | while read -r tag; do
  docker image rm "fight-iq-worker:$tag" >/dev/null 2>&1 || true
done
docker image ls fight-iq --format '{{.Tag}}' | sort -r | tail -n +4 | while read -r tag; do
  docker image rm "fight-iq:$tag" >/dev/null 2>&1 || true
done

# --- 4. (선택) 호스트 nginx ---------------------------------------------------------
if [ "$RUN_NGINX" = "1" ]; then
  install_nginx
else
  log "호스트 nginx 설정은 건너뜀 (--nginx 로 설치·갱신)"
fi

log "배포 완료 — https://$DOMAIN"
