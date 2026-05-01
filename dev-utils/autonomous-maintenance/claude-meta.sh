#!/usr/bin/env bash
# Runs the autonomous-maintenance meta/setup audit in its own Claude Code session.
# Audits and auto-fixes .claude/ config — frontmatter, stale references, MCP alignment.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

rm -rf autonomous-task-output
mkdir -p autonomous-task-output

echo ""
echo "[autonomous-maintenance:claude-meta] Running /autonomous-maintenance:meta/setup ..."
claude -p "/autonomous-maintenance:meta/setup"

echo ""
echo "[autonomous-maintenance:claude-meta] Committing results..."
claude -p "/git:commit"

echo "[autonomous-maintenance:claude-meta] Done."
