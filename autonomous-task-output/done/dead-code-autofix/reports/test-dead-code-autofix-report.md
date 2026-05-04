# Dead Code Autofix Report

**Date:** 2026-05-03
**Tool:** knip 6.11.0

## Summary

| Category | Found | Removed | Deferred |
|---|---|---|---|
| Unused files | 0 | 0 | 0 |
| Unused exports | 0 | 0 | 0 |
| Unused types | 0 | 0 | 0 |
| Unused dependencies | 0 | 0 | 0 |
| Unused devDependencies | 0 | 0 | 0 |

## Scan Results

`npx knip --reporter json` → `{"issues":[]}` — exit 0. No actionable findings.

## Entry-Export Scan

`npx knip --include-entry-exports` flagged 17 items across 8 files, all of which are **public API exports from `@contextractor/*` packages**. None are removable per policy.

### Flagged files and exports

- `packages/extraction/native/index.d.ts` — `extract`, `extractMetadata`, `extractAllFormats`, `TrafilaturaConfig`, `ExtractOptions`, `ExtractionResult`, `Metadata`
- `packages/crawler/src/index.ts` — `getBlocker`, `installCookieDefences`, `rejectViaAutoconsent`, `autoScroll`, `memorySink`, `ScrollConfig`
- `packages/schema/src/index.ts` — `apifyMeta`, `ApifyMeta`, `ApifyInputSchemaJSON`, `ToApifyInputSchemaOptions`
- `packages/crawler/src/browser/cookies.ts` — `getBlocker`
- `packages/crawler/src/sinks/memory.ts` — `memorySink`
- `packages/extraction/src/contentInfo.ts` — `ContentInfo` (used in 4 files internally)
- `packages/extraction/src/index.ts` — `ExtractionResult`
- `packages/schema/src/apify-meta.ts` — `ApifyMeta`
- `packages/schema/src/to-apify-schema.ts` — `ApifyInputSchemaJSON`, `ToApifyInputSchemaOptions`

All are entry-point exports from monorepo packages consumed by apps and tools. Verified that `ContentInfo` is actively imported in `packages/crawler/src/handler.ts`, `apps/apify-actor/src/sinks.ts`, `apps/apify-actor/src/extraction.ts`, and `packages/extraction/src/index.test.ts`.

## Items Removed

None.

## Items Deferred

None — all entry-export findings are protected public API.

## Conclusion

Codebase is clean. No dead code, unused exports, or unused dependencies found.
