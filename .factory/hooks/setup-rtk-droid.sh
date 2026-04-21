#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--dry-run]" >&2
      exit 1
      ;;
  esac
done

log() {
  echo "[setup-rtk-droid] $*"
}

run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run]'
    for arg in "$@"; do
      printf ' %q' "$arg"
    done
    printf '
'
    return 0
  fi
  "$@"
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

find_brew() {
  if has_cmd brew; then
    command -v brew
    return 0
  fi
  for candidate in /opt/homebrew/bin/brew /home/linuxbrew/.linuxbrew/bin/brew; do
    if [ -x "$candidate" ]; then
      printf '%s
' "$candidate"
      return 0
    fi
  done
  return 1
}

install_jq() {
  if has_cmd jq; then
    log "jq already installed"
    return 0
  fi
  log "Installing jq"
  local brew_bin
  if brew_bin="$(find_brew)"; then
    run "$brew_bin" install jq
  elif has_cmd apt-get; then
    run sudo apt-get update
    run sudo apt-get install -y jq
  elif has_cmd apt; then
    run sudo apt update
    run sudo apt install -y jq
  elif has_cmd dnf; then
    run sudo dnf install -y jq
  elif has_cmd yum; then
    run sudo yum install -y jq
  elif has_cmd pacman; then
    run sudo pacman -Sy --noconfirm jq
  else
    echo "Unable to install jq automatically. Install jq manually and rerun." >&2
    exit 1
  fi
}

install_rtk() {
  if has_cmd rtk; then
    log "rtk already installed"
    return 0
  fi
  log "Installing rtk"
  local brew_bin
  if brew_bin="$(find_brew)"; then
    run "$brew_bin" install rtk
  elif has_cmd cargo; then
    run cargo install rtk
  else
    echo "Unable to install rtk automatically. Install Homebrew or Rust cargo, then rerun." >&2
    exit 1
  fi
}

install_jq
install_rtk
log "Done. The repo-local RTK hook at .factory/hooks/rtk-rewrite.sh will activate in a fresh Droid session if rtk is on PATH."
