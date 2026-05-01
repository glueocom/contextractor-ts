#!/usr/bin/env bash
# Runs the full autonomous-maintenance pipeline:
#   1. claude-meta.sh   — Claude audits and fixes .claude/ setup
#   2. opencode-meta.sh — opencode audits and fixes .opencode/ setup
#   3. claude.sh        — Claude does maintenance, commits, and pushes
#   4. opencode.sh      — opencode re-syncs .opencode/ and runs its own maintenance pass
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[autonomous-maintenance:all] === Meta setup audit (Claude) ==="
bash "$SCRIPTS_DIR/claude-meta.sh"

echo ""
echo "[autonomous-maintenance:all] === Meta setup audit (opencode) ==="
bash "$SCRIPTS_DIR/opencode-meta.sh"

echo ""
echo "[autonomous-maintenance:all] === Claude pass ==="
bash "$SCRIPTS_DIR/claude.sh"

echo ""
echo "[autonomous-maintenance:all] === opencode pass ==="
bash "$SCRIPTS_DIR/opencode.sh"

echo ""
echo "[autonomous-maintenance:all] All done."
