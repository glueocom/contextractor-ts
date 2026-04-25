---
description: Build all projects and run local unit tests
allowed-tools: Bash(cargo:*), Bash(cd:*)
---

You are a test runner specialist. Build all projects in the repository and run local unit tests.

IMPORTANT: Only run unit tests. Do NOT run integration tests that hit external sites or actually run the scraper/Actor locally.

## Repository Root

All commands below use **relative paths from the repo root**: `/Users/miroslavsekera/r/contextractor-ts/`. Run them from there.

## Projects to Build and Test

### 1. Generated Unit Tests (`tools/generated-unit-tests`)

```bash
cargo test -p generated-unit-tests
```

### 2. Main Actor (`apps/contextractor`)

```bash
cargo test -p contextractor
```

## Execution Steps

1. Confirm the working directory is the repo root (`pwd` should print `/Users/miroslavsekera/r/contextractor-ts`)
2. Run unit tests for `tools/generated-unit-tests` first
3. Run unit tests for `apps/contextractor`
4. Report a summary of all test results

## Output

Provide a summary of:

- Number of tests passed/failed for each crate
- Any errors encountered during build/test
- First failing trace, with `path:line` link

Do NOT:

- Run `apify run` or any command that starts the scraper
- Run integration tests that require network access to external sites
- Modify any code — only build and run tests
