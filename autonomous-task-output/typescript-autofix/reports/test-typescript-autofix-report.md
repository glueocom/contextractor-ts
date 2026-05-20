# TypeScript Autofix Report

**Date:** 2026-05-20
**Agent:** typescript-autofix
**Outcome:** 4 fixes applied, 7 issues deferred, build passing

---

## Files Reviewed

44 TypeScript source files across `apps/`, `packages/`, and `tools/` (excluding `*.test.ts`, `node_modules/`, `dist/`, `target/`):

- `apps/apify-actor/src/config.ts`
- `apps/apify-actor/src/extraction.ts`
- `apps/apify-actor/src/main.ts`
- `apps/apify-actor/src/run.ts`
- `apps/apify-actor/src/sinks.ts`
- `apps/standalone/src/cli.ts`
- `apps/standalone/src/cliProgram.ts`
- `apps/standalone/src/config.ts`
- `apps/standalone/src/index.ts`
- `apps/standalone/src/sinks.ts`
- `apps/standalone/src/storage/index.ts`
- `apps/standalone/src/storage/resolve-storage-dir.ts`
- `packages/crawler/src/browser/cookies.ts`
- `packages/crawler/src/browser/launchOptions.ts`
- `packages/crawler/src/browser/scroll.ts`
- `packages/crawler/src/createCrawler.ts`
- `packages/crawler/src/handler.ts`
- `packages/crawler/src/index.ts`
- `packages/crawler/src/sinks/memory.ts`
- `packages/crawler/src/sinks/types.ts`
- `packages/extraction/native/index.d.ts`
- `packages/extraction/src/contentInfo.ts`
- `packages/extraction/src/index.ts`
- `packages/extraction/src/metadata.ts`
- `packages/schema/src/apify/apify-meta.ts`
- `packages/schema/src/apify/to-apify-schema.ts`
- `packages/schema/src/index.ts`
- `packages/schema/src/source-of-truth/input.ts`
- `packages/schema/src/source-of-truth/output.ts`
- `tools/gen-input-schema/src/main.ts`
- `tools/gen-md-regions/src/emitters/apify-input-schema.ts`
- `tools/gen-md-regions/src/emitters/cli-flags.ts`
- `tools/gen-md-regions/src/emitters/enum-values.ts`
- `tools/gen-md-regions/src/emitters/index.ts`
- `tools/gen-md-regions/src/emitters/input-type.ts`
- `tools/gen-md-regions/src/main.ts`
- `tools/gen-md-regions/src/replacer.ts`
- `tools/gen-md-regions/src/zod-walk.ts`
- `tools/platform-test-runner/src/apify-client.ts`
- `tools/platform-test-runner/src/index.ts`
- `tools/platform-test-runner/src/report.ts`
- `tools/platform-test-runner/src/runner.ts`
- `tools/platform-test-runner/src/types.ts`
- `tools/proxy-simulator/src/main.ts`

---

## Biome Step

`pnpm exec biome check --write .` — **No fixes applied.** All 103 files already clean.

---

## Issues Found and Fixed

### Fix 1: Type predicate replaces `as` cast in filter

- **File:** `apps/apify-actor/src/config.ts:24`
- **Issue:** `as OutputFormat[]` after `.filter()` bypasses type narrowing; TypeScript cannot verify the predicate holds.
- **Fix:** Replaced with a proper type predicate `(f): f is OutputFormat => f !== 'original'`.

```typescript
// Before
const formats: OutputFormat[] = input.save.filter((f) => f !== 'original') as OutputFormat[];

// After
const formats = input.save.filter((f): f is OutputFormat => f !== 'original');
```

### Fix 2: Redundant `as SaveFormat[]` removed

- **File:** `apps/standalone/src/cliProgram.ts:392`
- **Issue:** `input.save` is typed by Zod as `('txt' | 'markdown' | 'json' | 'html' | 'original')[]` which is structurally identical to `SaveFormat[]`. The cast was unnecessary.
- **Fix:** Replaced `as` cast with an explicit type annotation on the variable.

```typescript
// Before
let save = input.save as SaveFormat[];

// After
let save: SaveFormat[] = input.save;
```

