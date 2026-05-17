# Optimize CLI Arguments to Industry Standards

> **TLDR**: Audit and fix `apps/standalone/src/cliProgram.ts` CLI flags to Commander.js v14 and GNU conventions. Covers: replacing `--precision`/`--recall` with `--mode <mode>`, promoting `trafilaturaConfig` fields to top-level schema, fixing asymmetric boolean pairs, switching comma-split flags to repeatable, exposing schema defaults in help output, and dropping low-value parameters.

Audit and fix CLI flags in `apps/standalone/src/cliProgram.ts` to conform to Commander.js v14 and GNU/clig.dev conventions. Clean break — no deprecated aliases, no version bump needed yet.

**Background reading:** `./context/extraction-mode-research.md` documents Trafilatura's three-state precision/recall axis, rs-trafilatura's `Options` surface, and the cross-library naming survey that underpins the `ExtractionMode` enum introduced below.

## Non-issues (leave as-is)

- `-V, --version` — correct; `-V` avoids conflict with `-v` (verbose). docker, kubectl, gh all use only `--version` long form.
- `--headless` / `--no-headless` — correct GNU negation. Never use `--headless=true/false`; Commander ignores the value and only checks presence.
- `--block-media` / `--no-block-media` — correct symmetric pair.
- `--no-links`, `--no-comments` — correct; Commander makes the positive the default implicitly.

## Fix: Collapse `--precision` / `--recall` into `--mode <mode>`

The current CLI exposes `--precision` and `--recall` as two independent boolean flags, mirroring Trafilatura's legacy `favor_precision` / `favor_recall` Python API. This is the wrong surface for a CLI: the two booleans collapse into a three-state internal `focus` field (`"precision" | "balanced" | "recall"`) in `trafilatura/settings.py`, the upstream CLI itself uses an `add_mutually_exclusive_group()` to forbid setting both, and rs-trafilatura's boolean pair is a legacy artifact. See `./context/extraction-mode-research.md` for the full evidence.

Replace the two flags with a single Commander `.option('--mode <mode>', …)` that accepts one of three string values, defaults to `balanced`, and validates the value with Commander's `choices()`. The CLI surface stops conflating two flags into one logical knob, eliminates the silently-undefined `(true, true)` combination, and matches the wording of Trafilatura's own internal `focus` field and go-trafilatura's `ExtractionFocus` enum.

| Old | New |
|---|---|
| `--precision` (boolean) | `--mode precision` |
| `--recall` (boolean) | `--mode recall` |
| *(implicit when neither is set)* | `--mode balanced` *(explicit default)* |

In `addExtractionOptions()`:

```ts
import { Option } from 'commander';

// remove:
//   .option('--precision', 'High precision mode (less noise)')
//   .option('--recall', 'High recall mode (more content)')

// add:
.addOption(
  new Option('--mode <mode>', 'Extraction mode: precision (less noise), balanced (default), or recall (more content)')
    .choices(['precision', 'balanced', 'recall'] as const)
    .default('balanced'),
)
```

Update the `ExtractOpts` interface: remove `precision?: boolean` and `recall?: boolean`; add:

```ts
export type ExtractionMode = 'precision' | 'balanced' | 'recall';

export interface ExtractOpts {
  // …
  mode?: ExtractionMode;
}
```

In `buildSchemaOverrides()`, replace the two boolean checks with a single mapping:

```ts
// remove:
//   if (opts.precision) tcfg.favorPrecision = true;
//   if (opts.recall)    tcfg.favorRecall    = true;

// add:
if (opts.mode && opts.mode !== 'balanced') {
  tcfg.favorPrecision = opts.mode === 'precision';
  tcfg.favorRecall    = opts.mode === 'recall';
}
```

(The `!== 'balanced'` guard keeps the override map sparse: balanced is the library default, so emitting neither key preserves any value set by a higher-precedence config layer.)

Keep `--fast` as a separate boolean flag — it's an algorithm-selection / speed knob orthogonal to the precision/recall axis (see §5.5 of the research note).

## Fix: Promote `trafilaturaConfig` fields to top-level schema

`trafilaturaConfig` is currently a loose `Record<string, unknown>` blob in `ContextractorInput` — a JSON editor in the Apify console, an opaque key in config files, and an intermediate assembly target in the CLI. Promote every field to a first-class top-level Zod field. Apply to both the standalone CLI and the Apify Actor.

