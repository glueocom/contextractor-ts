# Schema Validation Report

**Date**: 2026-05-12  
**Branch**: feature/npm-only3  
**Status**: ALL CHECKS PASSED — no issues found

---

## Actor Configuration

### apps/apify-actor/.actor/actor.json

| Check | Result |
|---|---|
| File exists and is valid JSON | PASS |
| `actorSpecification: 1` | PASS |
| `name: "contextractor-test"` (test deploy target) | PASS |
| `title: "Contextractor"` | PASS |
| `version: "0.3.0"` (semver) | PASS |
| `meta.templateId: "node-playwright"` | PASS |
| `meta.generatedBy: "claude-code"` | PASS |
| `dockerContextDir: "../../.."` | PASS |
| `description` mentions `rs-trafilatura` and `Crawlee` | PASS |

### apps/apify-actor/.actor/input_schema.json

| Check | Result |
|---|---|
| File exists and is valid JSON | PASS |
| `title: "Contextractor"` | PASS |
| `type: "object"` | PASS |
| `schemaVersion: 1` | PASS |
| `properties` present (33 fields) | PASS |
| `required: ["startUrls"]` | PASS |

### apps/apify-actor/.actor/output_schema.json

| Check | Result |
|---|---|
| File exists and is valid JSON | PASS |
| `actorOutputSchemaVersion: 1` | PASS |
| `title` and `properties` present | PASS |

### apps/apify-actor/.actor/dataset_schema.json

| Check | Result |
|---|---|
| File exists and is valid JSON | PASS |
| `actorSpecification: 1` | PASS |
| `fields` present (loadedUrl, httpStatus, loadedAt, metadata, original, txt, markdown, json, html) | PASS |
| `views.overview` present | PASS |

### apps/apify-actor/package.json

| Check | Result |
|---|---|
| `@contextractor/crawler: "workspace:*"` declared | PASS |
| `@contextractor/extraction: "workspace:*"` declared | PASS |
| `@contextractor/schema: "workspace:*"` declared | PASS |
| No `vendor/` directory dependency | PASS |

---

## Build and Static Checks

### pnpm build

```
Tasks:    10 successful, 10 total
Cached:   10 cached, 10 total
Time:     56ms >>> FULL TURBO
```

**Result**: PASS

### pnpm lint (Biome)

```
Tasks:    8 successful, 8 total
Cached:   0 cached, 8 total
Time:     1.74s
```

All packages: "No fixes applied."  
**Result**: PASS

### pnpm test (vitest)

| Package | Tests |
|---|---|
| `@contextractor/schema` | 43 passed (4 files) |
| `@contextractor/extraction` | 16 passed (2 files) |
| `@contextractor/crawler` | 18 passed (3 files) |
| `@contextractor/standalone` | 37 passed (5 files) |
| `@contextractor/apify` | 12 passed (4 files) |
| `@contextractor/gen-md-regions` | 13 passed (2 files) |
| `@contextractor/gen-input-schema` | no tests (passWithNoTests) |
| `@contextractor/opencode-sync` | no tests (passWithNoTests) |

**Total: 139 tests passed, 0 failed**  
**Result**: PASS

### cargo check --workspace --all-targets

```
Checking contextractor-extraction-native v0.1.0
Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.89s
```

**Result**: PASS

### cargo fmt --all -- --check

No formatting issues detected.  
**Result**: PASS

### cargo clippy --workspace --all-targets -- -D warnings

No warnings or errors.  
**Result**: PASS

---

## Summary

No errors. No warnings. No issues requiring human review. Workspace is fully green.
