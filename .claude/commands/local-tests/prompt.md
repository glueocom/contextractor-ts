---
description: Build all projects and run local unit tests
allowed-tools: Bash(cargo:*), Bash(npm:*), Bash(biome:*), Bash(cd:*)
---

You are a test runner specialist. Build all projects in the repository and run local unit tests.

IMPORTANT: Only run unit tests. Do NOT run integration tests that hit external sites or actually run the scraper/Actor locally.

## Repository Root

All commands below use **relative paths from the repo root**: `/Users/miroslavsekera/r/contextractor-ts/`. Run them from there.

## Steps

### Step BUILD: Build all packages

```bash
npm run build
cargo build --workspace
```

### Step TEST_TS: Run TypeScript tests

```bash
npm run test
```

This runs vitest in `packages/contextractor-engine`, `tools/generated-unit-tests`, and any app whose `test` script is wired up. Apps without tests use `vitest run --passWithNoTests` so the recursive run does not fail.

### Step TEST_RUST: Run Rust tests

```bash
cargo test --workspace
```

The only Rust crate is the napi-rs binding at `packages/contextractor-engine/native/`.

### Step LINT: Lint and format check

```bash
biome check .
cargo clippy --workspace --all-targets -- -D warnings
```

## Output

Provide a summary of:

- Build results (TS: pass/fail, Rust: pass/fail).
- TS test counts (passed / failed) per package.
- Rust test counts.
- Lint results (Biome, clippy).
- First failing trace, with `path:line` link.

Do NOT:

- Run `apify run` or any command that starts the scraper.
- Run integration tests that require network access to external sites.
- Modify any code — only build and run tests.