The internal `TrafilaturaConfig` interface and `DEFAULT_CONFIG` in `packages/extraction/src/index.ts` are the rs-trafilatura binding layer — they stay. Only the user-facing schema surface changes.

### In `packages/schema/src/source-of-truth/input.ts`

Remove `trafilaturaConfig`. Add these individual fields at the top level (defaults from `DEFAULT_CONFIG` in `@contextractor/extraction`):

| Schema field | Type | Default | Note |
|---|---|---|---|
| `fast` | `z.boolean()` | `false` | |
| `includeComments` | `z.boolean()` | `true` | |
| `includeTables` | `z.boolean()` | `true` | |
| `includeImages` | `z.boolean()` | `false` | |
| `includeFormatting` | `z.boolean()` | `true` | |
| `includeLinks` | `z.boolean()` | `true` | |
| `deduplicate` | `z.boolean()` | `false` | |
| `targetLanguage` | `z.string().nullable()` | `null` | |
| `withMetadata` | `z.boolean()` | `true` | |
| `onlyWithMetadata` | `z.boolean()` | `false` | |

`favorPrecision` and `favorRecall` are subsumed by the `--mode` flag above — do not add them as schema fields. `teiValidation` is a forward-compat placeholder with no runtime effect — drop it.

For the Apify console, group all promoted fields under `apifyMeta({ sectionCaption: 'Content extraction' })`. Use appropriate editor overrides:
- Boolean fields: no override needed (renders as toggle by default)
- `targetLanguage`: `apifyMeta({ editor: 'textfield', sectionCaption: 'Content extraction' })`

After updating the Zod schema, regenerate the Apify input schema:

```bash
pnpm --filter @contextractor/gen-input-schema start
```

This replaces the single `trafilaturaConfig` JSON editor entry with individual typed properties in `apps/apify-actor/.actor/input_schema.json`. Verify the output contains each promoted field at the top level and no longer contains `trafilaturaConfig`.

### In `apps/standalone/src/cliProgram.ts` — `buildSchemaOverrides()`

Remove the entire `tcfg` block. Map each CLI flag directly to a top-level `out` field. The CLI flag names translate to schema field names at this boundary (e.g., `opts.tables` → `out.includeTables`):

```ts
// Remove entirely:
// const tcfg: Record<string, unknown> = {};
// if (...) tcfg.X = ...;
// if (Object.keys(tcfg).length > 0) out.trafilaturaConfig = tcfg;

// Add flat mappings:
if (opts.fast !== undefined) out.fast = opts.fast;
if (opts.tables !== undefined) out.includeTables = opts.tables;
if (opts.images !== undefined) out.includeImages = opts.images;
if (opts.formatting !== undefined) out.includeFormatting = opts.formatting;
if (opts.links === false) out.includeLinks = false;
if (opts.comments === false) out.includeComments = false;
if (opts.deduplicate !== undefined) out.deduplicate = opts.deduplicate;
if (opts.targetLanguage !== undefined) out.targetLanguage = opts.targetLanguage;
if (opts.metadata !== undefined) out.withMetadata = opts.metadata;
```

Also remove the `trafilaturaConfig` layering logic in `runExtractAction()` — the top-level `{ ...fromFile, ...fromCli }` spread handles all fields uniformly once the subtype is gone.

### In both apps — building `TrafilaturaConfig` for the crawler

Replace `normalizeConfigKeys(input.trafilaturaConfig)` with a direct typed mapping from the promoted top-level fields. The `mode` field translates to `favorPrecision`/`favorRecall` here:

```ts
import { DEFAULT_CONFIG, type TrafilaturaConfig } from '@contextractor/extraction';

function toExtractionConfig(input: ContextractorInputType): TrafilaturaConfig {
  return {
    ...DEFAULT_CONFIG,
    fast: input.fast,
    favorPrecision: input.mode === 'precision',
    favorRecall: input.mode === 'recall',
    includeComments: input.includeComments,
    includeTables: input.includeTables,
    includeImages: input.includeImages,
    includeFormatting: input.includeFormatting,
    includeLinks: input.includeLinks,
    deduplicate: input.deduplicate,
    targetLanguage: input.targetLanguage,
    withMetadata: input.withMetadata,
    onlyWithMetadata: input.onlyWithMetadata,
    teiValidation: false,
  };
}
```

