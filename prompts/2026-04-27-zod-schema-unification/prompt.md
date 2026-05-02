# Unify input handling on Zod 4

Collapse three drifting sources of truth (`apps/contextractor-apify/.actor/input_schema.json`, `apps/contextractor-apify/src/config.ts::ActorInput`, `apps/contextractor-standalone/src/cli.ts::CliOptions` + `apps/contextractor-standalone/src/config.ts::CrawlConfig`) into one Zod 4 schema, with `INPUT_SCHEMA.json` generated at build time.

The stack is **Commander 12 + Zod 4**, both first-class. Commander parses argv (POSIX flags, `--help`, `--version`, subcommands). Zod 4 validates, coerces, defaults, and types the parsed result. The same Zod schema feeds `Actor.getInput()` validation in the Apify Actor and is the source of truth from which `INPUT_SCHEMA.json` is generated. This is the boundary pattern documented in `https://zod.dev/json-schema` and is the active idiom in 2026 TypeScript CLIs (Drizzle Kit, shadcn CLI, most Vercel-adjacent tools).

## Scope

In:

- New shared schema package (`@contextractor/schema`) defining `ContextractorInput` once in Zod 4
- Standalone CLI: Commander 12 parses argv → maps to a `Partial<ContextractorInputType>` → `ContextractorInput.parse()` validates and types it
- Apify Actor: `Actor.getInput()` raw JSON → `ContextractorInput.parse()` validates and types it (same schema, same call site shape)
- Build-time generator that emits `INPUT_SCHEMA.json` from the Zod schema
- Vitest tests for the generator (snapshot, Ajv meta-schema, determinism, trailing newline)
- Removal of the hand-rolled coercion machinery in both apps (`mergeOverrides`, `fromDict`, `normalizeKeys`, `as*` helpers, the `ActorInput` interface)

Out:

- No changes to `packages/contextractor-engine/` runtime extraction API
- No changes to `dataset_schema.json` or `output_schema.json`
- No changes to the Rust napi-rs crate
- No changes to `CrawlConfig` shape internal to `apps/contextractor-standalone/` (Phase 2 territory)

## Prerequisites — do these first

- Read `/Users/miroslavsekera/r/contextractor-ts/CLAUDE.md` for repo rules (no-confirmation-prompts, JSON-config-only, minimal-diff)
- Read `/Users/miroslavsekera/r/contextractor-ts/apps/contextractor-apify/.actor/input_schema.json` end-to-end — this is the target dialect to reproduce
- Read `/Users/miroslavsekera/r/contextractor-ts/apps/contextractor-apify/src/config.ts` and `/Users/miroslavsekera/r/contextractor-ts/apps/contextractor-standalone/src/cli.ts` to inventory every input field on both sides
- Read `https://docs.apify.com/platform/actors/development/actor-definition/input-schema/specification/v1` for the dialect spec
- Read `https://github.com/apify/apify-shared-js/blob/master/packages/json_schemas/schemas/input.schema.json` — this is the canonical Apify INPUT_SCHEMA meta-schema; the generator output must validate against it with Ajv
- Read `https://zod.dev/json-schema` for `z.toJSONSchema()` semantics, `.meta()`, `target`, `io`, `unrepresentable`, `reused`

## Package layout

Create a new workspace package `@contextractor/schema` at `/Users/miroslavsekera/r/contextractor-ts/packages/contextractor-schema/`:

```
packages/contextractor-schema/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # exports: ContextractorInput, ContextractorInputType, apifyMeta
│   ├── input.ts              # the Zod schema
│   ├── apify-meta.ts         # typed .meta() helper
│   └── to-apify-schema.ts    # the generator (Zod → INPUT_SCHEMA.json)
└── test/
    ├── input.test.ts
    └── to-apify-schema.test.ts
```

`package.json`:

- `"name": "@contextractor/schema"`
- `"private": true`, `"type": "module"`
- `"main": "./dist/index.js"`, `"types": "./dist/index.d.ts"`, `"exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } }`
- `"files": ["dist", "src"]`
- Scripts: `build`, `test`, `lint` matching the engine package
- `dependencies`: `zod` (latest 4.x — confirm exact version with `pnpm add zod` from the package dir)
- `devDependencies`: `ajv`, `ajv-formats` (for the meta-schema validation test), the standard biome/typescript/vitest/types versions used elsewhere in the workspace

