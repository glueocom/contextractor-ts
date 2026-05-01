#!/usr/bin/env bash
# Runs the autonomous-maintenance meta/setup audit in its own Claude Code session.
# Audits and auto-fixes .claude/ config — frontmatter, stale references, MCP alignment.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# shellcheck source=lib/claude.sh
source "$SCRIPT_DIR/lib/claude.sh"

rm -rf autonomous-task-output
mkdir -p autonomous-task-output

claude_run "/autonomous-maintenance:meta/setup"

echo ""
echo "[autonomous-maintenance:claude-meta] Committing results..."
claude_run "/git:commit"

echo "[autonomous-maintenance:claude-meta] Done."
