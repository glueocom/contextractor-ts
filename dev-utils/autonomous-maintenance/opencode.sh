#!/usr/bin/env bash
# Syncs .claude/ to .opencode/, then runs the autonomous-maintenance orchestrator
# via opencode. Run after claude.sh so .opencode/ reflects the latest .claude/ state.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

echo "[autonomous-maintenance:opencode] Syncing .claude/ -> .opencode/..."
pnpm opencode:sync

echo "[autonomous-maintenance:opencode] Running maintenance session..."
opencode run "/autonomous-maintenance-maintenance"
echo "[autonomous-maintenance:opencode] Done."