Add the package to `pnpm-workspace.yaml` if the existing glob `packages/*` does not already pick it up — it does, no change needed; verify.

## The schema (`src/input.ts`)

Mirror every field currently in `apps/contextractor-apify/.actor/input_schema.json`. Field names, defaults, enums, descriptions, and titles must match exactly — this is a translation, not a redesign. Use `.describe()` for the human description and `.meta({...})` only for Apify-specific UI hints. Use `apifyMeta({...})` (defined in `apify-meta.ts`) instead of raw `.meta()` so the keys are type-checked.

Required behavior:

- `startUrls` is required and non-empty (`z.array(...).min(1)`); description and `editor: 'requestListSources'` and `prefill` come from the existing JSON
- All `editor: 'select'` enums use `SCREAMING_SNAKE_CASE` values (`CHROMIUM`, `FIREFOX`, `LOAD`, `DOMCONTENTLOADED`, `NETWORKIDLE`, `RECOMMENDED`, `PER_REQUEST`, `UNTIL_FAILURE`) — match the existing `input_schema.json`
- `enumTitles` carry over via `apifyMeta({ enumTitles: [...] })`
- `sectionCaption` carries over via `apifyMeta({ sectionCaption: '...' })`
- `isSecret: true` on `initialCookies` carries over
- `unit` (`results`, `seconds`, `pixels`) on integer fields carries over
- `minimum: 0` / `minimum: 1` constraints carry over via `.int().min(...)` on the Zod side
- `default: ...` carries over via `.default(...)` — use Zod defaults, not `apifyMeta({ default })`; the generator must surface the Zod default into the JSON Schema `default` keyword (Zod 4 does this when you use `io: 'input'`)
- `prefill` carries over via `apifyMeta({ prefill: ... })` since prefill is Apify-only and not a JSON Schema concept
- `proxyConfiguration` typing: `z.record(z.string(), z.unknown())` with `apifyMeta({ editor: 'proxy', sectionCaption: 'Proxy' })`. Do not try to model Apify's proxy object precisely — the editor handles it.
- `trafilaturaConfig` typing: `z.record(z.string(), z.unknown()).optional()` with `apifyMeta({ editor: 'json' })`. Description matches existing JSON.

Export `ContextractorInputType = z.infer<typeof ContextractorInput>`.

## The typed `.meta()` helper (`src/apify-meta.ts`)

Define `interface ApifyMeta` covering the Apify INPUT_SCHEMA dialect's UI-only keys:

```ts
interface ApifyMeta {
  editor?:
    | 'textfield' | 'textarea' | 'number' | 'checkbox' | 'select' | 'json'
    | 'datepicker' | 'requestListSources' | 'pseudoUrls' | 'globs'
    | 'keyValue' | 'stringList' | 'proxy' | 'fileupload' | 'hidden'
    | 'resourcePicker' | 'schemaBased' | 'javascript' | 'python';
  prefill?: unknown;
  sectionCaption?: string;
  sectionDescription?: string;
  groupCaption?: string;
  groupDescription?: string;
  enumTitles?: string[];
  enumSuggestedValues?: string[];
  isSecret?: boolean;
  nullable?: boolean;
  unit?: string;
  dateType?: string;
  resourceType?: 'dataset' | 'keyValueStore' | 'requestQueue';
  resourcePermissions?: string[];
  patternKey?: string;
  patternValue?: string;
  placeholderKey?: string;
  placeholderValue?: string;
  mcpServers?: unknown;
}

// `minProperties` / `maxProperties` are vanilla JSON Schema keywords (not Apify-only) — let Zod emit them via `.min()`/`.max()` on `z.record(...)` rather than going through `apifyMeta`.

export function apifyMeta<T extends ApifyMeta>(meta: T): T { return meta; }
```

Document in a header comment that `title` and `description` belong on the Zod side (`.describe()`) and not in `apifyMeta(...)`.

