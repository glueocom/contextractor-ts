# Optimize CLI Arguments to Industry Standards

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

## Fix: Asymmetric boolean pairs

Rename in `addExtractionOptions()`. Symmetric pairs: base name is the concept, `--no-` is the negation.

| Old | New |
|---|---|
| `--include-tables` | `--tables` (pairs with existing `--no-tables`) |
| `--include-formatting` | `--formatting` (pairs with existing `--no-formatting`) |
| `--with-metadata` | `--metadata` (pairs with existing `--no-metadata`) |
| `--include-images` | `--images` + add `--no-images` immediately after |

Commander auto-generates camelCase property names: `--tables` → `opts.tables`, etc.

## Fix: Dual-property shadowing bug in `buildSchemaOverrides()`

The asymmetric pairs above created two properties per concept, with the second silently overwriting the first. After renaming, remove stale lines and keep only the camelCase-from-flag property:

```ts
// Remove these stale lines:
if (opts.includeTables !== undefined) tcfg.includeTables = opts.includeTables;
if (opts.includeFormatting !== undefined) tcfg.includeFormatting = opts.includeFormatting;
if (opts.withMetadata !== undefined) tcfg.withMetadata = opts.withMetadata;
if (opts.includeImages !== undefined) tcfg.includeImages = opts.includeImages; // if present

// Keep only these (renamed properties):
if (opts.tables !== undefined) tcfg.includeTables = opts.tables;
if (opts.formatting !== undefined) tcfg.includeFormatting = opts.formatting;
if (opts.metadata !== undefined) tcfg.withMetadata = opts.metadata;
if (opts.images !== undefined) tcfg.includeImages = opts.images;
```

Update `ExtractOpts` interface: remove `includeTables`, `includeFormatting`, `withMetadata`; add `images?: boolean`.

## Fix: Comma-separated multi-value flags → repeatable

Comma-split breaks on values containing commas (proxy URLs). Repeatable is the convention used by Docker, kubectl, git.

| Old | New |
|---|---|
| `--proxy-urls <urls>` (comma-split string) | `--proxy <url>` (repeatable, uses `collect`) |
| `--globs <patterns>` (comma-split string) | `--glob <pattern>` (repeatable, uses `collect`) |
| `--excludes <patterns>` (comma-split string) | `--exclude <pattern>` (repeatable, uses `collect`) |

Use the existing `collect` helper (already used by `--save-destination`):

```ts
.option('--proxy <url>', 'Proxy URL (repeatable)', collect, [] as string[])
.option('--glob <pattern>', 'Glob pattern to include (repeatable)', collect, [] as string[])
.option('--exclude <pattern>', 'Glob pattern to exclude (repeatable)', collect, [] as string[])
```

In `buildSchemaOverrides()`, remove `.split(',')` calls — values are already `string[]`:

```ts
if (opts.glob?.length) out.globs = opts.glob.map((s) => ({ glob: s }));
if (opts.exclude?.length) out.excludes = opts.exclude.map((s) => ({ glob: s }));
```

In `resolveCliOnly()`:

```ts
const proxyUrls = opts.proxy ?? [];
```

Update `ExtractOpts`: `proxyUrls?: string` → `proxy?: string[]`; `globs?: string` → `glob?: string[]`; `excludes?: string` → `exclude?: string[]`.

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

- `--output-dir` — hardcode `'./output'` (CLI-only); remove `"(default: ./output)"` from description
- `--max-pages`, `--max-results`, `--crawl-depth` — `.default(schema value, 'unlimited')`; remove `"(0 = …)"` from description
- `--page-load-timeout`, `--max-concurrency`, `--max-retries`, `--max-scroll-height` — `.default(schema value)`
- `--headless`, `--close-cookie-modals` — pass `s.fieldName._def.defaultValue()` (both are `true`; non-obvious)
- `--initial-concurrency` — keep description `"(0 = Crawlee default)"` as-is; `0` means Crawlee picks at runtime, not a static schema value

## After changes

- `pnpm --filter @contextractor/standalone build` — must compile clean
- `pnpm test` — all tests must pass; update any test using old flag names
- Update `apps/standalone/SPEC.md` with renamed flags
- Verify with `node apps/standalone/dist/cli.js --help` — old names must not appear
- Run `grep -r 'include-tables\|with-metadata\|include-formatting\|proxy-urls\|--globs\|--excludes\|--precision\|--recall' apps/` — must return no matches (note: `--mode precision` and `--mode recall` are the new spellings and should appear instead)
- Run `grep -n 'default: \./output\|0 = unlimited\|0 = Crawlee default' apps/standalone/src/cliProgram.ts` — first two must return no matches; `"0 = Crawlee default"` on `--initial-concurrency` is the one intentional exception
