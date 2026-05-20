# Local Test Report — 2026-05-20

## Summary

All steps passed. No blocking issues. 8 pre-existing Biome `noNonNullAssertion` warnings fixed.

## FORMAT

- Rust (`cargo fmt --all`): **pass** — no changes
- TypeScript (`pnpm format`): **pass** — no changes

## BUILD

- TypeScript (`pnpm build`): **pass** — 10/10 tasks (7 cached)
- Rust (`cargo build --workspace`): **pass**

## TEST_TS

| Package | Test files | Tests |
|---|---|---|
| `@contextractor/schema` | 4 | 85 passed |
| `@contextractor/crawler` | 4 | 21 passed |
| `@contextractor/apify` | 4 | 24 passed |
| `@contextractor/extraction` | 2 | 14 passed |
| `@contextractor/standalone` | 6 | 53 passed |
| `@contextractor/gen-md-regions` | 2 | 13 passed |
| `proxy-rotation-tester` | 3 | 9 passed |
| `proxy-simulator` | — | no tests |
| `@contextractor/gen-input-schema` | — | no tests |

**Total: 219 tests passed, 0 failed**

## TEST_RUST

Location: `packages/extraction/native/src/lib.rs`

| Test | Result |
|---|---|
| `tests::unknown_format_is_rejected` | ok |
| `tests::extract_txt_returns_non_empty_content` | ok |
| `tests::extract_metadata_populates_some_fields` | ok |
| `tests::extract_markdown_returns_non_empty_content` | ok |
| `tests::extract_all_formats_returns_four_keys` | ok |

**5 passed, 0 failed**

## LINT

- **Biome** (`biome check --write .`): **pass** — no warnings after fixes
- **Clippy** (`cargo clippy --workspace --all-targets -- -D warnings`): **pass**

## Code Changes Made

Fixed 8 `lint/style/noNonNullAssertion` warnings in proxy-rotation-tester test files. With `noUncheckedIndexedAccess: true`, array index access returns `T | undefined`. Replaced `!` with `as string` type assertions at sites that are already bounds-checked by preceding `expect()` calls or by construction.

- `tools/proxy-rotation-tester/src/actor.test.ts:112` — `files[0]!` → `files[0] as string`
- `tools/proxy-rotation-tester/src/actor.test.ts:161` — `files[files.length - 1]!` → `files[files.length - 1] as string`
- `tools/proxy-rotation-tester/src/cli.test.ts:125` — `sim.proxies[0]!`, `sim.proxies[1]!` → `as string`
- `tools/proxy-rotation-tester/src/lib.test.ts:95-96` — 4 occurrences of `sim.proxies[n]!` → `as string`

## Issues That Could Not Be Auto-Fixed

None.
