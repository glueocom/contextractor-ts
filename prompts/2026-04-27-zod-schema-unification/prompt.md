# Unify input handling on Zod 4

Collapse three drifting sources of truth (`apps/contextractor-apify/.actor/input_schema.json`, `apps/contextractor-apify/src/config.ts::ActorInput`, `apps/contextractor-standalone/src/cli.ts::CliOptions` + `apps/contextractor-standalone/src/config.ts::CrawlConfig`) into one Zod 4 schema, with `INPUT_SCHEMA.json` generated at build time. Keep Commander 12 in the standalone CLI — do not migrate the parser.

## Scope

In:

- New shared schema package
- Apify Actor input parsing rewired through Zod
- Standalone CLI input parsing rewired through Zod (Commander stays)
- Build-time generator for `INPUT_SCHEMA.json`
- Vitest tests for the generator
- Removal of dead code in both apps

Out:

- No changes to `packages/contextractor-engine/` runtime extraction API
- No changes to `dataset_schema.json` or `output_schema.json`
- No changes to the Rust napi-rs crate
- No parser swap (Commander stays in standalone; `Actor.getInput()` stays in Apify)
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

Required behaviour:

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
    | 'keyValue' | 'proxy' | 'fileupload' | 'hidden' | 'resourcePicker';
  prefill?: unknown;
  sectionCaption?: string;
  sectionDescription?: string;
  enumTitles?: string[];
  isSecret?: boolean;
  nullable?: boolean;
  unit?: string;
  resourceType?: 'dataset' | 'keyValueStore' | 'requestQueue';
  patternKey?: string;
  patternValue?: string;
  minProperties?: number;
  maxProperties?: number;
}

export function apifyMeta<T extends ApifyMeta>(meta: T): T { return meta; }
```

Document in a header comment that `title` and `description` belong on the Zod side (`.describe()`) and not in `apifyMeta(...)`.

## The generator (`src/to-apify-schema.ts`)

A pure function: `toApifyInputSchema(schema: z.ZodObject, opts: { title?: string; description?: string }): ApifyInputSchemaJSON`.

Steps:

1. Call `z.toJSONSchema(schema, { target: 'draft-07', io: 'input', unrepresentable: 'any', reused: 'inline' })`.
2. Strip JSON-Schema-only keywords Apify rejects: top-level `$schema`, `$id`, `$defs`. Walk the tree and remove every `$ref` by inlining (already handled by `reused: 'inline'` — verify on every property).
3. Reject any top-level `oneOf`/`anyOf`/`allOf` with a clear error (Apify dialect forbids them).
4. Build the output envelope:

   ```json
   {
     "title": "...",
     "description": "...",
     "type": "object",
     "schemaVersion": 1,
     "properties": { ... },
     "required": [ ... ]
   }
   ```

5. For every property, ensure an `editor` is present. If `apifyMeta` set one, keep it. Otherwise apply per-type defaults:

   | Zod / JSON-Schema type | Default `editor` |
   |---|---|
   | `string` | `textfield` |
   | `string` with `enum` | `select` |
   | `integer`, `number` | `number` |
   | `boolean` | `checkbox` |
   | `array`, `object` | `json` |

6. Copy `apifyMeta` keys (`prefill`, `sectionCaption`, `sectionDescription`, `enumTitles`, `isSecret`, `nullable`, `unit`, `resourceType`, `patternKey`, `patternValue`, `minProperties`, `maxProperties`) onto the property — Zod 4 already inlines these into the JSON Schema output, but verify and re-inline if not.
7. Preserve `default`, `minimum`, `maximum`, `enum`, `type`, `description`, `title`, `items`, `properties`, `required` — these are vanilla JSON Schema keywords Apify accepts.
8. Return the envelope. The function does no I/O.

Provide a thin `writeApifyInputSchema(schema, outPath, opts)` that calls `toApifyInputSchema` and writes to disk with `JSON.stringify(out, null, 2) + '\n'`.

## Tests (`test/to-apify-schema.test.ts`)

- Validate the generated output against `apify/apify-shared-js` `input.schema.json` using Ajv (`addFormats(ajv)`). Fetch the meta-schema once at test setup via `node:fs` from a vendored copy at `packages/contextractor-schema/test/fixtures/apify-input.schema.json` (commit it; do not fetch over the network at test time).
- Snapshot test: feed `ContextractorInput` to `toApifyInputSchema` and assert the result deep-equals the existing `apps/contextractor-apify/.actor/input_schema.json`. This is the regression boundary — any drift fails CI.
- Property-level assertions for at least:
  - `startUrls` has `editor: 'requestListSources'`, `prefill`, and is in `required`
  - `launcher` has `editor: 'select'`, `enum: ['CHROMIUM', 'FIREFOX']`, `enumTitles`, `default: 'CHROMIUM'`
  - `initialCookies` has `isSecret: true`
  - `proxyConfiguration` has `editor: 'proxy'`, `sectionCaption: 'Proxy'`
  - `trafilaturaConfig` has `editor: 'json'`, `sectionCaption: 'Content extraction'`
  - `closeCookieModals` has `default: true`
  - `maxScrollHeightPixels` has `unit: 'pixels'`, `minimum: 0`
- Negative test: a schema with a top-level `z.discriminatedUnion(...)` throws a clear error from `toApifyInputSchema`.

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
  2. Layer order: `defaultsFromSchema → loadConfigFile() → cliOverrides`. Implement layering by spreading objects, not by mutating.
  3. Run `ContextractorInput.parse(layered)` once. The result is the input object.
  4. Pass it to a renamed `buildCrawlConfig(input)` (steal the implementation from `apps/contextractor-apify/src/config.ts` — they should share). For now, duplicate `buildCrawlConfig` into `apps/contextractor-standalone/src/config.ts`; deduplicating into `@contextractor/schema` is Phase 2 (note in the file with a `// TODO(phase-2)` comment).
