# Local Test Report

**Date:** 2026-05-12  
**Agent:** test-runner  
**Branch:** feature/npm-only3

---

## Build Results

| Layer | Result |
|-------|--------|
| TypeScript (turbo build) | PASS |
| Rust (cargo build --workspace) | PASS |

Notes:
- `@contextractor/extraction-native` skipped rebuild (committed prebuilds present — expected)
- `gen-input-schema` and `docs:update` ran successfully as part of `@contextractor/apify` build
- Biome formatted 349 files in the FORMAT step; `cargo fmt` made no changes

---

## TypeScript Test Results

| Package | Test Files | Tests Passed | Tests Failed |
|---------|-----------|-------------|-------------|
| `@contextractor/schema` | 4 | 43 | 0 |
| `@contextractor/extraction` | 2 | 16 | 0 |
| `@contextractor/crawler` | 3 | 18 | 0 |
| `@contextractor/standalone` | 5 | 37 | 0 |
| `@contextractor/apify` | 4 | 12 | 0 |
| `tools/gen-md-regions` | 2 | 13 | 0 |
| `tools/gen-input-schema` | — | — | — (no tests) |
| `tools/opencode-sync` | — | — | — (no tests) |
| **Total** | **20** | **139** | **0** |

---

## Rust Test Results

| Crate | Tests Passed | Tests Failed |
|-------|-------------|-------------|
| `contextractor-extraction-native` | 5 | 0 |
| **Total** | **5** | **0** |

Test names:
- `tests::unknown_format_is_rejected`
- `tests::extract_metadata_populates_some_fields`
- `tests::extract_txt_returns_non_empty_content`
- `tests::extract_all_formats_returns_four_keys`
- `tests::extract_markdown_returns_non_empty_content`

---

## Lint Results

### Biome

- **Result:** PASS (no errors or warnings)
- Fixed 20 files in `biome check --write` pass
- 3 info-level notices (not blocking):
  - `biome.json`: schema version 2.4.14 vs CLI 2.4.15 — run `biome migrate` to update
  - `examples/apify-api-ts/src/main.ts:24` — `useLiteralKeys` (unsafe fix, skipped)
  - `examples/library-ts/src/main.ts:33` — `useLiteralKeys` (unsafe fix, skipped)

### Clippy

- **Result:** PASS — `Finished dev profile` with 0 warnings

---

## Code Changes Made

- `cargo fmt --all` — no changes
- `pnpm format` (Biome format) — fixed 349 files (whitespace/style normalization from branch state)
- `biome check --write` — fixed 20 additional files (lint auto-fixes)

---

## Issues Not Auto-Fixed

None. All issues were auto-fixed or are info-level notices.

Minor follow-up (non-blocking):
- Run `pnpm biome migrate` to update `biome.json` schema reference from 2.4.14 → 2.4.15
- `examples/` `useLiteralKeys` notices require `--unsafe` flag; safe to fix manually if desired
