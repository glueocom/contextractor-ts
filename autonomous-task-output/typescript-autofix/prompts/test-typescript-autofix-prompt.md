# TypeScript Autofix — Deferred Issues Prompt

These issues were identified during the 2026-05-20 run but deferred because they require either public API changes or cannot be resolved without adding runtime validation that changes behavior.

## Issue 1: Double-cast on `@duckduckgo/autoconsent` dynamic import

**File:** `packages/crawler/src/browser/cookies.ts:59`

```typescript
const AutoConsent = (mod.default ?? mod) as unknown as AutoconsentCtor;
```

**Problem:** `@duckduckgo/autoconsent` has no TypeScript declarations matching how it exports at runtime (CJS interop with `mod.default ?? mod` fallback). The `as unknown as` pattern is a code smell — it bypasses all type checking.

**Options:**
- Add a `declare module '@duckduckgo/autoconsent'` ambient declaration in `packages/crawler/src/` that types the export correctly
- File an issue upstream or add `@types/duckduckgo__autoconsent` if one becomes available

---

## Issue 2: Commander CLI options typed as `string` instead of literal unions

**File:** `apps/standalone/src/cliProgram.ts:356, 359, 369`

```typescript
out.deduplication = opts.deduplication as ContextractorInputType['deduplication'];
out.mode = opts.mode as ContextractorInputType['mode'];
out.saveDestination = getExplicitRepeatedValues(command, '--save-destination') as ContextractorInputType['saveDestination'];
```

**Problem:** `ExtractOpts` uses `string` for `deduplication`, `mode`, and `saveDestination` because Commander cannot express literal union types in its option interface. The casts bypass type safety — if Commander returns an invalid string value, the error is silently lost.

**Options:**
- Add runtime validation (e.g., `ContextractorInput.shape.deduplication.parse(opts.deduplication)`) immediately before each cast, and remove the cast — the parsed value will then be narrowed correctly
- Alternatively, use `.choices([...])` (already used for `mode`) to let Commander reject invalid values at the CLI level, and then the cast is provably correct

---

## Issue 3: `orderEnvelope` key-reorder uses double-cast

**File:** `packages/schema/src/apify/to-apify-schema.ts:217, 223`

```typescript
const view = envelope as unknown as Record<string, unknown>;
// ...
return out as unknown as ApifyInputSchemaJSON;
```

**Problem:** The function converts `ApifyInputSchemaJSON` to `Record<string, unknown>` to reorder keys, then casts back. The double-cast bypasses structural verification on the output.

**Option:** Refactor `orderEnvelope` to build the output by explicitly copying named keys:

```typescript
function orderEnvelope(envelope: ApifyInputSchemaJSON): ApifyInputSchemaJSON {
  const out: Partial<ApifyInputSchemaJSON> = {};
  for (const key of ENVELOPE_KEY_ORDER) {
    if (key === 'description' && envelope.description !== undefined) {
      out.description = envelope.description;
    } else if (key !== 'description') {
      out[key] = envelope[key] as ApifyInputSchemaJSON[typeof key];
    }
  }
  return out as ApifyInputSchemaJSON;
}
```

This retains type safety for each field assignment while preserving key ordering.
