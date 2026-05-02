#!/usr/bin/env bash
# Syncs .claude/ -> .opencode/ so opencode has the latest commands after the Claude pass.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT"

echo "[autonomous:maintenance:sync] Syncing .claude/ -> .opencode/..."
pnpm opencode:sync

echo "[autonomous:maintenance:sync] Done."
