#!/usr/bin/env bash
# Runs the full autonomous-maintenance pipeline:
#   1. claude-meta.sh — Claude audits and fixes .claude/ setup
#   2. claude.sh      — Claude does maintenance, commits, and pushes
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "$0")/maintenance" && pwd)"

echo "[autonomous:maintenance:all] === Cleaning output directory ==="
rm -rf autonomous-task-output
mkdir -p autonomous-task-output

echo ""
echo "[autonomous:maintenance:all] === Meta setup audit (Claude) ==="
bash "$SCRIPTS_DIR/claude-meta.sh"

echo ""
echo "[autonomous:maintenance:all] === Claude pass ==="
bash "$SCRIPTS_DIR/claude.sh"

echo ""
echo "[autonomous:maintenance:all] All done."
