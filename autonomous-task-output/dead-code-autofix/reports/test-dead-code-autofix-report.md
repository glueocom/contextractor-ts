# Dead Code Autofix Report

**Date:** 2026-05-12
**Tool:** knip 6.13.1 (`npx knip --reporter compact --include-entry-exports`)

## Summary

| Category | Found | Removed | Deferred |
|---|---|---|---|
| Unused files | 0 | 0 | 0 |
| Unused exports | 10 | 0 | 10 |
| Unused exported types | 10 | 0 | 10 |
| Unused dependencies | 0 | 0 | 0 |
| Unused devDependencies | 0 | 0 | 0 |

**No changes made.** All findings are deferred — see rationale below.

## Items Removed

None.

## Items Deferred

### Unused exports — `@contextractor/crawler` (public API)

These are exported from `packages/crawler/src/index.ts` and `packages/crawler/src/browser/cookies.ts`. Per project rules, public API exports from `@contextractor/*` packages must not be removed autonomously.

Additionally, all are used **internally** within the package — knip flags them only because no other workspace package imports them:
- `getBlocker` — called by `installCookieDefences` inside `cookies.ts`
- `installCookieDefences`, `rejectViaAutoconsent` — called in `createCrawler.ts`
- `autoScroll` — called in `handler.ts`
- `memorySink` — tested in `sinks/memory.test.ts`
- `ScrollConfig` type — used in `createCrawler.ts` and `handler.ts`

### Unused exports — `packages/extraction/native/index.d.ts` (native addon declarations)

`extract`, `extractMetadata`, `extractAllFormats`, `TrafilaturaConfig`, `ExtractOptions`, `ExtractionResult`, `Metadata` — these are the public type declarations for the napi-rs native addon. Removing them would break the TypeScript boundary. Not safe to touch.

### Unused exports — `@contextractor/schema` (public API)

`apifyMeta`, `ApifyMeta`, `ApifyInputSchemaJSON`, `ToApifyInputSchemaOptions`, `ContextractorOutputType` — all from `packages/schema/src/`. Public API package; do not remove.

`ContextractorOutputType` is also flagged directly from `packages/schema/src/source-of-truth/output.ts` — same reason.

### Unused exports — `apps/standalone/src/index.ts` (examples outside workspace)

The standalone app is used as a library by `examples/library-ts/`, which is NOT in the pnpm workspace (`pnpm-workspace.yaml` includes only `apps/*`, `packages/*`, `tools/*`). Knip does not scan the examples directory, so these look unused:

- `Dataset`, `KeyValueStore`, `buildProgram`, `configureStorage`, `resolveStorageDir` — all imported by `examples/library-ts/src/main.ts`
- `isMainEntry`, `runCli` — used internally in `apps/standalone/src/cli.ts`; also exported as public API
- `Configuration` — re-export from crawlee; not in examples but public API
- `DatasetContent` type — not observed in examples; lowest-priority candidate for removal

## Root Cause

Knip cannot see that `examples/` is a consumer of `@contextractor/standalone` because `examples/` is excluded from the pnpm workspace. This causes false positives for every export that is only consumed externally.

## Deferred Prompt

See [`test-dead-code-autofix-prompt.md`](../prompts/test-dead-code-autofix-prompt.md) for follow-up tasks.
