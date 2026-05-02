# Source-able library for running opencode slash commands.
# Usage: source "$(dirname "$0")/lib/opencode.sh"
# Guard prevents double-sourcing when multiple scripts source this file.
[[ -n "${_AM_OPENCODE_LIB:-}" ]] && return 0
_AM_OPENCODE_LIB=1

# Launcher that sources .env before invoking opencode.
_OPENCODE_BIN="$(dirname "${BASH_SOURCE[0]}")/../../../opencode/opencode.sh"

# Run an opencode slash command in an isolated session.
# Streams all output to stdout so it appears live in the terminal.
opencode_run() {
  local cmd="$1"
  if [[ "${STUB_MODE:-}" == "1" ]]; then
    echo "[STUB] running hello-world for: $cmd"
    "$_OPENCODE_BIN" run --model opencode/gpt-5-nano "ok"
    return 0
  fi
  echo ""
  echo "[opencode] Running $cmd ..."
  "$_OPENCODE_BIN" run "$cmd"
}
