# Source-able library for running Claude Code slash commands.
# Usage: source "$(dirname "$0")/lib/claude.sh"
# Guard prevents double-sourcing when multiple scripts source this file.
[[ -n "${_AM_CLAUDE_LIB:-}" ]] && return 0
_AM_CLAUDE_LIB=1

# Run a Claude Code slash command in an isolated session.
# Streams all output to stdout so it appears live in the terminal.
claude_run() {
  local cmd="$1"
  if [[ "${STUB_MODE:-}" == "1" ]]; then
    echo "[STUB] running hello-world for: $cmd"
    claude -p "ok"
    return 0
  fi
  echo ""
  echo "[claude] Running $cmd ..."
  claude --effort max -p "$cmd" --output-format stream-json | \
    jq -r --unbuffered '
      if .type == "assistant" then
        .message.content[]? |
        if .type == "text" and (.text | length > 0) then .text
        elif .type == "tool_use" then
          "  [\(.name)] \(.input | to_entries | first | "\(.key): \(.value | tostring | .[0:120])")"
        else empty
        end
      elif .type == "result" then
        "[done:\(.subtype) \(.duration_ms // 0)ms]"
      else empty
      end
    '
}
