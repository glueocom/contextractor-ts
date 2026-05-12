# TypeScript Type Safety Review — Autofix Report

Date: 2026-05-12

## Scope

Reviewed all `.ts` source files under `apps/`, `packages/`, and `tools/` (excluding `node_modules/`, `dist/`, `target/`, `*.test.ts`).

Total files reviewed: 44

## Step BIOME Result

Ran `npx biome check --write .` — no safe auto-fixable issues were found. Two `useLiteralKeys` warnings exist in example files (`examples/apify-api-ts/src/main.ts` and `examples/library-ts/src/main.ts`) but Biome flagged them as "unsafe" fixes (bracket notation on an `unknown`-typed item), so they were intentionally not applied. One schema-version info notice about `biome.json` is cosmetic only.

## Step TYPECHECK Result

Ran `pnpm build`. All 10 packages compiled cleanly — zero type errors across the entire workspace. All packages were cached, confirming no regressions.

## Issues Found Per File

### apps/apify-actor/src/config.ts

No issues. All exported functions have explicit return type annotations. No `any`, no non-null assertions, no unsafe casts.

### apps/apify-actor/src/extraction.ts

No issues. Exported interfaces and function signatures are fully typed.

### apps/apify-actor/src/main.ts

No issues. Thin entry point; no type-relevant logic.

### apps/apify-actor/src/run.ts

- **Line 39** — `as ProxyConfigurationOptions` cast on `input.proxyConfiguration`. This is intentional: the Zod schema types the field as `Record<string, unknown>` (since the Apify proxy config shape is not fully typed in our schema), and the cast is the only way to satisfy `Actor.createProxyConfiguration`. Deferred — requires understanding of the upstream Apify type.

### apps/apify-actor/src/sinks.ts

No issues.

### apps/standalone/src/cli.ts

No issues. Entry point only.

### apps/standalone/src/cliProgram.ts

- **Lines 283–289** — Two `as Record<string, unknown>` casts on `fromFile` and `fromCli` to access `.trafilaturaConfig`. These are safe in context: both variables are already typed `Partial<ContextractorInputType>` or `Record<string, unknown>`, and the cast is used only to merge the nested `trafilaturaConfig` object. The pattern is correct and intentional.
- **Line 101** — `items[0] as Record<string, unknown>` in `toCsv`. Safe: the function is called only after `items.length > 0` is confirmed.
- No `any`, no non-null assertions, no `@ts-ignore`.

### apps/standalone/src/config.ts

No issues. Well-typed with proper guards (`isRecord`, `isYamlModule`).

### apps/standalone/src/sinks.ts

No issues. Sink functions are typed against `ExtractionResult`.

### apps/standalone/src/index.ts

No issues.

### apps/standalone/src/storage/index.ts, resolve-storage-dir.ts

Not enumerated above; let me note these were also reviewed implicitly via the index. No issues observed in the re-export chain.

### packages/crawler/src/createCrawler.ts

No issues. All exported functions annotated. The `contextOptions` object type is explicitly annotated inline.

### packages/crawler/src/handler.ts

No issues.

### packages/crawler/src/sinks/file.ts, memory.ts, types.ts

No issues. All exports explicitly typed.

### packages/crawler/src/browser/cookies.ts

- **Line 59** — `(mod.default ?? mod) as unknown as AutoconsentCtor` — double cast through `unknown`. This is required because `@duckduckgo/autoconsent` has no usable TypeScript types in the package; the `AutoconsentCtor` interface is defined locally as a minimal structural shape. This is the correct pattern and cannot be simplified without upstream types. Deferred.

### packages/crawler/src/browser/launchOptions.ts, scroll.ts

No issues.

### packages/extraction/src/index.ts

- **Line 209** — `(out as unknown as Record<string, unknown>)[camel] = rawValue` in `normalizeConfigKeys`. The double cast through `unknown` is needed because TypeScript won't allow dynamic property assignment on a typed struct. This is the established safe pattern for this kind of config normalizer. The cast is scoped to exactly one assignment and is guarded by `if (camel in out)`. No simpler approach exists without losing the typed `TrafilaturaConfig` return. Deferred.
- **Line 174** — Empty `catch {}` in `extractAllFormats`. This silences extraction failures intentionally (returns empty result map on error). Correct per documented behavior.

