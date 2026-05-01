---
description: Build all projects and run local unit tests, auto-fixing lint and format issues
---

Build all projects in the repository, run local unit tests, and auto-fix lint and format issues. Save a report to `autonomous-task-output/`.

IMPORTANT: Only run unit tests. Do NOT run integration tests that hit external sites or start the scraper/Actor locally.

## Repository Root

All commands use **relative paths from the repo root**: `/Users/miroslavsekera/r/contextractor-ts/`. Run them from there.

## Step FORMAT: Auto-fix Format Issues

```bash
cargo fmt --all
pnpm format
```

Automatically fix any formatting issues before running tests.

## Step BUILD: Build All Packages

```bash
pnpm build
cargo build --workspace
```

If the build fails, read the error output, identify the root cause, fix the code, and retry.

## Step TEST_TS: Run TypeScript Tests

```bash
pnpm test
```

This runs vitest in `packages/extraction`, `packages/schema`, `apps/standalone`, and any app whose `test` script is wired up. Apps without tests use `vitest run --passWithNoTests`.

If tests fail:
- Read the error output for each failing test
- Fix obvious issues (wrong assertions, missing fixtures, import errors)
- Retry — do NOT skip failing tests

## Step TEST_RUST: Run Rust Tests

```bash
cargo test --workspace
```

The only Rust crate is the napi-rs binding at `packages/extraction/native/`.

If tests fail, read the error and fix the code.

## Step LINT: Lint and Fix

```bash
biome check --write .
cargo clippy --workspace --all-targets -- -D warnings
```

Fix clippy warnings in `packages/extraction/native/src/` by editing the code — never add `#[allow]` annotations.

## Step REPORT: Save Report

Save `autonomous-task-output/test-local-report.md` with:
- Build results (TS: pass/fail, Rust: pass/fail)
- TS test counts (passed / failed) per package
- Rust test counts
- Lint results (Biome, clippy)
- First failing trace, with `path:line` link
- Code changes made (if any)
- Any issues that could not be auto-fixed (save to `autonomous-task-output/test-local-prompt.md`)
