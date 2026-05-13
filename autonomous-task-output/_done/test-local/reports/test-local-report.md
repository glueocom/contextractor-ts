# Local Test Report — 2026-05-12

## Build Results

| Target | Status |
|--------|--------|
| TypeScript (turbo) | PASS |
| Rust (cargo build) | PASS |

## TypeScript Test Results

| Package | Files | Tests |
|---------|-------|-------|
| `@contextractor/schema` | 4 passed | 79 passed |
| `@contextractor/crawler` | 3 passed | 18 passed |
| `@contextractor/extraction` | 2 passed | 16 passed |
| `@contextractor/apify` | 4 passed | 16 passed |
| `@contextractor/standalone` | 5 passed | 43 passed |
| `@contextractor/gen-md-regions` | 2 passed | 13 passed |
| `@contextractor/gen-input-schema` | 0 (no tests) | — |
| `@contextractor/opencode-sync` | 0 (no tests) | — |
| `@contextractor/extraction-native` | n/a (build only) | — |
| `@contextractor/crawler` | passWithNoTests | — |
| `@contextractor/apify` | passWithNoTests | — |

**Total: 20 test files, 185 tests — all passed**

## Rust Test Results

Crate: `contextractor-extraction-native` (`packages/extraction/native/`)

| Test | Status |
|------|--------|
| `tests::unknown_format_is_rejected` | ok |
| `tests::extract_metadata_populates_some_fields` | ok |
| `tests::extract_txt_returns_non_empty_content` | ok |
| `tests::extract_markdown_returns_non_empty_content` | ok |
| `tests::extract_all_formats_returns_four_keys` | ok |

**Total: 5 passed, 0 failed**

## Lint Results

| Linter | Status | Notes |
|--------|--------|-------|
| Biome (format) | PASS | 97 files checked, no fixes applied |
| Biome (check) | PASS | 97 files checked, no fixes applied |
| cargo clippy | PASS | No warnings |

## Format Step

`cargo fmt --all` — no changes needed.
`pnpm format` — 97 files checked, no fixes applied.

## Code Changes Made

None — repository was already clean.

## Issues That Could Not Be Auto-Fixed

None.
