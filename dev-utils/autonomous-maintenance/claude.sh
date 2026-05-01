#!/usr/bin/env bash
# Runs the autonomous-maintenance orchestrator in a single Claude Code session.
# All sub-commands execute in order (schema gen → docs → sync → tests → validate),
# reports are saved to autonomous-task-output/, and changes are committed at the end.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

echo "[autonomous-maintenance:claude] Starting maintenance session..."
claude -p "/autonomous-maintenance:maintenance"
echo "[autonomous-maintenance:claude] Done."