Apply in `apps/standalone/src/config.ts` and `apps/apify-actor/src/config.ts`.

### Config file format (breaking change, clean break)

Before: `{ "trafilaturaConfig": { "includeTables": false } }`
After: `{ "includeTables": false }` — top-level, consistent with all other fields.

## Fix: `@contextractor/crawler` package API — `ContextractorCrawlerOptions`

`ContextractorCrawlerOptions` in `packages/crawler/src/createCrawler.ts` currently exposes the internal binding type directly: `extractionConfig?: TrafilaturaConfig`. External callers must know about `TrafilaturaConfig` and construct it themselves. Replace with individual named options matching the promoted Zod schema fields. The `TrafilaturaConfig` assembly moves inside the package.

### In `packages/crawler/src/createCrawler.ts`

Replace `extractionConfig?: TrafilaturaConfig` in `ContextractorCrawlerOptions` with:

```ts
// Remove:
//   extractionConfig?: TrafilaturaConfig;

// Add (names match promoted Zod schema fields):
mode?: 'precision' | 'balanced' | 'recall';
fast?: boolean;
includeComments?: boolean;
includeTables?: boolean;
includeImages?: boolean;
includeFormatting?: boolean;
includeLinks?: boolean;
deduplicate?: boolean;
targetLanguage?: string | null;
withMetadata?: boolean;
onlyWithMetadata?: boolean;
```

Add a private helper at the top of `createCrawler.ts` that assembles `TrafilaturaConfig` from the individual options:

```ts
import { DEFAULT_CONFIG, type TrafilaturaConfig } from '@contextractor/extraction';

function toTrafilaturaConfig(opts: ContextractorCrawlerOptions): TrafilaturaConfig {
  return {
    ...DEFAULT_CONFIG,
    fast: opts.fast ?? DEFAULT_CONFIG.fast,
    favorPrecision: opts.mode === 'precision',
    favorRecall: opts.mode === 'recall',
    includeComments: opts.includeComments ?? DEFAULT_CONFIG.includeComments,
    includeTables: opts.includeTables ?? DEFAULT_CONFIG.includeTables,
    includeImages: opts.includeImages ?? DEFAULT_CONFIG.includeImages,
    includeFormatting: opts.includeFormatting ?? DEFAULT_CONFIG.includeFormatting,
    includeLinks: opts.includeLinks ?? DEFAULT_CONFIG.includeLinks,
    deduplicate: opts.deduplicate ?? DEFAULT_CONFIG.deduplicate,
    targetLanguage: opts.targetLanguage ?? DEFAULT_CONFIG.targetLanguage,
    withMetadata: opts.withMetadata ?? DEFAULT_CONFIG.withMetadata,
    onlyWithMetadata: opts.onlyWithMetadata ?? DEFAULT_CONFIG.onlyWithMetadata,
    teiValidation: false,
  };
}
```

Replace each `extractionConfig: opts.extractionConfig` call site in `createContextractorCrawler()` with `extractionConfig: toTrafilaturaConfig(opts)`.

### In `packages/crawler/src/handler.ts`

The handler opts type (`HandlerOpts` or equivalent) currently takes `extractionConfig?: TrafilaturaConfig`. Since `toTrafilaturaConfig()` is called once in `createContextractorCrawler()`, pass the assembled `TrafilaturaConfig` through to the handler as before — no change needed in handler.ts beyond whatever type adjustments follow from the `createCrawler.ts` refactor.

### In both apps — caller side

The apps' `toExtractionConfig()` (or `buildCrawlerOpts()`) now passes individual fields to `createContextractorCrawler()` instead of a pre-assembled `TrafilaturaConfig`:

```ts
// Before:
extractionConfig: toExtractionConfig(input),

// After:
mode: input.mode,
fast: input.fast,
includeComments: input.includeComments,
// … one field per promoted schema field
```

## Fix: Asymmetric boolean pairs (CLI flags)

Rename in `addExtractionOptions()`. Symmetric pairs: base name is the concept, `--no-` is the negation. The corresponding schema field names keep their descriptive form (`includeTables`, `withMetadata`, etc.) — translation happens in `buildSchemaOverrides()`.

