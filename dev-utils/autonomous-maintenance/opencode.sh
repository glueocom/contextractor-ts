#!/usr/bin/env bash
# Runs each autonomous-maintenance sub-command in its own opencode session.
# Syncs .claude/ -> .opencode/ first so opencode has the latest commands.
# Mirrors the execution order in maintenance.md (generate → sync → test → validate → commit).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

run_cmd() {
  local cmd="$1"
  echo ""
  echo "[autonomous-maintenance:opencode] Running $cmd ..."
  opencode run "$cmd"
}

echo "[autonomous-maintenance:opencode] Syncing .claude/ -> .opencode/..."
pnpm opencode:sync

rm -rf autonomous-task-output
mkdir -p autonomous-task-output

run_cmd "/autonomous-maintenance-schema-gen-input-schema"
run_cmd "/autonomous-maintenance-docs-gen-md-regions"
run_cmd "/autonomous-maintenance-sync-gui"
run_cmd "/autonomous-maintenance-sync-docs"
run_cmd "/autonomous-maintenance-sync-opencode"
run_cmd "/autonomous-maintenance-test-local"
run_cmd "/autonomous-maintenance-test-typescript-autofix"
run_cmd "/autonomous-maintenance-test-dead-code-autofix"
run_cmd "/autonomous-maintenance-test-deps-autofix"
run_cmd "/autonomous-maintenance-test-spelling-autofix"
run_cmd "/autonomous-maintenance-schema-validate"

echo ""
echo "[autonomous-maintenance:opencode] Committing results..."
opencode run "/git-commit"

echo "[autonomous-maintenance:opencode] Done."
