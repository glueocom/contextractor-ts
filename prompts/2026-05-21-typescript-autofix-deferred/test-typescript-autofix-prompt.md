# TypeScript Autofix — Deferred Issues Prompt

These issues were identified during the 2026-05-20 run but deferred because they require either public API changes or cannot be resolved without adding runtime validation that changes behavior.

## Issue 1: Double-cast on `@duckduckgo/autoconsent` dynamic import

**File:** `packages/crawler/src/browser/cookies.ts:59`

```typescript
const AutoConsent = (mod.default ?? mod) as unknown as AutoconsentCtor;
```

**Problem:** `@duckduckgo/autoconsent` has no TypeScript declarations matching how it exports at runtime (CJS interop with `mod.default ?? mod` fallback). The `as unknown as` pattern is a code smell — it bypasses all type checking.

**Fix:** Create `packages/crawler/src/autoconsent.d.ts`:

```typescript
declare module '@duckduckgo/autoconsent' {
  type AutoconsentCtor = new (
    sendMessage: (message: unknown) => void,
    options: {
      enabled: boolean;
      autoAction: 'optOut';
      enableCosmeticRules: boolean;
      detectRetries: number;
    },
    rules: unknown,
  ) => {
    receiveMessageCallback(message: unknown): void;
  };

  const AutoConsent: AutoconsentCtor;
  export default AutoConsent;
}
```

Add this comment at the top of `autoconsent.d.ts`:

```typescript
// TODO: remove when @duckduckgo/autoconsent ships official TypeScript declarations
```

Then in `cookies.ts`:
- Remove the local `AutoconsentCtor` type alias (lines 40–51) — it moves into the declaration file
- Replace line 59 with: `const AutoConsent = mod.default;`
  - Drop the `?? mod` fallback — Node.js 22 ESM wraps CJS `module.exports` as a synthetic default; the fallback is not needed
  - No cast needed: `mod.default` is now typed as `AutoconsentCtor` via the ambient declaration

---

## Issue 2: Commander CLI options typed as `string` instead of literal unions

**File:** `apps/standalone/src/cliProgram.ts:356, 359, 369`

```typescript
out.deduplication = opts.deduplication as ContextractorInputType['deduplication'];
out.mode = opts.mode as ContextractorInputType['mode'];
out.saveDestination = getExplicitRepeatedValues(command, '--save-destination') as ContextractorInputType['saveDestination'];
```

**Problem:** `ExtractOpts` uses `string` for `deduplication`, `mode`, and `saveDestination` because Commander cannot express literal union types in its option interface. The casts bypass type safety — if Commander returns an invalid string value, the error is silently lost.

**Fix:** Both `--mode` and `--deduplication` already use `.choices([...])`. What is missing is type narrowing that eliminates the casts. Add Zod-based parser functions (consistent with the existing `parseCrawlerType` / `parseWaitUntil` / `parseProxyRotation` pattern) and wire them via `.argParser()`.

**Step ADD-PARSERS** — add before `buildSchemaOverrides`:

```typescript
function parseDeduplication(value: string): ContextractorInputType['deduplication'] {
  const result = ContextractorInput.shape.deduplication.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid --deduplication value: '${value}'. Use minimal, basic, or full.`);
  }
  return result.data;
}

function parseMode(value: string): ContextractorInputType['mode'] {
  const result = ContextractorInput.shape.mode.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid --mode value: '${value}'. Use precision, balanced, or recall.`);
  }
  return result.data;
}

function parseSaveDestination(
  value: string,
  previous: ContextractorInputType['saveDestination'],
): ContextractorInputType['saveDestination'] {
  const result = ContextractorInput.shape.saveDestination.element.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid --save-destination value: '${value}'. Use key-value-store or dataset.`);
  }
  return [...(previous ?? []), result.data];
}
```

**Step UPDATE-COMMANDER** — add `.argParser()` to the existing Commander options (keep `.choices()` — both coexist):

```typescript
// mode
new Option('--mode <mode>', '...').choices(['precision', 'balanced', 'recall'])
  .argParser(parseMode).default('balanced')

// deduplication
new Option('--deduplication <level>', '...').choices(['minimal', 'basic', 'full'])
  .argParser(parseDeduplication)

// save-destination: replace collectValues with parseSaveDestination
.option('--save-destination <dest>', '...', parseSaveDestination, ...)
```

**Step UPDATE-INTERFACE** — narrow `ExtractOpts`:

```typescript
mode?: ContextractorInputType['mode'];
deduplication?: ContextractorInputType['deduplication'];
saveDestination?: ContextractorInputType['saveDestination'];
```

**Step REMOVE-CASTS** — `buildSchemaOverrides` casts become unnecessary:

```typescript
if (isCliOverride(command, 'deduplication') && opts.deduplication !== undefined) {
  out.deduplication = opts.deduplication;  // no cast
}
if (isCliOverride(command, 'mode')) out.mode = opts.mode;  // no cast
if (isCliOverride(command, 'saveDestination')) {
  out.saveDestination = getExplicitRepeatedValues(command, '--save-destination')
    // TODO: remove cast when getExplicitRepeatedValues is refactored to return typed values
    as ContextractorInputType['saveDestination'];
}
```

The `saveDestination` cast in `buildSchemaOverrides` cannot be fully removed without refactoring `getExplicitRepeatedValues`, which reads raw CLI args and returns `string[]`. The single `as` (not `as unknown as`) is acceptable here.

---

## Issue 3: `orderEnvelope` key-reorder uses double-cast

**File:** `packages/schema/src/apify/to-apify-schema.ts:217, 223`

```typescript
const view = envelope as unknown as Record<string, unknown>;
// ...
return out as unknown as ApifyInputSchemaJSON;
```

**Problem:** The function converts `ApifyInputSchemaJSON` to `Record<string, unknown>` to reorder keys, then casts back. The double-cast bypasses structural verification on the output.

**Fix:** Replace `orderEnvelope` with an explicit field copy. JavaScript (V8, ES2015+ spec) preserves object literal insertion order for non-integer string keys, so key order matches `ENVELOPE_KEY_ORDER` with zero casts:

```typescript
function orderEnvelope({
  title,
  description,
  type,
  schemaVersion,
  properties,
  required,
}: ApifyInputSchemaJSON): ApifyInputSchemaJSON {
  if (description !== undefined) {
    return { title, description, type, schemaVersion, properties, required };
  }
  return { title, type, schemaVersion, properties, required };
}
```

The `if`/`else` on `description` (the only optional field) places it in position 2 when present and omits it otherwise — matching the current behaviour. If `ApifyInputSchemaJSON` gains a new required field, TypeScript will flag the missing assignment; the loop-based approach would silently skip it.
