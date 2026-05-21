# Fix Research — TypeScript Autofix Deferred Issues

Research conducted 2026-05-21. For each issue: current code, problem, recommended fix, alternatives.

---

## Issue 1: Double-cast on `@duckduckgo/autoconsent`

**File:** `packages/crawler/src/browser/cookies.ts:59`

### Current code

```typescript
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

// line 59
const AutoConsent = (mod.default ?? mod) as unknown as AutoconsentCtor;
```

### Root cause

`@duckduckgo/autoconsent` is a CJS package with no `.d.ts` declarations. TypeScript infers `mod` as `any` or an empty module type. The `as unknown as AutoconsentCtor` breaks out of the type system entirely.

The `mod.default ?? mod` fallback handles CJS interop: Node.js ESM wraps CJS `module.exports` as the synthetic default, but some older packages don't set up the default properly. In practice with modern Node.js, `mod.default` is always the constructor.

### Recommended fix: ambient module declaration

Create `packages/crawler/src/autoconsent.d.ts`:

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

Then in `cookies.ts`:
- Remove the local `AutoconsentCtor` type alias (it moves to the declaration file)
- Simplify line 59 to: `const AutoConsent = mod.default;`
- Remove the `?? mod` fallback — Node.js 22 ESM always wraps CJS as a synthetic default, and the declaration reflects the true runtime shape

The cast disappears entirely because `mod.default` is now typed as `AutoconsentCtor` via the ambient declaration.

### Alternative: keep `?? mod` with typed fallback

If the defensive fallback must be kept, annotate the types:

```typescript
// Only one cast (not double), since the ambient declaration types mod.default
const AutoConsent: AutoconsentCtor = (mod.default ?? mod) as AutoconsentCtor;
```

This is weaker than eliminating the cast but avoids one level of `unknown`.

### Why the recommended fix is better

- Zero casts in the call site
- `tsconfig` will validate the import against the declared type
- If the library is ever published with real declarations, remove `autoconsent.d.ts` and everything still compiles

---

## Issue 2: Commander CLI options typed as `string` instead of literal unions

**File:** `apps/standalone/src/cliProgram.ts:356, 359, 369`

### Current code

```typescript
// ExtractOpts interface (line 916–963)
interface ExtractOpts {
  mode?: string;           // should be ContextractorInputType['mode']
  deduplication?: string;  // should be ContextractorInputType['deduplication']
  saveDestination?: string[];  // should be ContextractorInputType['saveDestination']
}

// buildSchemaOverrides (lines 355–369)
out.deduplication = opts.deduplication as ContextractorInputType['deduplication'];
out.mode = opts.mode as ContextractorInputType['mode'];
out.saveDestination = getExplicitRepeatedValues(command, '--save-destination')
  as ContextractorInputType['saveDestination'];
```

### Schema types for context

```
deduplication: z.enum(['minimal', 'basic', 'full'])     → 'minimal' | 'basic' | 'full'
mode:          z.enum(['precision', 'balanced', 'recall']) → 'precision' | 'balanced' | 'recall'
saveDestination: z.array(z.enum(['key-value-store', 'dataset'])) → ('key-value-store' | 'dataset')[]
```

### Commander option definitions (current)

```typescript
// mode — already has .choices()
new Option('--mode <mode>', '...').choices(['precision', 'balanced', 'recall']).default('balanced')

// deduplication — already has .choices()
new Option('--deduplication <level>', '...').choices(['minimal', 'basic', 'full'])

// save-destination — no .choices(), uses collectValues accumulator
.option('--save-destination <dest>', '...', collectValues, ...)
```

### Existing pattern in codebase

`parseCrawlerType`, `parseWaitUntil`, and `parseProxyRotation` all follow the same pattern:
- Accept `string`, validate via switch, return the narrowed literal union type
- Wired into Commander via `.argParser(fn)` — Commander calls the parser and stores the result
- This means `ExtractOpts` can declare those fields with the narrow type, and no cast is needed in `buildSchemaOverrides`

### Recommended fix: add parser functions + update ExtractOpts

**Step ADD-PARSERS** — add three new parser functions consistent with the existing pattern:

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
    throw new Error(
      `Invalid --mode value: '${value}'. Use precision, balanced, or recall.`,
    );
  }
  return result.data;
}

