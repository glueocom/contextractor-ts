# Sync Docs Report

**Date**: 2026-05-12T00:00:00Z
**Scope**: All READMEs under `/Users/miroslavsekera/r/contextractor-ts/` — generated regions, "built on" lines, output-format sets, TrafilaturaConfig table, CLI flags, local prerequisites, JSON-config-only rule.

## Findings

### READMEs found

| File | Status |
|------|--------|
| `README.md` | ✅ No changes needed |
| `apps/apify-actor/README.md` | ✅ No changes needed |
| `apps/standalone/README.md` | ✅ No changes needed |
| `packages/extraction/README.md` | ✅ No changes needed |
| `packages/crawler/README.md` | ✅ No changes needed |
| `packages/schema/README.md` | ✅ No changes needed |
| `tools/gen-input-schema/README.md` | ✅ No changes needed |

### Generated regions (`pnpm docs:update`)

`0 file(s) updated` — all `<!-- @generated:start … -->` / `<!-- @generated:end … -->` blocks are already current:
- `input-type` block (root README, `packages/schema/README.md`) matches current `ContextractorInputType` (33 fields).
- `apify-input-schema` table (`apps/apify-actor/README.md`) matches current `input_schema.json` (all 33 fields).
- `cli-flags` table (`apps/standalone/README.md`) matches current Commander flags.
- `enum-values` tables (`apps/standalone/README.md`, `packages/schema/README.md`) are up-to-date.

### "Built on" line

All 7 READMEs declare that Contextractor is built on `rs-trafilatura` (extraction) and Crawlee (TypeScript crawler driving Playwright). ✅

### Engine output-format set

All READMEs use exactly `txt | markdown | json | html` for the engine/public format set. ✅
- `apps/standalone/README.md` additionally lists `original` as a CLI-only save format — correct per the instructions.
- `packages/extraction/README.md` documents the XML / XML-TEI gap exactly once — no repetition elsewhere. ✅
- No `xml` or `xmltei` values appear in any other README. ✅

### napi-rs binding vs TS interface

`packages/extraction/native/src/lib.rs` `TrafilaturaConfig` struct matches `packages/extraction/src/index.ts` `TrafilaturaConfig` interface field-for-field (all 15 fields, snake_case → camelCase via napi-derive). ✅

### TrafilaturaConfig table (`packages/extraction/README.md`)

All 15 fields with correct types, defaults, and descriptions — matches `DEFAULT_CONFIG` in `index.ts`. ✅

### JSON-config-only rule

All docs reference `config.json`. No YAML config examples appear in any README. ✅

### Local prerequisites

| README | Rust toolchain | Node 22+ | pnpm 10+ | Apify CLI ≥ 1.4 |
|--------|----------------|----------|----------|-----------------|
| `README.md` | ✅ | ✅ | ✅ | ✅ |
| `apps/apify-actor/README.md` | ✅ | ✅ | ✅ | ✅ |
| `apps/standalone/README.md` | ✅ | ✅ | ✅ | ✅ (workspace-level note) |
| `packages/extraction/README.md` | ✅ | ✅ | ✅ | n/a |
| `packages/schema/README.md` | n/a | ✅ | ✅ | n/a |
| `tools/gen-input-schema/README.md` | n/a | ✅ | ✅ | n/a |
| `packages/crawler/README.md` | no section | no section | no section | no section |

`packages/crawler/README.md` has no prerequisites section. The file is intentionally minimal (describes public API, no local development workflow). No action taken; not a blocker.

### `actor.json` description

`"description": "Crawls websites and extracts main-content text. Built on rs-trafilatura and Crawlee."` ✅

## Actions Taken

None — all READMEs were already in sync with their sources. `pnpm docs:update` confirmed 0 generated regions required regeneration. Docs version timestamp was NOT updated (no prose or generated region changed).

## Deferred Decisions

**Source-file discrepancy (out of scope for this command — fix via `/autonomous:maintenance:sync:gui`):**

The `trafilaturaConfig` `.describe()` string in `packages/schema/src/source-of-truth/input.ts` (line 163–164) lists keys but omits `urlBlacklist` and `authorBlacklist`:

```
Keys: fast, favorPrecision, favorRecall, includeComments, includeTables, includeImages,
includeFormatting, includeLinks, deduplicate, targetLanguage, withMetadata,
onlyWithMetadata, teiValidation.
```

Both fields exist in `TrafilaturaConfig` (TS interface and napi-rs binding). The prose note at the bottom of `apps/apify-actor/README.md` does include them, but the generated `input_schema.json` description would also omit them since it derives from this `.describe()` string. This is a schema-vs-TS discrepancy, not a README-vs-source discrepancy, so it belongs to the GUI sync task.

## Summary

- READMEs found: 7
- READMEs updated: 0 (all already in sync)
- Generated regions regenerated: 0 (`pnpm docs:update` → 0 file(s) updated)
- Inconsistencies fixed: 0
- Issues requiring human review: 1 (source-file discrepancy deferred to sync:gui)
