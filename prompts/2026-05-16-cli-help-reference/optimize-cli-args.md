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

Commander.js v14 auto-appends `(default: value)` to help text when a default is passed at option-definition time. Currently, most options omit the default from the Commander call (leaving it to the schema layer at runtime), so help output shows nothing. Fix the options where the default is known statically.

**String options with a static default** — pass the default as the third arg to `.option()`, and remove any manual "(default: …)" from the description string:

```ts
.option('-o, --output-dir <dir>', 'Output directory', './output')
// help → -o, --output-dir <dir>  Output directory (default: "./output")
```

**Enum/choice options** — Commander renders choices and default together automatically; the `--mode` option introduced in this prompt already uses this correctly:

```ts
.addOption(
  new Option('--mode <mode>', 'Extraction mode: …')
    .choices(['precision', 'balanced', 'recall'])
    .default('balanced'),
)
// help → --mode <mode>  Extraction mode: … (choices: "precision", "balanced", "recall", default: "balanced")
```

**Numeric options where `0` has a special meaning** — use the two-arg `default(value, 'label')` form to show a human-readable label instead of the raw number:

```ts
.addOption(new Option('--max-pages <n>', 'Max pages to crawl', toInt).default(0, 'unlimited'))
.addOption(new Option('--max-results <n>', 'Max results per crawl', toInt).default(0, 'unlimited'))
```

**Boolean flags** — omit explicit defaults for flags where `false` is obvious (i.e., most toggles). Only add `.default(true)` where the flag is on by default and that would surprise a user.

**Required indicators** — the `<angle bracket>` convention in the flag string is the universal signal for "this option needs a value if used." Commander's `.requiredOption()` enforces absence at parse time with an error, but adds no visual marker in help text — this is correct behavior shared by Docker, kubectl, and gh. Do not add manual `(required)` to description text unless the requirement is genuinely non-obvious to users.

Contextractor has no unconditionally required options (URLs are positional), so `.requiredOption()` is not needed anywhere. The existing `<bracket>` notation is sufficient.

**Options to update** in `addExtractionOptions()`:

- `--output-dir` — pass `'./output'` as the third arg; remove `"(default: ./output)"` from description string
- `--max-pages` — convert to `new Option(..., toInt).default(0, 'unlimited')`; remove `"(0 = unlimited)"` from description string
- `--max-results` — same as `--max-pages`
- `--initial-concurrency` — keep current description `"(0 = Crawlee default)"`; the default is a Crawlee runtime constant, not a static value
- All other numeric options whose defaults come from the schema layer at runtime — keep the description text as-is; do not guess at defaults

## After changes

- `pnpm --filter @contextractor/standalone build` — must compile clean
- `pnpm test` — all tests must pass; update any test using old flag names
- Update `apps/standalone/SPEC.md` with renamed flags
- Verify with `node apps/standalone/dist/cli.js --help` — old names must not appear
- Run `grep -r 'include-tables\|with-metadata\|include-formatting\|proxy-urls\|--globs\|--excludes\|--precision\|--recall' apps/` — must return no matches (note: `--mode precision` and `--mode recall` are the new spellings and should appear instead)
- Run `grep -r 'default: \./output\|0 = unlimited' apps/standalone/src/cliProgram.ts` — must return no matches (defaults now expressed via Commander API, not description strings)
