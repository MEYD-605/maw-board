#!/usr/bin/env bash
set -Eeuo pipefail

SERVICE=${SERVICE:-sshx-server.service}
BIN_NAME=${BIN_NAME:-sshx-server}
REPO_ROOT=${REPO_ROOT:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"}
TARGET_BINARY=${TARGET_BINARY:-"$REPO_ROOT/target/release/$BIN_NAME"}
INSTALL_DIR=${INSTALL_DIR:-/opt/maw-board/bin}
LIVE_BINARY=${LIVE_BINARY:-"$INSTALL_DIR/$BIN_NAME"}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:${PORT:-8051}/api/healthz}
HEALTH_TIMEOUT_SECONDS=${HEALTH_TIMEOUT_SECONDS:-30}
HEALTH_INTERVAL_SECONDS=${HEALTH_INTERVAL_SECONDS:-1}
CURL_MAX_TIME_SECONDS=${CURL_MAX_TIME_SECONDS:-2}
SYSTEMCTL=${SYSTEMCTL:-systemctl}
NEED_SUDO=${NEED_SUDO:-auto}
BACKUP_PATH=
TMP_BINARY=

log() { printf '[swap] %s\n' "$*" >&2; }

cleanup() {
  [[ -z ${BACKUP_PATH:-} ]] || rm -f "$BACKUP_PATH"
  [[ -z ${TMP_BINARY:-} ]] || as_root rm -f "$TMP_BINARY"
}

as_root() {
  if [[ $NEED_SUDO == 0 || $EUID -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

systemctl_cmd() {
  if [[ -n $SYSTEMCTL ]]; then
    as_root "$SYSTEMCTL" "$@"
  fi
}

poll_health() {
  local deadline status
  deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
  while (( SECONDS <= deadline )); do
    status=$(curl -sS -o /dev/null -w '%{http_code}' \
      --max-time "$CURL_MAX_TIME_SECONDS" "$HEALTH_URL" || true)
    if [[ $status == 200 ]]; then
      log "health check passed: $HEALTH_URL"
      return 0
    fi
    sleep "$HEALTH_INTERVAL_SECONDS"
  done
  log "health check failed: $HEALTH_URL did not return 200 within ${HEALTH_TIMEOUT_SECONDS}s"
  return 1
}

rollback() {
  local backup=$1 tmp=${LIVE_BINARY}.rollback.$$
  if [[ ! -f $backup ]]; then
    log 'rollback unavailable: no previous binary was present'
    return 1
  fi
  log "rolling back to previous binary: $backup"
  as_root install -m 0755 "$backup" "$tmp"
  as_root mv -f "$tmp" "$LIVE_BINARY"
  systemctl_cmd restart "$SERVICE"
}

main() {
  BACKUP_PATH=$(mktemp "${TMPDIR:-/tmp}/${BIN_NAME}.previous.XXXXXX")
  TMP_BINARY=${LIVE_BINARY}.new.$$
  trap cleanup EXIT

  log 'building release binary'
  cargo build --release --bin "$BIN_NAME" --manifest-path "$REPO_ROOT/Cargo.toml"
  test -x "$TARGET_BINARY"

  as_root install -d -m 0755 "$INSTALL_DIR"
  if [[ -f $LIVE_BINARY ]]; then
    as_root cp -p "$LIVE_BINARY" "$BACKUP_PATH"
  else
    rm -f "$BACKUP_PATH"
  fi

  log "installing new binary at $LIVE_BINARY"
  as_root install -m 0755 "$TARGET_BINARY" "$TMP_BINARY"
  as_root mv -f "$TMP_BINARY" "$LIVE_BINARY"

  log "restarting $SERVICE"
  if ! systemctl_cmd restart "$SERVICE"; then
    log 'restart failed after binary swap'
    rollback "$BACKUP_PATH" || true
    exit 1
  fi

  if ! poll_health; then
    rollback "$BACKUP_PATH" || true
    poll_health || true
    exit 1
  fi

  log 'deploy complete'
}

main "$@"
