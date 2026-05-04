# Schema Validation Report

**Date**: 2026-05-03  
**Branch**: dev  
**Agent**: autonomous:maintenance:schema:validate

---

## Configuration File Checks

### apps/apify-actor/.actor/actor.json

- `actorSpecification`: 1 — PASS
- `name`: `contextractor-test` — PASS (matches deploy target)
- `title`: `Contextractor` — PASS
- `version`: `0.1.0` — PASS (semver)
- `meta.templateId`: `node-playwright` — PASS
- `meta.generatedBy`: `claude-code` — PASS
- `dockerContextDir`: `../../..` — PASS
- `description`: "Crawls websites and extracts main-content text. Built on rs-trafilatura and Crawlee." — PASS

### apps/apify-actor/.actor/input_schema.json

- `title`: `Contextractor` — PASS
- `type`: `object` — PASS
- `schemaVersion`: 1 — PASS
- `properties`: present — PASS
- `required`: `["startUrls"]` — PASS

### apps/apify-actor/.actor/output_schema.json

- Present — PASS
- `actorOutputSchemaVersion`: 1 — PASS
- `properties.overview`: references `apiDefaultDatasetUrl` — PASS

### apps/apify-actor/.actor/dataset_schema.json

- Present — PASS
- `actorSpecification`: 1 — PASS
- `fields`: loadedUrl, httpStatus, loadedAt, metadata, rawHtml, extractedMarkdown, extractedText, extractedJson — PASS
- `views.overview`: table display with URL, status, title, lang — PASS

### apps/apify-actor/package.json

- `@contextractor/crawler`: `workspace:*` — PASS (no vendor/ directory)

---

## Build Results

### pnpm build

- Result: 10/10 tasks successful (10 cached)
- Notable: `gen-input-schema` regenerated `input_schema.json` and `gen-md-regions` found 0 files to update — both PASS
- Platform warnings for non-native prebuilds (darwin-x64, linux-arm64-gnu, linux-x64-gnu) on darwin-arm64 host — expected, not errors

### pnpm lint (Biome)

- Result: 8/8 tasks successful (8 cached)
- All packages: no fixes applied — PASS

### pnpm test (vitest)

| Package | Tests | Status |
|---|---|---|
| @contextractor/schema | 19 passed (2 files) | PASS |
| @contextractor/extraction | 16 passed (2 files) | PASS |
| @contextractor/standalone | 16 passed (2 files) | PASS |
| @contextractor/gen-md-regions | 13 passed (2 files) | PASS |
| @contextractor/crawler | no tests (passWithNoTests) | PASS |
| @contextractor/apify | no tests (passWithNoTests) | PASS |
| @contextractor/opencode-sync | no tests (passWithNoTests) | PASS |
| @contextractor/gen-input-schema | no tests (passWithNoTests) | PASS |

Total: 64 tests passed across 8 test files — PASS

---

## Rust Checks

### cargo check --workspace --all-targets

- Result: `Finished dev profile` — PASS

### cargo fmt --all -- --check

- Result: no output (all files formatted) — PASS

### cargo clippy --workspace --all-targets -- -D warnings

- Result: `Finished dev profile` with no warnings — PASS

---

## Summary

All validation checks passed. No errors or warnings requiring human review.

| Category | Status |
|---|---|
| actor.json structure | PASS |
| input_schema.json structure | PASS |
| output_schema.json structure | PASS |
| dataset_schema.json structure | PASS |
| package.json crawler dependency | PASS |
| pnpm build | PASS |
| pnpm lint | PASS |
| pnpm test | PASS |
| cargo check | PASS |
| cargo fmt | PASS |
| cargo clippy | PASS |
