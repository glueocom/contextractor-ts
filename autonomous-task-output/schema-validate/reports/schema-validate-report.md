# Schema Validation Report

**Date:** 2026-05-20  
**Agent:** schema-validate  
**Status:** PASS — no blocking issues

---

## Schema File Validation

### `apps/apify-actor/.actor/actor.json`

| Check | Result |
|---|---|
| File exists and is valid JSON | PASS |
| `actorSpecification: 1` | PASS |
| `name: "contextractor-test"` (test target, lowercase-with-hyphens) | PASS |
| `title` present | PASS |
| `version` present | WARN — `"0.3"` is Apify X.Y convention, not strict semver X.Y.Z |
| `meta.templateId` set | PASS — `"node-playwright"` |
| `meta.generatedBy` set | PASS — `"claude-code"` |
| `dockerContextDir: "../../.."` | PASS |
| `description` mentions rs-trafilatura and Crawlee | PASS |

### `apps/apify-actor/.actor/input_schema.json`

| Check | Result |
|---|---|
| File exists and is valid JSON | PASS |
| `title` present | PASS — `"Contextractor"` |
| `type: "object"` | PASS |
| `schemaVersion: 1` | PASS |
| `properties` present | PASS — 34 properties defined |
| `required` present | PASS — `["startUrls"]` |
| Duplicate `sectionCaption: "Content extraction"` | WARN — set on both `mode` and `includeComments`; Apify may render a duplicate section header |

### `apps/apify-actor/.actor/output_schema.json`

| Check | Result |
|---|---|
| File exists and is valid JSON | PASS |
| `actorOutputSchemaVersion: 1` | PASS |
| `properties` present | PASS |

### `apps/apify-actor/.actor/dataset_schema.json`

| Check | Result |
|---|---|
| File exists and is valid JSON | PASS |
| `actorSpecification: 1` | PASS |
| `fields` present | PASS — 7 fields: `loadedUrl`, `httpStatus`, `loadedAt`, `metadata`, `original`, `txt`, `markdown`, `json`, `html` |
| `views` present | PASS — `overview` view defined |

### `apps/apify-actor/package.json`

| Check | Result |
|---|---|
| `@contextractor/crawler: "workspace:*"` declared | PASS |
| No `vendor/` directory references | PASS |

---

## Static Checks

| Command | Result | Notes |
|---|---|---|
| `pnpm lint` | PASS | 103 files, no issues, 78ms |
| `pnpm build` | PASS | 10/10 tasks, FULL TURBO (all cache hits) |
| `pnpm test` | PASS | 206 tests across 15 packages, all passed |
| `cargo fmt --all -- --check` | PASS | No formatting issues |
| `cargo check --workspace --all-targets` | PASS | Clean in 0.87s |
| `cargo clippy --workspace --all-targets -- -D warnings` | PASS | No warnings |

### Test Breakdown

| Package | Files | Tests |
|---|---|---|
| `@contextractor/schema` | 4 | 85 |
| `@contextractor/standalone` | 6 | 53 |
| `@contextractor/crawler` | 4 | 21 |
| `proxy-rotation-tester` | 3 | 9 |
| `@contextractor/extraction` | 2 | 14 |
| `@contextractor/apify` | 4 | 24 |
| `@contextractor/gen-md-regions` | 2 | 13 |
| Other (no tests) | — | 0 |
| **Total** | **25** | **206** |

---

## Warnings

### WARN — `version: "0.3"` not strict semver

- **File:** `apps/apify-actor/.actor/actor.json:7`
- **Detail:** The `version` field is `"0.3"` (Apify X.Y convention). Strict semver requires `X.Y.Z` (e.g. `"0.3.0"`). The Apify platform accepts X.Y format, so this is not blocking, but the spec check in CLAUDE.md states "semver format".
- **Action:** No change required — Apify X.Y is the platform convention. Low priority.

### WARN — Duplicate `sectionCaption` in `input_schema.json`

- **File:** `apps/apify-actor/.actor/input_schema.json`
- **Properties:** `mode` (line 170) and `includeComments` (line 179) both set `"sectionCaption": "Content extraction"`
- **Detail:** Apify UI renders a new section header for each property that carries `sectionCaption`. The duplicate may produce a second "Content extraction" header visually. Both `includeTables`, `includeImages`, and `includeLinks` do not repeat the caption (correct), but `includeComments` does.
- **Action:** Remove `"sectionCaption": "Content extraction"` from `includeComments`. Low priority cosmetic fix.

---

## Issues Requiring Human Review

None. No prompt file generated.
