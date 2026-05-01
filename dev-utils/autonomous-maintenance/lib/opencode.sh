# Source-able library for running opencode slash commands.
# Usage: source "$(dirname "$0")/lib/opencode.sh"
# Guard prevents double-sourcing when multiple scripts source this file.
[[ -n "${_AM_OPENCODE_LIB:-}" ]] && return 0
_AM_OPENCODE_LIB=1

# Run an opencode slash command in an isolated session.
# Streams all output to stdout so it appears live in the terminal.
opencode_run() {
  local cmd="$1"
  echo ""
  echo "[opencode] Running $cmd ..."
  opencode run "$cmd"
}
