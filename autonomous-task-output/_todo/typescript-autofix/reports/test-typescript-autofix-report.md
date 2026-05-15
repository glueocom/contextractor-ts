# TypeScript Autofix Report

**Date:** 2026-05-12
**Branch:** feature/npm-only3
**Agent:** typescript-autofix

## Summary

- Files reviewed: 14 (recently changed `.ts` files from last 10 commits)
- Biome issues: 0 (already clean)
- `any` types: 0
- `@ts-ignore` / `@ts-expect-error`: 0
- Redundant `as` casts removed: 2
- Build result: ✓ all 10 packages pass

---

## Files Reviewed

| File | Status | Notes |
|------|--------|-------|
| `apps/apify-actor/src/config.ts` | Clean | — |
| `apps/apify-actor/src/run.ts` | Boundary cast | `as ProxyConfigurationOptions` at Apify SDK boundary — necessary |
| `apps/apify-actor/src/sinks.ts` | Clean | — |
| `apps/standalone/src/cliProgram.ts` | Boundary casts | See deferred section |
| `apps/standalone/src/config.ts` | Intentional | `import('yaml' as string)` is a lazy-load workaround — intentional |
| `apps/standalone/src/sinks.ts` | **Fixed** | Removed 2 redundant casts |
| `examples/apify-api-ts/src/main.ts` | Boundary casts | Dataset items are `unknown` at API boundary — necessary |
| `examples/library-ts/src/main.ts` | Boundary casts | Dataset items are `unknown` at API boundary — necessary |
| `packages/crawler/src/createCrawler.ts` | Clean | — |
| `packages/crawler/src/handler.ts` | Clean | All exported functions have explicit return types |
| `packages/crawler/src/index.ts` | Clean | Re-exports only |
| `packages/crawler/src/sinks/types.ts` | Clean | — |
| `packages/schema/src/source-of-truth/input.ts` | Clean | — |
| `tools/gen-md-regions/src/main.ts` | Clean | All functions have explicit return types |

---

## Fixes Applied

### `apps/standalone/src/sinks.ts` — removed 2 redundant `as` casts

**Before (line 32):**
```ts
fmt === 'original' ? result.html : result.formats[fmt as keyof typeof result.formats];
```

**After:**
```ts
fmt === 'original' ? result.html : result.formats[fmt];
```

Same change at line 56.

**Why safe:** In the ternary false branch, TypeScript narrows `fmt` from `SaveFormat` to
`Exclude<SaveFormat, 'original'>` = `OutputFormat`, which equals `keyof typeof result.formats`.
The cast was redundant and concealed the narrowing. Build confirmed clean after removal.

---

## Deferred Issues

See `prompts/test-typescript-autofix-prompt.md` for items that require judgement or API changes.
