#!/usr/bin/env bash
# Runs each autonomous-maintenance sub-command in its own opencode session.
# Syncs .claude/ -> .opencode/ first so opencode has the latest commands.
# Mirrors the execution order in maintenance.md (generate → sync → test → validate → commit).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT"

# shellcheck source=lib/opencode.sh
source "$SCRIPT_DIR/lib/opencode.sh"

echo "[autonomous:maintenance:opencode] Syncing .claude/ -> .opencode/..."
pnpm opencode:sync

rm -rf autonomous-task-output
mkdir -p autonomous-task-output

opencode_run "/autonomous-maintenance-deps-update"
opencode_run "/autonomous-maintenance-schema-gen-input-schema"
opencode_run "/autonomous-maintenance-docs-gen-md-regions"
opencode_run "/autonomous-maintenance-sync-gui"
opencode_run "/autonomous-maintenance-sync-docs"
opencode_run "/autonomous-maintenance-sync-opencode"
opencode_run "/autonomous-maintenance-test-local"
opencode_run "/autonomous-maintenance-test-typescript-autofix"
opencode_run "/autonomous-maintenance-test-dead-code-autofix"
opencode_run "/autonomous-maintenance-test-deps-autofix"
opencode_run "/autonomous-maintenance-test-spelling-autofix"
opencode_run "/autonomous-maintenance-schema-validate"

echo ""
echo "[autonomous:maintenance:opencode] Committing results..."
opencode_run "/git-commit"

echo "[autonomous:maintenance:opencode] Done."