## The generator (`src/to-apify-schema.ts`)

A pure function: `toApifyInputSchema(schema: z.ZodObject, opts: { title?: string; description?: string }): ApifyInputSchemaJSON`.

Steps:

1. Call `z.toJSONSchema(schema, { target: 'draft-07', io: 'input', unrepresentable: 'any', reused: 'inline' })`. (`'draft-07'` — confirmed via `https://zod.dev/json-schema`; do not use `'draft-7'`.)
2. Strip top-level `$id` and `$defs` (the existing `INPUT_SCHEMA.json` does not include them; Apify's meta-schema permits top-level `$schema` but the existing file omits it, so strip that too for snapshot consistency). Walk the tree and remove every `$ref` by inlining (`reused: 'inline'` should already do this — verify on every property).
3. Reject any top-level `oneOf`/`anyOf`/`allOf` with a clear error. Apify's form editor cannot render top-level union/composition keywords; throwing prevents silent UI breakage. (`z.discriminatedUnion` emits `oneOf` and `z.union` emits `anyOf` — see `https://github.com/colinhacks/zod/issues/4089`.)
4. Build the output envelope:

   ```json
   {
     "title": "...",
     "type": "object",
     "schemaVersion": 1,
     "properties": { ... },
     "required": [ ... ]
   }
   ```

   Include `description` only when `opts.description` is provided; the existing `INPUT_SCHEMA.json` has no top-level `description`, so omit by default to keep the snapshot match.

5. For every property, ensure an `editor` is present. If `apifyMeta` set one, keep it. Otherwise apply per-type defaults:

   | Zod / JSON-Schema type | Default `editor` |
   |---|---|
   | `string` | `textfield` |
   | `string` with `enum` | `select` |
   | `integer`, `number` | `number` |
   | `boolean` | `checkbox` |
   | `array`, `object` | `json` |

6. Copy `apifyMeta` keys (`prefill`, `sectionCaption`, `sectionDescription`, `groupCaption`, `groupDescription`, `enumTitles`, `enumSuggestedValues`, `isSecret`, `nullable`, `unit`, `dateType`, `resourceType`, `resourcePermissions`, `patternKey`, `patternValue`, `placeholderKey`, `placeholderValue`, `mcpServers`) onto the property — Zod 4 already inlines `.meta()` keys into the JSON Schema output, but verify and re-inline if not.
7. Preserve `default`, `minimum`, `maximum`, `minLength`, `maxLength`, `minProperties`, `maxProperties`, `enum`, `type`, `description`, `title`, `items`, `properties`, `required` — these are vanilla JSON Schema keywords Apify accepts.
8. **Workaround Zod 4 issue #4134**: walk the top-level `required` array and remove any entry whose property in `properties` has a `default` keyword. Zod's `io: 'input'` still emits defaulted fields as required (`https://github.com/colinhacks/zod/issues/4134`, open as of v4.3.x). For this schema only `startUrls` should remain in `required` after the fix.
9. **Canonical key order** — to keep the snapshot test stable, rewrite each property object with keys in this fixed order, dropping absent keys: `sectionCaption`, `sectionDescription`, `groupCaption`, `groupDescription`, `title`, `type`, `description`, `editor`, `default`, `prefill`, `enum`, `enumTitles`, `enumSuggestedValues`, `minimum`, `maximum`, `unit`, `isSecret`, `nullable`, `resourceType`, `resourcePermissions`, `patternKey`, `patternValue`, `placeholderKey`, `placeholderValue`, `dateType`, `mcpServers`, `items`, `properties`, `required`. Apply the same idea to the envelope (`title`, `description?`, `type`, `schemaVersion`, `properties`, `required`).
10. Return the envelope. The function does no I/O.

Provide a thin `writeApifyInputSchema(schema, outPath, opts)` that calls `toApifyInputSchema` and writes to disk with `JSON.stringify(out, null, 2) + '\n'`.

`JSON.stringify(_, null, 2)` will reflow short single-line arrays/objects in the existing `INPUT_SCHEMA.json` (e.g. `"prefill": [{ "url": "..." }]` → multi-line). Treat the first generator run as the new committed baseline: regenerate, commit the reformatted file, and from then on the snapshot test guards against any further drift.

## Tests (`test/to-apify-schema.test.ts`)

- Validate the generated output against `apify/apify-shared-js` `input.schema.json` using Ajv (`addFormats(ajv)`). Fetch the meta-schema once at test setup via `node:fs` from a vendored copy at `packages/contextractor-schema/test/fixtures/apify-input.schema.json` (commit it; do not fetch over the network at test time).
- Snapshot test: feed `ContextractorInput` to `toApifyInputSchema` and assert the result deep-equals the on-disk `apps/contextractor-apify/.actor/input_schema.json` (the first-run reformatted baseline; see Verification step 5). This is the regression boundary — any drift fails CI.
- Property-level assertions for at least:
  - `startUrls` has `editor: 'requestListSources'`, `prefill`, and is in `required`
  - `launcher` has `editor: 'select'`, `enum: ['CHROMIUM', 'FIREFOX']`, `enumTitles`, `default: 'CHROMIUM'`
  - `initialCookies` has `isSecret: true`
  - `proxyConfiguration` has `editor: 'proxy'`, `sectionCaption: 'Proxy'`
  - `trafilaturaConfig` has `editor: 'json'`, `sectionCaption: 'Content extraction'`
  - `closeCookieModals` has `default: true`
  - `maxScrollHeightPixels` has `unit: 'pixels'`, `minimum: 0`
- Negative test: a schema with a top-level `z.discriminatedUnion(...)` throws a clear error from `toApifyInputSchema`.
- `required` fix: a schema with `z.string().default('x')` on a non-`startUrls` field must not appear in the output's `required` array (Zod 4 #4134 workaround verification).
- Determinism: calling `toApifyInputSchema(ContextractorInput, {...})` twice in a row produces deep-equal outputs and `JSON.stringify(_, null, 2)` of those outputs is byte-identical (key order is stable across runs).
- Trailing newline: `writeApifyInputSchema` output ends with exactly one `\n`.

## Tests (`test/input.test.ts`)

- `ContextractorInput.parse({ startUrls: [{ url: 'https://example.com' }] })` succeeds and fills defaults
- Empty `startUrls` array fails parsing
- Unknown enum values fail (`launcher: 'WEBKIT'`)
- `maxPagesPerCrawl: -1` fails (`min(0)`)
- A representative valid payload from the Apify run (stub it inline) round-trips: `parse(payload)` returns expected typed values

## Wire the Apify Actor

Edit `/Users/miroslavsekera/r/contextractor-ts/apps/contextractor-apify/`:

- `package.json`: add `"@contextractor/schema": "workspace:*"` to `dependencies`
- `src/main.ts`: replace `const input = ((await Actor.getInput<ActorInput>()) ?? {}) as ActorInput;` with:

  ```ts
  import { ContextractorInput } from '@contextractor/schema';
  const raw = (await Actor.getInput()) ?? {};
  const input = ContextractorInput.parse(raw);
  ```

  On parse failure, log the Zod error tree via `log.error` and `await Actor.exit({ exitCode: 1 })`.
- `src/config.ts`: delete the local `ActorInput` interface. Replace every `ActorInput` reference (function signatures, return types) with `ContextractorInputType` imported from `@contextractor/schema`. The `buildCrawlConfig`, `buildBrowserLaunchOptions`, `buildBrowserContextOptions` function bodies stay — only the input type changes. Many `?? defaultValue` fallbacks become unreachable now that defaults live in the Zod schema; remove them or simplify (`input.headless ?? true` → `input.headless`) only where the schema guarantees a value.

## Wire the standalone CLI

Edit `/Users/miroslavsekera/r/contextractor-ts/apps/contextractor-standalone/`:

- `package.json`: add `"@contextractor/schema": "workspace:*"` to `dependencies`
- `src/cli.ts`: keep every `program.option(...)` line. Replace the entire `if (opts.X !== undefined) overrides.X = opts.X` block plus the trailing `mergeOverrides(cfg, overrides)` call with a single mapping step:

  1. Map Commander flag names to schema field names (`--max-pages` → `maxPagesPerCrawl`, etc.). Build a `Partial<ContextractorInputType>` object.
  2. **Case conversion**: `--launcher`, `--wait-until`, `--proxy-rotation` accept user-friendly lowercase values (`chromium`, `load`, `recommended`) and the existing CLI lowercases them at line 78-79 of `cli.ts`. The Zod schema is `SCREAMING_SNAKE_CASE`, so the new mapping must `.toUpperCase()` (and `.replace(/-/g, '_')` for `--proxy-rotation`) before handing the value to `parse()`. Update the `--proxy-rotation` `program.option(...)` description to keep the lowercase user-facing form consistent.
  3. **CLI-only flags stay outside the schema**: `--config`, `--start-url`, `--format`, `--output-dir`, `--save` (with its `jsonl`/`all` extras), `--verbose`, `--precision`, `--recall`, `--fast`, `--include-tables`/`--no-tables`, `--include-images`, `--include-formatting`/`--no-formatting`, `--deduplicate`, `--target-language`, `--with-metadata`/`--no-metadata`, `--no-links`, `--no-comments`. Trafilatura toggles fold into the `trafilaturaConfig` blob fed to `parse()`; orchestration flags (`--config`, `--verbose`, `--save`, `--output-dir`, etc.) feed `CrawlConfig` *after* `parse()` returns.
  4. Layer order: `loadConfigFile() → cliOverrides → ContextractorInput.parse(layered)`. Defaults come from the Zod schema itself (no separate `defaultsFromSchema` layer); spread, do not mutate.
  5. Run `ContextractorInput.parse(layered)` once. The result is the input object.
  6. Pass it to a renamed `buildCrawlConfig(input)` (steal the implementation from `apps/contextractor-apify/src/config.ts` — they should share). For now, duplicate `buildCrawlConfig` into `apps/contextractor-standalone/src/config.ts`; deduplicating into `@contextractor/schema` is Phase 2 (note in the file with a `// TODO(phase-2)` comment). The two existing `buildCrawlConfig` implementations are **not** identical — the standalone variant must additionally project the CLI-only orchestration flags onto `CrawlConfig` (`urls`, `outputDir`, `save`, etc.) before returning.
- `src/config.ts`: delete `defaultCrawlConfig`, `fromDict`, `normalizeKeys`, `toSnakeCase`, the `as*` coercion helpers, and `mergeOverrides` — Zod replaces all of them. Keep `loadConfigFile` (now returns `Partial<ContextractorInputType>`; **breaking change** — the legacy snake_case shape and the nested `proxy: { urls, rotation }` block are no longer accepted, only the Apify-input camelCase shape is) and `validateSaveFormats`. Keep `CrawlConfig` and `SaveFormat` — those stay as the *internal* runtime config shape consumed by `runCrawl`. The optional `yaml` loader stays per `.claude/rules/json-config-only.md` (silent backwards-compat); only the post-load `fromDict` translation is removed.
- `src/cli.test.ts`: update tests for the surviving helpers; add a test that `ContextractorInput.parse({ startUrls: [{ url: 'https://e.com' }] })` produces the documented defaults. The existing `defaultCrawlConfig` assertions need rewriting — that helper is gone; assert against the parsed-and-projected `CrawlConfig` returned by `buildCrawlConfig(ContextractorInput.parse({ startUrls: [...] }))` instead.

## Wire the build-time generator

Create `/Users/miroslavsekera/r/contextractor-ts/tools/gen-input-schema/`:

```
tools/gen-input-schema/
├── package.json
├── tsconfig.json
└── src/
    └── main.ts
```

`main.ts`:

```ts
import { writeApifyInputSchema, ContextractorInput } from '@contextractor/schema';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve repo root by walking up from this file. In `src/main.ts` (run via
// tsx) `here` is `tools/gen-input-schema/src`; in `dist/main.js` (run via
// node) it is `tools/gen-input-schema/dist`. Either way, three levels up
// lands on the repo root, so the script works from any cwd, including under
// `pnpm -F @contextractor/gen-input-schema start` which cd's into the package.
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const out = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(repoRoot, 'apps/contextractor-apify/.actor/input_schema.json');

writeApifyInputSchema(ContextractorInput, out, { title: 'Contextractor' });
console.log(`Wrote ${out}`);
```

Do not pass `description` — the existing `INPUT_SCHEMA.json` has no top-level description and the snapshot test will reject any addition. The optional `process.argv[2]` override exists for ad-hoc generation into a test fixture; the Apify build pipeline relies on the default repo-root path.

`package.json`:

- `"name": "@contextractor/gen-input-schema"`, `"private": true`, `"type": "module"`
- `"bin": { "gen-input-schema": "dist/main.js" }`
- `"scripts": { "build": "tsc -p tsconfig.json", "start": "tsx src/main.ts" }`
- `dependencies`: `@contextractor/schema: workspace:*`
- `devDependencies`: `tsx`, `typescript`, `@types/node`

Wire it into the Apify Actor build pipeline: in `apps/contextractor-apify/package.json`, change `"build": "tsc -p tsconfig.json"` to `"build": "pnpm -F @contextractor/gen-input-schema start && tsc -p tsconfig.json"`. The generator runs first; the snapshot test in `@contextractor/schema` guarantees no drift.

## Verification

Run from the repo root, in order:

1. `pnpm install`
2. `pnpm -r build` — must succeed
3. `pnpm -r test` — must succeed; the snapshot test for `INPUT_SCHEMA.json` deep-equals the on-disk file (after the one-time first-run reformat is committed). After step 5 below, subsequent runs must produce zero diff.
4. `pnpm -r lint` — Biome must be clean
5. `git diff apps/contextractor-apify/.actor/input_schema.json` — on the very first run this will show cosmetic JSON re-flow (multi-line short arrays/objects) and any field-order normalization from step 9 of the generator. Inspect the diff to confirm it is purely formatting / key-order, then commit the reformatted file as the new baseline. From the second run onward this diff must be empty.
6. From `apps/contextractor-apify/`: `apify run` against a small test input succeeds end-to-end
7. From `apps/contextractor-standalone/`: `tsx src/cli.ts https://example.com --max-pages 1 --headless` succeeds end-to-end and produces output

## Acceptance criteria

- One Zod schema in `@contextractor/schema` is the only place input fields are declared
- `apps/contextractor-apify/.actor/input_schema.json` is generated, not hand-edited; the file is semantically equivalent to today's content (every field, default, enum, description, editor, and Apify-specific key preserved). Cosmetic differences from `JSON.stringify(_, null, 2)` reflow and the canonical key-order step are accepted and committed as the new baseline; no semantic field added or removed.
- `Actor.getInput()` and Commander both feed `ContextractorInput.parse(...)` and produce identical typed outputs for equivalent inputs
- `ActorInput` interface and `mergeOverrides`/`fromDict`/`normalizeKeys` are deleted
- Generator output validates against the canonical Apify INPUT_SCHEMA meta-schema (Ajv test passes)
- All existing Vitest tests continue to pass; new tests cover the generator and the schema
- No new runtime dependency on `zod-to-json-schema` (Zod 4's native `z.toJSONSchema()` only)

## Out of scope — note for the operator, do not implement

- Phase 2: derive the standalone CLI's internal `CrawlConfig` shape from `ContextractorInputType` by transformation, removing the duplicated `buildCrawlConfig`
- Phase 3: publish `@contextractor/schema`'s `to-apify-schema.ts` as a standalone npm package `zod-to-apify-input-schema`
- MCP tool registration that consumes the same schema (trivial follow-up; not needed for this prompt)

## Constraints

- Minimal diff per `.claude/rules/minimal-diff.md` — do not reformat untouched files
- JSON config only per `.claude/rules/json-config-only.md` — no YAML examples in any new file
- No confirmation prompts per `.claude/rules/no-confirmation-prompts.md` — execute end to end
- All enumeration values in schemas are `SCREAMING_SNAKE_CASE`
- Absolute paths only when referring to files outside the package being edited
- Do not modify the Rust crate, `dataset_schema.json`, `output_schema.json`, or anything under `packages/contextractor-engine/`

## Review notes

Reviewed 2026-04-27. Verified Zod 4 API claims against `https://zod.dev/json-schema` and the Apify INPUT_SCHEMA dialect against `apify/apify-shared-js` `packages/json_schemas/schemas/input.schema.json`. Material edits:

- `ApifyMeta` interface: added editor values `stringList`, `schemaBased`, `javascript`, `python` (missing from the original list per the meta-schema). Added keys `groupCaption`, `groupDescription`, `enumSuggestedValues`, `dateType`, `resourcePermissions`, `placeholderKey`, `placeholderValue`, `mcpServers`. Removed `minProperties`/`maxProperties` from `ApifyMeta` — they are vanilla JSON Schema keywords (`z.record(...).min(...)` emits them natively).
- Generator algorithm: corrected step 2 — Apify's meta-schema permits top-level `$schema`; only `$id`/`$defs` are non-standard. Softened step 3 wording — top-level `oneOf`/`anyOf`/`allOf` is rejected because Apify's form editor cannot render them, not because the spec explicitly forbids them. Added step 8 — workaround for the open Zod 4 bug `colinhacks/zod#4134` where `io: 'input'` still emits defaulted fields in `required`; the generator must drop them. Added step 9 — canonical property and envelope key ordering, required for the snapshot test to be stable. Renumbered the original "return the envelope" to step 10.
- Envelope JSON: `description` is now optional and omitted unless `opts.description` is provided. The existing `INPUT_SCHEMA.json` has no top-level `description`, so the generator must not emit one by default.
- `tools/gen-input-schema/src/main.ts`: replaced the hard-coded `import.meta.dirname`-relative path (which lands one level off when invoked via `tsx src/main.ts` vs `node dist/main.js`) with a `fileURLToPath(import.meta.url)` walk-up that resolves the repo root from either `src/` or `dist/` (both are exactly three levels deep from the repo root). Optional `process.argv[2]` override for ad-hoc test fixtures. Dropped the top-level `description` argument so the snapshot matches the existing file.
- Snapshot expectations: relaxed "byte-for-byte equal to existing file" to "semantically equivalent + first-run reformat (single-line short arrays/objects → multi-line, canonical key order) committed as the new baseline". `JSON.stringify(_, null, 2)` cannot round-trip the existing single-line `prefill` arrays without reflow.
- Standalone CLI mapping: documented the SCREAMING_SNAKE_CASE direction flip (`launcher`, `waitUntil`, `proxyRotation` — the existing `cli.ts` lowercases these; the new mapping must `.toUpperCase()` going into `parse()`). Enumerated the CLI-only flags that bypass `ContextractorInput` and feed `CrawlConfig` directly post-parse. Flagged that the standalone `buildCrawlConfig` is not identical to the Apify one — it must additionally project orchestration flags (`urls`, `outputDir`, `save`) onto `CrawlConfig`. Flagged the breaking change to `loadConfigFile` (legacy snake_case + nested `proxy.urls` shapes no longer accepted).
- Tests: added coverage for the `required` workaround, generator determinism, and trailing-newline behavior.

Stack is settled at Commander 12 + Zod 4 — both are first-class chosen libraries, not a transitional state. Out-of-scope items left untouched: `CrawlConfig` Phase 2 deduplication, MCP wiring, `zod-to-apify-input-schema` npm publish. Reviewer confirmed `@modelcontextprotocol/sdk` already accepts Zod schemas via Standard Schema (issue `modelcontextprotocol/typescript-sdk#164`), so the Phase-3 follow-up remains a small wiring exercise — current edits do not make it harder.

**Reframing edit (2026-04-27, second pass)**: removed the earlier "do not migrate the parser" framing and reframed Commander 12 + Zod 4 as the active chosen stack. The body of the prompt was already correctly written for this — it describes Commander parsing argv into objects that flow into `ContextractorInput.parse()`, which is the boundary pattern. Only the opening paragraph, the Scope→In/Out lines, and this notes section needed to drop the "Commander stays" / "no parser swap" framing. No algorithm, schema, test, or wiring change in this pass.
