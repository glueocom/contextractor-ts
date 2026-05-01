#!/usr/bin/env bash
# Runs the autonomous-maintenance meta/setup audit via opencode.
# Syncs .claude/ -> .opencode/ first so opencode has the latest commands.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

echo "[autonomous-maintenance:opencode-meta] Syncing .claude/ -> .opencode/..."
pnpm opencode:sync

rm -rf autonomous-task-output
mkdir -p autonomous-task-output

echo ""
echo "[autonomous-maintenance:opencode-meta] Running /autonomous-maintenance-meta-setup ..."
opencode run "/autonomous-maintenance-meta-setup"

echo ""
echo "[autonomous-maintenance:opencode-meta] Committing results..."
opencode run "/git-commit"

echo "[autonomous-maintenance:opencode-meta] Done."