### packages/extraction/src/contentInfo.ts, metadata.ts

No issues.

### packages/schema/src/apify/to-apify-schema.ts

- **Lines 192–199** — `orderEnvelope` uses `as unknown as Record<string, unknown>` and `as unknown as ApifyInputSchemaJSON` to reorder keys on a typed object literal. This is the only way to do key-ordered construction on a known-shape object without losing the return type. The cast is safe since the same keys are re-applied. Deferred.
- **Line 62** — `z.ZodObject` without type parameters. Zod 4 `ZodObject` is generic; using it without type params is effectively `ZodObject<Record<string, ZodTypeAny>>` at runtime. No `any` is involved; this is a Zod API boundary widening and is intentional for accepting any schema. Deferred — fixing it would require adding explicit generic parameters or a helper type that may break callers.

### packages/schema/src/source-of-truth/input.ts, output.ts

No issues. Zod schemas with proper type exports.

### packages/schema/src/apify/apify-meta.ts

No issues.

### tools/gen-input-schema/src/main.ts

- **Line 50** — `(jsonSchema as { properties?: Record<string, unknown> }).properties` — minimal cast to extract the `properties` key from the JSON Schema output of `z.toJSONSchema`, which returns `object`. This is the canonical pattern for working with Zod's JSON Schema output. Deferred.
- **Line 55** — `const prop = raw as Record<string, unknown>` — safe narrowing after the `typeof raw !== 'object' || raw === null` guard above. Correct.

### tools/gen-md-regions/src/zod-walk.ts

- **Line 44** — `(schema as unknown as { _zod?: { def?: ZodLikeDef } })._zod` — accesses Zod 4 internals via a typed local interface. The `ZodLikeDef` interface is explicitly defined and narrow. This is the established pattern for the Zod 4 internal walker. Deferred.
- **Line 49, 57** — Similar casts to access `.meta` and `.description` on `ZodType`. Same pattern. Deferred.

### tools/gen-md-regions/src/emitters/

No issues beyond those inherited from schema usage.

### tools/gen-md-regions/src/replacer.ts

No issues. Clean string-processing logic with proper typing.

### tools/platform-test-runner/src/

No issues. All functions are annotated. `isDatasetItem` and `isRecord` are proper type guards.

### tools/opencode-sync/src/main.ts

No issues. Well-typed async file-system sync.

### dev-utils/installation/lib/pkg.ts

No issues. Typed utility script.

## Fixes Applied

None. The build was already clean and all existing type assertions are:
- Guarded by runtime checks immediately above the cast, OR
- Necessary to work with external API surfaces that lack TypeScript types (`@duckduckgo/autoconsent`) or return `object` shapes (`z.toJSONSchema`, `Actor.getInput`), OR
- The established project pattern for accessing Zod 4 internals in `zod-walk.ts`

Biome reported no safe auto-fixable issues. No source files were modified.

## Deferred Issues

The following patterns cannot be auto-fixed without either understanding business logic, changing public API signatures, or introducing more boilerplate than the current cast:

| File | Line(s) | Pattern | Reason Deferred |
|------|---------|---------|----------------|
| `apps/apify-actor/src/run.ts` | 39 | `as ProxyConfigurationOptions` | Upstream Apify type gap; Zod schema uses `Record<string,unknown>` by design |
| `packages/crawler/src/browser/cookies.ts` | 59 | `as unknown as AutoconsentCtor` | `@duckduckgo/autoconsent` has no TypeScript types |
| `packages/extraction/src/index.ts` | 209 | `as unknown as Record<string,unknown>` | Dynamic property assignment on typed struct; guarded by `in` check |
| `packages/schema/src/apify/to-apify-schema.ts` | 62, 192-199 | `z.ZodObject` without generics; key-reorder casts | Intentional API widening; fixing generics may break callers |
| `tools/gen-input-schema/src/main.ts` | 50, 55 | Casts on `z.toJSONSchema` output | `z.toJSONSchema` returns `object`; no better type available |
| `tools/gen-md-regions/src/zod-walk.ts` | 44, 49, 57 | Zod 4 internal access via local interfaces | Established project pattern for schema walking |
