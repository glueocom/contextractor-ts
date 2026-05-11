# Unit Tests: Full Monorepo Coverage

> **TLDR**: Runs after all implementation steps. Audits every package and app in the repo for test coverage gaps, writes missing tests, and ensures `pnpm test && cargo test --workspace` pass green across the full monorepo.

## Prerequisites

Steps 1–5 must be complete. `pnpm build` must succeed before running tests.

## Agents

- `ts-pro` — TypeScript test authoring
- `rust-pro` — Rust test authoring
- `test-runner` — run all checks

## Step AUDIT: Survey Existing Tests

For each package and app below, read the source files and the existing test files. Build a list of public functions, classes, and behaviours that have no test coverage or only superficial coverage.

### TypeScript packages and apps to audit

- `packages/extraction/src/` — extraction functions, format handling, metadata parsing, error paths
- `packages/crawler/src/` — crawler construction, sink composition, request building. **Historically zero test files** — always check `sinks/file.ts` (`FORMAT_EXTENSIONS`, `urlToFilename`, `fileSink`), `sinks/memory.ts` (`memorySink`), and `browser/launchOptions.ts` (`buildBrowserLaunchOptions`) first.
- `packages/schema/src/` — input schema parsing, output schema fields, `toApifySchema` conversion, `save` / `saveDestination` validation
- `apps/standalone/src/` — CLI argument parsing, format validation (`validateSaveFormats`), config merging, storage integration, sink routing, `original` format handling. Check `sinks.ts` (`createCliSink`, `jsonlSink`, `originalSink`, stdout/ndjson paths, dataset error isolation). Check `storage/` (`resolveStorageDir` precedence, Crawlee `Configuration` setup, `purgeOnStart: false` enforcement) and the library re-exports (Crawlee types accessible from public API).
- `apps/apify-actor/src/` — Actor config derivation, sink routing (`key-value-store` vs `dataset`), `saveOriginal` flag, `isRunningInDocker` detection

### Rust crate to audit

- `packages/extraction/native/src/` — unit tests in `#[cfg(test)] mod tests { … }` blocks; check coverage for format conversion, metadata extraction, and error paths

## Step WRITE: Add Missing Tests

For each gap identified in Step AUDIT, write the minimal test cases that cover the public behaviour. Follow `.claude/rules/testing.md` and `.claude/rules/test-maintenance.md`:

- TypeScript: `*.test.ts` next to source, vitest, temp directories via `fs.mkdtempSync` for any file I/O
- Rust: `#[cfg(test)] mod tests { … }` in the same source file; no `unwrap` in test bodies — use `expect` with a message

Do not rewrite passing tests. Add only what is missing. Do not add tests for private helpers if the callers already have tests that exercise the code path.

## Step RUN: Execute Full Test Suite

```bash
pnpm build
pnpm lint
pnpm test
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
```

## Step FIX: Auto-Fix Loop

For each failing test or lint error:

- Read the failing file and the source it tests.
- Apply the minimal fix (use Edit tool; never rewrite the whole file).
- Re-run only the affected command.
- Repeat until it exits 0.

Do not mark a criterion as passing until its command exits 0.

## Acceptance Criteria

- [ ] `pnpm build` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test` exits 0 — all vitest suites pass, no skipped or todo tests for functionality implemented in steps 1–3
- [ ] `cargo test --workspace` exits 0
- [ ] `cargo clippy --workspace --all-targets -- -D warnings` exits 0
- [ ] Every public function or class added in steps 1–3 has at least one test covering its primary behaviour