- `src/config.ts`: delete `defaultCrawlConfig`, `fromDict`, `normalizeKeys`, `toSnakeCase`, the `as*` coercion helpers, and `mergeOverrides` — Zod replaces all of them. Keep `loadConfigFile` (now returns `Partial<ContextractorInputType>`) and `validateSaveFormats`. Keep `CrawlConfig` and `SaveFormat` — those stay as the *internal* runtime config shape consumed by `runCrawl`.
- `src/cli.test.ts`: update tests for the surviving helpers; add a test that `ContextractorInput.parse({ startUrls: [{ url: 'https://e.com' }] })` produces the documented defaults.

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
import { resolve } from 'node:path';

const out = resolve(import.meta.dirname, '../../../apps/contextractor-apify/.actor/input_schema.json');
writeApifyInputSchema(ContextractorInput, out, {
  title: 'Contextractor',
  description: 'Crawls websites and extracts main-content text.',
});
console.log(`Wrote ${out}`);
```

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
3. `pnpm -r test` — must succeed; the snapshot test for `INPUT_SCHEMA.json` must pass without modification (i.e. the generated output equals the existing file byte-for-byte modulo trailing newline)
4. `pnpm -r lint` — Biome must be clean
5. `git diff apps/contextractor-apify/.actor/input_schema.json` — should be empty after running the generator
6. From `apps/contextractor-apify/`: `apify run` against a small test input succeeds end-to-end
7. From `apps/contextractor-standalone/`: `tsx src/cli.ts https://example.com --max-pages 1 --headless` succeeds end-to-end and produces output

## Acceptance criteria

- One Zod schema in `@contextractor/schema` is the only place input fields are declared
- `apps/contextractor-apify/.actor/input_schema.json` is generated, not hand-edited; the file content does not change as a side effect of this prompt
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
