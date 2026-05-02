#!/usr/bin/env bash
# Runs each autonomous-maintenance sub-command in its own Claude Code session.
# Each session is small and focused; autonomous-task-output/claude/ files coordinate between them.
# Mirrors the execution order in maintenance.md (generate → sync → test → validate → commit).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT"

# shellcheck source=lib/claude.sh
source "$SCRIPT_DIR/lib/claude.sh"

rm -rf autonomous-task-output/claude
mkdir -p autonomous-task-output/claude/reports autonomous-task-output/claude/prompts

claude_run "/autonomous:maintenance:deps/update"
claude_run "/autonomous:maintenance:schema/gen-input-schema"
claude_run "/autonomous:maintenance:docs/gen-md-regions"
claude_run "/autonomous:maintenance:sync/gui"
claude_run "/autonomous:maintenance:sync/docs"
claude_run "/autonomous:maintenance:sync/opencode"
claude_run "/autonomous:maintenance:test/local"
claude_run "/autonomous:maintenance:test/typescript-autofix"
claude_run "/autonomous:maintenance:test/dead-code-autofix"
claude_run "/autonomous:maintenance:test/deps-autofix"
claude_run "/autonomous:maintenance:test/spelling-autofix"
claude_run "/autonomous:maintenance:schema/validate"

echo ""
echo "[autonomous:maintenance:claude] Committing results..."
claude_run "/git:commit"

echo "[autonomous:maintenance:claude] Done."