| Old CLI flag | New CLI flag | Schema field |
|---|---|---|
| `--include-tables` | `--tables` (pairs with existing `--no-tables`) | `includeTables` |
| `--include-formatting` | `--formatting` (pairs with existing `--no-formatting`) | `includeFormatting` |
| `--with-metadata` | `--metadata` (pairs with existing `--no-metadata`) | `withMetadata` |
| `--include-images` | `--images` + add `--no-images` immediately after | `includeImages` |

Commander auto-generates camelCase property names from the flag: `--tables` → `opts.tables`.

## Fix: Dual-property shadowing bug in `buildSchemaOverrides()` — subsumed

This bug (two `ExtractOpts` properties mapping to the same `tcfg` key) is eliminated entirely by the trafilaturaConfig promotion fix above: the `tcfg` intermediate object no longer exists. Update `ExtractOpts` interface: remove `includeTables`, `includeFormatting`, `withMetadata`; add `images?: boolean`; the rest map directly to top-level schema fields.

## Fix: Comma-separated multi-value flags → repeatable

Comma-split breaks on values containing commas (proxy URLs). Repeatable is the convention used by Docker, kubectl, git.

| Old | New |
|---|---|
| `--save <formats>` (comma-split string) | `--save <format>` (repeatable, uses `collect`) |
| `--proxy-urls <urls>` (comma-split string) | `--proxy <url>` (repeatable, uses `collect`) |
| `--globs <patterns>` (comma-split string) | `--glob <pattern>` (repeatable, uses `collect`) |
| `--excludes <patterns>` (comma-split string) | `--exclude <pattern>` (repeatable, uses `collect`) |

Use the existing `collectValues` helper (already used by `--save-destination`):

```ts
.option('--save <format>', 'Output format: markdown, txt, json, html, original (repeatable)', collectValues, s.save._def.defaultValue())
.option('--proxy <url>', 'Proxy URL (repeatable)', collectValues, [] as string[])
.option('--glob <pattern>', 'Glob pattern to include (repeatable)', collectValues, [] as string[])
.option('--exclude <pattern>', 'Glob pattern to exclude (repeatable)', collectValues, [] as string[])
```

The `--save` default reads from the Zod schema (`s.save._def.defaultValue()` → `['markdown']`), so `--help` shows `(default: markdown)` and omitting `--save` produces markdown output automatically. This is the same default the Apify Actor and npm library already use via the schema — no change needed in those layers.

In `buildSchemaOverrides()`, remove the `.split(',')` call for `save` — the value is already `string[]`:

```ts
if (opts.save?.length) save = validateSaveFormats(opts.save);
```

Remove `.split(',')` calls for the other flags too — values are already `string[]`:

```ts
if (opts.glob?.length) out.globs = opts.glob.map((s) => ({ glob: s }));
if (opts.exclude?.length) out.excludes = opts.exclude.map((s) => ({ glob: s }));
```

In `resolveCliOnly()`:

```ts
const proxyUrls = opts.proxy ?? [];
```

Update `ExtractOpts`: `save?: string` → `save?: string[]`; `proxyUrls?: string` → `proxy?: string[]`; `globs?: string` → `glob?: string[]`; `excludes?: string` → `exclude?: string[]`.

## Fix: Show defaults and required indicators in help output

Commander.js v14 auto-appends `(default: value)` to help text when a default is passed at option-definition time. Nearly all defaults already live in `packages/schema/src/source-of-truth/input.ts` — that is the single source of truth. Do not hardcode values in Commander calls; read them from the schema so a change propagates automatically to `--help`.

**Pattern — read schema defaults in `cliProgram.ts`** (`ContextractorInput` is already imported):

```ts
const s = ContextractorInput.shape;
// s.headless._def.defaultValue()           → true
// s.maxPagesPerCrawl._def.defaultValue()   → 0
// s.pageLoadTimeoutSecs._def.defaultValue() → 60
// s.maxConcurrency._def.defaultValue()     → 50
```

**Numeric options where `0` has a special meaning** — use `.default(value, 'label')` for a human-readable label:

