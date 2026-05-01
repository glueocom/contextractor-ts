# Source-able library for running Claude Code slash commands.
# Usage: source "$(dirname "$0")/lib/claude.sh"
# Guard prevents double-sourcing when multiple scripts source this file.
[[ -n "${_AM_CLAUDE_LIB:-}" ]] && return 0
_AM_CLAUDE_LIB=1

# Run a Claude Code slash command in an isolated session.
# Streams all output to stdout so it appears live in the terminal.
claude_run() {
  local cmd="$1"
  echo ""
  echo "[claude] Running $cmd ..."
  claude -p "$cmd"
}
