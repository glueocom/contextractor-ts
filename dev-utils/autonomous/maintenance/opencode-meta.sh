#!/usr/bin/env bash
# Runs the autonomous-maintenance meta/setup audit via opencode.
# Syncs .claude/ -> .opencode/ first so opencode has the latest commands.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT"

# shellcheck source=lib/opencode.sh
source "$SCRIPT_DIR/lib/opencode.sh"

echo "[autonomous:maintenance:opencode-meta] Syncing .claude/ -> .opencode/..."
pnpm opencode:sync

rm -rf autonomous-task-output
mkdir -p autonomous-task-output

opencode_run "/autonomous-maintenance-meta-setup"

echo ""
echo "[autonomous:maintenance:opencode-meta] Committing results..."
opencode_run "/git-commit"

echo "[autonomous:maintenance:opencode-meta] Done."