```ts
new Option('--max-pages <n>', 'Max pages to crawl', toInt)
  .default(s.maxPagesPerCrawl._def.defaultValue(), 'unlimited')
// help → --max-pages <n>  Max pages to crawl (default: unlimited)
```

**Numeric options with a meaningful non-zero default** — pass schema value directly:

```ts
new Option('--page-load-timeout <secs>', 'Page load timeout in seconds', toInt)
  .default(s.pageLoadTimeoutSecs._def.defaultValue())
// help → --page-load-timeout <secs>  Page load timeout in seconds (default: 60)
```

**Boolean flags with a non-obvious `true` default** — `headless` and `closeCookieModals` both default to `true` in the schema. Pass the schema value so `--help` reveals this:

```ts
.option('--headless', 'Run browser in headless mode', s.headless._def.defaultValue())
// help → --headless  Run browser in headless mode (default: true)
```

Omit explicit defaults for boolean flags whose schema default is `false` — that is the obvious assumption and adding `(default: false)` to every flag is noise.

**Enum/choice options** — the `--mode` option introduced in this prompt already uses the correct pattern (`.choices([...]).default('balanced')`); `balanced` has no schema field yet so hardcoding is appropriate here.

**CLI-only options with no schema equivalent** — hardcode the default since there is no schema field to reference:

```ts
.option('-o, --output-dir <dir>', 'Output directory', './output')
```

Remove any manual `"(default: …)"` or `"(0 = unlimited)"` strings from description text for options migrated to Commander defaults — the annotation will be auto-generated.

**Required indicators** — the `<angle bracket>` convention in the flag string is the universal signal. Commander's `.requiredOption()` enforces absence at parse time but adds no visual marker in help — this matches Docker, kubectl, and gh. Contextractor has no unconditionally required options (URLs are positional), so `.requiredOption()` is not needed. The existing `<bracket>` notation is sufficient.

**Options to update** in `addExtractionOptions()` (read all values from `ContextractorInput.shape`):

- `--save` — use `s.save._def.defaultValue()` (resolves to `['markdown']`); Commander auto-appends `(default: markdown)` to help; covered by the repeatable flags section above
- `--save-destination` — already repeatable, but its Commander default is `[] as string[]` instead of the schema default; replace with `s.saveDestination._def.defaultValue()` (resolves to `['key-value-store']`); then remove the manual fallback in `runExtractAction()` at the `destinations` assignment — `opts.saveDestination` will never be empty after this change:

  ```ts
  // Before:
  const destinations =
    (opts.saveDestination ?? []).length > 0 ? (opts.saveDestination ?? []) : ['key-value-store'];

  // After:
  const destinations = opts.saveDestination;
  ```

- `--output-dir` — hardcode `'./output'` (CLI-only); remove `"(default: ./output)"` from description
- `--max-pages`, `--max-results`, `--crawl-depth` — `.default(schema value, 'unlimited')`; remove `"(0 = …)"` from description
- `--page-load-timeout`, `--max-concurrency`, `--max-retries`, `--max-scroll-height` — `.default(schema value)`
- `--headless`, `--close-cookie-modals` — pass `s.fieldName._def.defaultValue()` (both are `true`; non-obvious)
- `--initial-concurrency` — keep description `"(0 = Crawlee default)"` as-is; `0` means Crawlee picks at runtime, not a static schema value

## Drop: Remove low-value parameters

See `./context/drop-suggestions-ressearch.md` for the full evidence behind these decisions.

### Extraction settings — drop from schema, CLI, and `ContextractorCrawlerOptions`

**`withMetadata` / `--with-metadata` / `--no-metadata`** — the Rust binding explicitly discards this field (`let _ = cfg.with_metadata`). rs-trafilatura always returns a `Metadata` struct regardless. The `DEFAULT_CONFIG` in TypeScript sets it to `true`, making it a lie that costs a flag. Drop from schema, CLI, and crawler API.

**`teiValidation`** — the Rust binding explicitly discards this field (`let _ = cfg.tei_validation`). rs-trafilatura 0.2.x has no TEI XML output. Drop from schema, CLI, and crawler API.

**`fast`** — the Rust binding maps `fast=true` to `rs.use_fallback_extraction = false`, which is architecturally different from Python trafilatura's `no_fallback` (which skips readability+justext). Users migrating from Python trafilatura will have false expectations. The flag has no meaningful real-world production use (HuggingFace `datatrove`, FineWeb, RefinedWeb all leave it off). Drop from schema, CLI, and crawler API.