function parseSaveDestination(value: string, previous: ContextractorInputType['saveDestination']): ContextractorInputType['saveDestination'] {
  const result = ContextractorInput.shape.saveDestination.element.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Invalid --save-destination value: '${value}'. Use key-value-store or dataset.`,
    );
  }
  return [...(previous ?? []), result.data];
}
```

Using `ContextractorInput.shape.X.safeParse()` avoids duplicating the enum values — the Zod schema is the single source of truth.

**Step UPDATE-COMMANDER** — wire parsers into options:

```typescript
// mode: add .argParser()
new Option('--mode <mode>', '...').choices(['precision', 'balanced', 'recall'])
  .argParser(parseMode).default('balanced')

// deduplication: add .argParser()
new Option('--deduplication <level>', '...').choices(['minimal', 'basic', 'full'])
  .argParser(parseDeduplication)

// save-destination: replace collectValues with parseSaveDestination
.option('--save-destination <dest>', '...', parseSaveDestination, ...)
```

Note: `.choices()` + `.argParser()` can coexist — Commander validates choices first (at the string level), then calls the parser. This means `parseDeduplication` and `parseMode` will never see an invalid string (choices already blocks it), but having the Zod parse makes the narrowing explicit and keeps the parser self-contained.

**Step UPDATE-INTERFACE** — narrow `ExtractOpts`:

```typescript
interface ExtractOpts {
  mode?: ContextractorInputType['mode'];
  deduplication?: ContextractorInputType['deduplication'];
  saveDestination?: ContextractorInputType['saveDestination'];
  // ... rest unchanged
}
```

**Step REMOVE-CASTS** — `buildSchemaOverrides` casts become unnecessary:

```typescript
// Before
out.deduplication = opts.deduplication as ContextractorInputType['deduplication'];
out.mode = opts.mode as ContextractorInputType['mode'];
out.saveDestination = getExplicitRepeatedValues(command, '--save-destination')
  as ContextractorInputType['saveDestination'];

// After
if (isCliOverride(command, 'deduplication') && opts.deduplication !== undefined) {
  out.deduplication = opts.deduplication;
}
if (isCliOverride(command, 'mode')) out.mode = opts.mode;
if (isCliOverride(command, 'saveDestination')) {
  out.saveDestination = getExplicitRepeatedValues(command, '--save-destination')
    as ContextractorInputType['saveDestination'];
}
```

Note: `saveDestination` still needs a cast in `buildSchemaOverrides` because `getExplicitRepeatedValues` returns `string[]` (it reads raw CLI args). That function is kept as-is; the typed accumulator in `parseSaveDestination` is the proper path for Commander-parsed values. The cast here is reduced to one level (`string[]` → typed array) from two.

### Alternative: switch-based parsers (matches existing style exactly)

```typescript
function parseDeduplication(value: string): ContextractorInputType['deduplication'] {
  switch (value) {
    case 'minimal':
    case 'basic':
    case 'full':
      return value;
    default:
      throw new Error(`Invalid --deduplication value: '${value}'. Use minimal, basic, or full.`);
  }
}
```

Pros: consistent with `parseCrawlerType`, `parseWaitUntil`, `parseProxyRotation`.
Cons: enum values are duplicated from the Zod schema.

### Why Zod-based parsers are better

- `ContextractorInput.shape.X.safeParse()` derives the valid values from the schema — no duplication
- Return type is inferred from the schema type, not hand-written
- If the enum values change in the schema, the parser stays correct without edits

---

## Issue 3: `orderEnvelope` key-reorder uses double-cast

**File:** `packages/schema/src/apify/to-apify-schema.ts:217, 223`

### Current code

```typescript
interface ApifyInputSchemaJSON {
  title: string;
  description?: string;
  type: 'object';
  schemaVersion: 1;
  properties: Record<string, Record<string, unknown>>;
  required: string[];
}

const ENVELOPE_KEY_ORDER: readonly (keyof ApifyInputSchemaJSON)[] = [
  'title', 'description', 'type', 'schemaVersion', 'properties', 'required',
];

function orderEnvelope(envelope: ApifyInputSchemaJSON): ApifyInputSchemaJSON {
  const out: Record<string, unknown> = {};
  const view = envelope as unknown as Record<string, unknown>;  // cast 1
  for (const key of ENVELOPE_KEY_ORDER) {
    if (key in view) {
      out[key] = view[key];
    }
  }
  return out as unknown as ApifyInputSchemaJSON;  // cast 2
}
```

### Root cause

TypeScript cannot index a typed object with a `keyof` union to assign into another typed object of the same shape without complaining about distribution. The two `as unknown as` casts sidestep this, but lose structural verification on the output.

### Recommended fix: explicit field copy

`ApifyInputSchemaJSON` has exactly 6 fields. The order is entirely determined by `ENVELOPE_KEY_ORDER`. Build the output object explicitly, field by field, in the desired order:

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

Zero casts. TypeScript validates every field. JavaScript (V8 + spec ES2015+) preserves object literal insertion order for non-integer string keys, so key order matches `ENVELOPE_KEY_ORDER` exactly.

The `if/else` on `description` (the only optional field) keeps `description` in position 2 when present, and omits it otherwise — matching the current behavior.

`ENVELOPE_KEY_ORDER` can be kept as documentation / used by other callers if any exist, but is no longer used by `orderEnvelope`.

### Alternative A: single cast via `Partial`

```typescript
function orderEnvelope(envelope: ApifyInputSchemaJSON): ApifyInputSchemaJSON {
  const out = {} as Partial<Record<keyof ApifyInputSchemaJSON, ApifyInputSchemaJSON[keyof ApifyInputSchemaJSON]>>;
  for (const key of ENVELOPE_KEY_ORDER) {
    if (envelope[key] !== undefined) {
      out[key] = envelope[key];
    }
  }
  return out as ApifyInputSchemaJSON;
}
```

One cast instead of two, and TypeScript verifies field types during assignment. But this is more complex than the explicit approach.

### Alternative B: the approach in the deferred prompt

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

This still has casts (one per assignment and one final). TypeScript's widening behavior for indexed assignments on union keys requires `as ApifyInputSchemaJSON[typeof key]`. This is better than `as unknown as`, but not as clean as the explicit approach.

### Why explicit field copy is best

- Zero casts
- TypeScript will catch a missing field assignment if `ApifyInputSchemaJSON` grows a new required field
- No loop to reason about
- Shorter and more readable
- Key ordering is guaranteed by object literal spec

---

## Summary of recommended fixes

| Issue | File | Approach | Casts removed |
|-------|------|----------|---------------|
| 1 | `cookies.ts:59` | Add `autoconsent.d.ts` ambient declaration; simplify to `mod.default` | `as unknown as AutoconsentCtor` |
| 2 | `cliProgram.ts:356,359,369` | Add Zod-based parser functions; wire via `.argParser()`; narrow `ExtractOpts` | all three casts |
| 3 | `to-apify-schema.ts:217,223` | Explicit field copy in `orderEnvelope` | both `as unknown as` casts |