### Fix 3: Redundant `as (string | null)[][]` removed after `if` guard

- **File:** `apps/standalone/src/cliProgram.ts:503`
- **Issue:** `parsed.data.tieredProxyUrls` is already typed as `(string | null)[][] | undefined` by the Zod schema. Inside an `if (parsed.data.tieredProxyUrls)` block, TypeScript narrows the type to `(string | null)[][]` — the `as` cast was a no-op.
- **Fix:** Removed the cast entirely.

```typescript
// Before
const tiers = parsed.data.tieredProxyUrls as (string | null)[][];

// After
const tiers = parsed.data.tieredProxyUrls;
```

### Fix 4: Two sequential casts on `generated` consolidated into a single typed view

- **File:** `packages/schema/src/apify/to-apify-schema.ts:84-85`
- **Issue:** `z.toJSONSchema()` returns `object`. Two separate casts accessed `properties` and `required` independently, each widening the type in isolation. Consolidating into one typed intermediate removes the repetition and makes the shape explicit.
- **Fix:** Introduced a single `gen` typed view; `required` is now typed as `string[]` directly rather than `unknown` cast to `string[]`.

```typescript
// Before
const sourceProperties = (generated as { properties?: Record<string, unknown> }).properties ?? {};
const sourceRequired = ((generated as { required?: unknown }).required ?? []) as string[];

// After
const gen = generated as { properties?: Record<string, unknown>; required?: string[] };
const sourceProperties = gen.properties ?? {};
const sourceRequired = gen.required ?? [];
```

---

## Typecheck Result

`pnpm build` — **10/10 tasks succeeded.** Zero new type errors or Biome violations introduced.

---

## Positive Findings

- No `any` types anywhere in production source files
- No `@ts-ignore` or `@ts-expect-error` directives in source files
- No non-null assertion operators (`!`) used in source files
- All exported functions carry explicit return types
- Zod input validation at every external boundary

---

## Issues Deferred

See `autonomous-task-output/typescript-autofix/prompts/test-typescript-autofix-prompt.md` for the follow-up prompt.

| File | Line | Issue | Reason deferred |
|------|------|-------|-----------------|
| `packages/crawler/src/browser/cookies.ts` | 59 | `as unknown as AutoconsentCtor` double-cast on dynamic import | `@duckduckgo/autoconsent` has no TypeScript declarations matching the CJS/ESM export shape at runtime; the double-cast is the only way to bridge to the local `AutoconsentCtor` interface without vendoring types |
| `apps/standalone/src/cliProgram.ts` | 273–274 | `Command & { rawArgs?: string[] }` cast | Commander.js does not expose `rawArgs` in its public type definitions; the cast is the approved workaround for accessing this private runtime property |
| `apps/standalone/src/cliProgram.ts` | 356 | `opts.deduplication as ContextractorInputType['deduplication']` | `ExtractOpts.deduplication` is `string` (Commander cannot know the literal union); the narrowing to the literal type requires a cast or a runtime validator; adding a guard would require changing the public CLI option interface |
| `apps/standalone/src/cliProgram.ts` | 359 | `opts.mode as ContextractorInputType['mode']` | Same pattern as above for `mode` |
| `apps/standalone/src/cliProgram.ts` | 369 | `getExplicitRepeatedValues(...) as ContextractorInputType['saveDestination']` | Return type of `getExplicitRepeatedValues` is `string[]`; converting to the specific `('key-value-store' | 'dataset')[]` union requires a cast or a validation step |
| `packages/schema/src/apify/to-apify-schema.ts` | 217, 223 | `as unknown as ApifyInputSchemaJSON` in `orderEnvelope` | This is a key-reordering function that intentionally builds an `Record<string, unknown>` from a typed object and casts back; extracting a type-safe alternative would require significant refactor of the ordering logic |
| `apps/standalone/src/cliProgram.ts` | 757 | `chunk as string` in stdin stream | `process.stdin` chunks are typed as `any` in Node types; the guard `Buffer.isBuffer(chunk)` has already handled the Buffer path, so `string` is correct for the else branch in practice |
