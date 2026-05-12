# run-all.sh Pipeline Report

**Date:** 2026-05-12
**Branch:** feature/npm-only3
**Total iterations:** 1 (no retries needed)
**Final exit status:** EXIT:0

## Sub-script Results

| Sub-script | Result |
|---|---|
| claude-meta (meta setup audit) | PASS |
| claude pass — deps:update | PASS |
| claude pass — schema:gen-input-schema | PASS (already in sync) |
| claude pass — docs:gen-md-regions | PASS (0 files updated) |
| claude pass — sync:gui | PASS (9/9 checks) |
| claude pass — sync:docs | PASS |
| claude pass — sync:opencode | PASS |
| claude pass — test:local | PASS (185 TS + 5 Rust tests) |
| claude pass — typescript-autofix | PASS (no fixes needed) |
| claude pass — deps-autofix | PASS (0 vulnerabilities) |
| claude pass — spelling-autofix | PASS (no genuine typos) |
| claude pass — schema:validate | PASS (all builds/lint/tests clean) |
| claude pass — git:commit | PASS (commit 94538bb pushed) |
| sync (.claude/ → .opencode/) | PASS |
| opencode pass | ALL SKIPPED (`timeout` not found — see fix below) |

## Fixes Applied

### Fix: `timeout` not available on macOS

**File:** `dev-utils/autonomous/maintenance/lib/opencode.sh`

**Problem:** The opencode pass skipped every step with `timeout: command not found` (exit 127). macOS does not ship a `timeout` binary — it requires `gtimeout` from GNU coreutils (`brew install coreutils`).

**Change:** Added cross-platform timeout resolution at library load time:
- Uses `gtimeout` if available (macOS with coreutils)
- Falls back to `timeout` (Linux)
- Falls back to running without a timeout limit if neither is available

This makes the opencode pass runnable on macOS without requiring coreutils, and without aborting the pipeline.

## Notable Findings

- **185 TypeScript tests** across 20 test files — all green
- **5 Rust tests** — all green
- **Biome lint** — 97 files, clean
- **cargo clippy -D warnings** — clean
- **9/9 GUI consistency checks** pass (schema, CLI, napi-rs binding all in sync)
- **0 security vulnerabilities** in TS or Rust dependencies
- `zerofrom` crate bumped 0.1.7 → 0.1.8 (transitive); full Rust chain recompiled cleanly
- pnpm updated 3 packages with no breaking changes
- `input_schema.json` already in sync (no regeneration needed)
- All `@generated` README regions already current
