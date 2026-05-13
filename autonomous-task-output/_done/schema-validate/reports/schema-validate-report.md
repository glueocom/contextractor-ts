# Schema Validate Report

Date: 2026-05-12
Branch: feature/npm-only3

## Summary

All validation checks passed. No issues found.

---

## Actor Configuration Validation

### apps/apify-actor/.actor/actor.json

| Check | Result |
|---|---|
| Valid JSON | PASS |
| `actorSpecification: 1` | PASS |
| `name`: lowercase-with-hyphens | PASS — `"contextractor-test"` |
| `name` matches deploy target (test) | PASS — `"contextractor-test"` |
| `title`: human-readable | PASS — `"Contextractor"` |
| `version`: semver | PASS — `"0.3.0"` |
| `meta.templateId` set | PASS — `"node-playwright"` |
| `meta.generatedBy` set | PASS — `"claude-code"` |
| `dockerContextDir: "../../.."` | PASS |
| `description` mentions rs-trafilatura and Crawlee | PASS — `"Built on rs-trafilatura and Crawlee."` |

### apps/apify-actor/.actor/input_schema.json

| Check | Result |
|---|---|
| Valid JSON | PASS |
| `title` set | PASS — `"Contextractor"` |
| `type: "object"` | PASS |
| `schemaVersion: 1` | PASS |
| `properties` present | PASS — 33 properties defined |
| `required` set | PASS — `["startUrls"]` |

### apps/apify-actor/.actor/output_schema.json

| Check | Result |
|---|---|
| Valid JSON | PASS |
| `actorOutputSchemaVersion: 1` | PASS |
| `title` set | PASS — `"Output schema"` |
| `properties` present | PASS — `overview` field with API link template |

### apps/apify-actor/.actor/dataset_schema.json

| Check | Result |
|---|---|
| Valid JSON | PASS |
| `actorSpecification: 1` | PASS |
| `fields` present | PASS — `loadedUrl`, `httpStatus`, `loadedAt`, `metadata`, `original`, `txt`, `markdown`, `json`, `html` |
| `views` present | PASS — `overview` view with table display |

### apps/apify-actor/package.json

| Check | Result |
|---|---|
| `"@contextractor/crawler": "workspace:*"` | PASS |
| No `vendor/` dependency | PASS |

---

## Build and Static Checks

### pnpm build

Result: PASS — 10 packages built successfully (all cache-hit, FULL TURBO)

- No compilation errors
- Biome auto-fix: no fixes needed in any package
- `gen-input-schema` regenerated `input_schema.json` and `dataset_schema.json` (output matched committed files)
- `gen-md-regions`: 0 files updated (READMEs up to date)

### pnpm lint (Biome)

Result: PASS — Checked 97 files, no fixes needed

### pnpm test (vitest)

Result: PASS — 185 tests across 20 test files, all passed

| Package | Test Files | Tests |
|---|---|---|
| @contextractor/schema | 4 | 79 |
| @contextractor/extraction | 2 | 16 |
| @contextractor/crawler | 3 | 18 |
| @contextractor/apify | 4 | 16 |
| @contextractor/standalone | 5 | 43 |
| @contextractor/gen-md-regions | 2 | 13 |
| @contextractor/gen-input-schema | — | passWithNoTests |
| @contextractor/opencode-sync | — | passWithNoTests |

### cargo check --workspace --all-targets

Result: PASS

### cargo fmt --all -- --check

Result: PASS — no formatting issues

### cargo clippy --workspace --all-targets -- -D warnings

Result: PASS — no warnings

---

## Issues Requiring Human Review

None.