**`onlyWithMetadata`** — drops documents lacking date+title+url. Wrong abstraction level for a crawling tool: if the user enqueued a URL, they expect a result. Post-processing filters belong at the consumer layer. Drop from schema, CLI, and crawler API.

**`includeFormatting`** — forced on for markdown output, meaningless for txt output, only matters for HTML output (edge case). Exposing it creates confusion without real control. Drop from schema, CLI, and crawler API. Internally, always pass `true` to the binding.

**`deduplicate`** — segment-level deduplication within a single page extraction. Niche, hard to predict, and the right place to deduplicate is the pipeline layer (Crawlee already deduplicates URLs). Drop from schema, CLI, and crawler API. Internally, always pass `false`.

### Schema-only — drop from `ContextractorInput` and Apify Actor

**`pseudoUrls`** — legacy Apify Actor pattern predating glob support. Fully superseded by `globs` / `excludes`. Drop from the Zod schema and Apify input schema. No CLI flag exists for it.

**`debugLog`** — Apify Actor diagnostic toggle. The CLI already has `-v, --verbose` for debug output. Drop from the Zod schema and Apify input schema; do not expose as a CLI flag.

**`browserLog`** — Apify Actor diagnostic toggle (browser console messages in the run log). High-noise, low-value outside Apify's own diagnostics infrastructure. Drop from the Zod schema and Apify input schema.

### CLI-only — drop from `addExtractionOptions()`

**`--start-url <url>`** — redundant with the positional `[urls...]` argument. Both feed the same `collectedUrls` array in `runExtractAction()`. Drop the flag; positional args are the standard convention for URL inputs. Update the command description accordingly.

### What the promoted extraction surface looks like after drops

The `ContextractorCrawlerOptions` extraction fields (and corresponding Zod schema fields) reduce to:

| Field | Default | Note |
|---|---|---|
| `mode` | `'balanced'` | replaces `favorPrecision` + `favorRecall` |
| `includeComments` | `true` | |
| `includeTables` | `true` | |
| `includeImages` | `false` | |
| `includeLinks` | `true` | |
| `targetLanguage` | `null` | |

`includeFormatting`, `deduplicate`, `withMetadata`, `onlyWithMetadata`, `fast`, `teiValidation` are all internal implementation details — hardcode them in `toTrafilaturaConfig()` (`includeFormatting: true`, `deduplicate: false`, etc.) and never expose them.

## After changes

- `pnpm --filter @contextractor/standalone build` — must compile clean
- `pnpm test` — all tests must pass; update any test using old flag names
- Update `apps/standalone/SPEC.md` with renamed flags
- Verify with `node apps/standalone/dist/cli.js --help` — old names must not appear
- Run `grep -r 'include-tables\|with-metadata\|include-formatting\|proxy-urls\|--globs\|--excludes\|--precision\|--recall' apps/` — must return no matches (note: `--mode precision` and `--mode recall` are the new spellings and should appear instead)
- Run `grep -rn 'trafilaturaConfig\|normalizeConfigKeys' apps/` — must return no matches; both are eliminated from the app layer (they may still appear in `packages/extraction/` as internal binding helpers)
- Run `grep -n 'extractionConfig' packages/crawler/src/createCrawler.ts` — must return no matches in `ContextractorCrawlerOptions`; `extractionConfig` may still appear inside `createContextractorCrawler()` as the assembled value passed to handlers
- Verify `apps/apify-actor/.actor/input_schema.json` contains each promoted field (`fast`, `includeTables`, etc.) at the top level and no longer contains `trafilaturaConfig`
- Run `grep -n 'default: \./output\|0 = unlimited\|0 = Crawlee default' apps/standalone/src/cliProgram.ts` — first two must return no matches; `"0 = Crawlee default"` on `--initial-concurrency` is the one intentional exception
- Run `grep -n '\.split.*save\|save.*split' apps/standalone/src/cliProgram.ts` — must return no matches; `--save` is now repeatable so no split needed
- Verify `node apps/standalone/dist/cli.js extract --help` shows `(default: markdown)` for `--save` and that omitting `--save` produces `*.md` output files
