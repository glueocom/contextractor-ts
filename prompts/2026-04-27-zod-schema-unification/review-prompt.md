# Review and fix the implementation prompt

Review and edit `/Users/miroslavsekera/r/contextractor-ts/prompts/2026-04-27-zod-schema-unification/prompt.md` for technical correctness, completeness, and fit with this codebase. Apply fixes inline. Do not rewrite the prompt wholesale — minimal-diff edits only.

## Context — why this prompt exists

The prompt unifies three drifting sources of truth into one Zod 4 schema:

1. `apps/contextractor-apify/.actor/input_schema.json` — 200+ lines, hand-maintained
2. `apps/contextractor-apify/src/config.ts::ActorInput` — hand-typed interface, parallel to (1)
3. `apps/contextractor-standalone/src/cli.ts::CliOptions` + `apps/contextractor-standalone/src/config.ts::CrawlConfig` — Commander flags + a parallel `CrawlConfig` shape with hand-rolled `mergeOverrides`/`fromDict`/`normalizeKeys`/`as*` coercion (~150 lines of shovelware)

The CLI uses `commander@^12.1.0`. The Actor uses `Actor.getInput()` only — no argv parser. The repo `CLAUDE.md` Security section already says *"zod schema in TypeScript"* but **no Zod is currently in any TypeScript file in this repo** — adopting it executes a documented rule, not a new one.

The unifying choice is **commander 12 (kept) + Zod 4 (new) + a build-time generator** that emits `INPUT_SCHEMA.json` from the Zod schema. Do not propose migrating Commander to citty/gunshi/oclif/yargs — that was explicitly considered and rejected for this codebase (sunk cost is small but real, Crawlee itself uses yargs internally so commander is no more "off-ecosystem" than citty would be, and the leverage is in the schema layer, not the parser).

## Repo facts the prompt must honor

- pnpm 10 workspaces, Node ≥22, TypeScript 5.9, Biome 2, Vitest 2, ESM-only across the workspace
- Workspace: `apps/*`, `packages/*`, `packages/*/native`, `packages/*/native/npm/*`, `tools/*` (per `pnpm-workspace.yaml`)
- Existing packages: `@contextractor/engine`, `@contextractor/engine-native`, `@contextractor/apify`, `@contextractor/standalone`
- `tools/` already exists with `platform-test-runner/` and `generated-unit-tests/` — `tools/gen-input-schema/` is a new sibling
- The only Rust crate is `packages/contextractor-engine/native/` (napi-rs) — out of scope for this prompt
- The Apify Actor's Dockerfile uses `dockerContextDir: "../../.."` (repo root) so any new workspace package is automatically visible to the build
- Production protection: `.actor/actor.json` `name` is `contextractor-test`, not `contextractor` — do not let the prompt's edits change this

## Repo rules the prompt must honor

`.claude/rules/`:
- `no-confirmation-prompts.md` — execute end-to-end, never ask "shall I proceed?"
- `json-config-only.md` — JSON for all config files in docs/help/examples; never YAML
- `minimal-diff.md` — Edit (not Write) on existing files; preserve formatting and unchanged content
- `formatting-guidelines.md` — markdown headers (not bold), bullets (not numbered)

Schema convention: **all enumeration values in schemas are `SCREAMING_SNAKE_CASE`** (`CHROMIUM`, `FIREFOX`, `LOAD`, `DOMCONTENTLOADED`, `NETWORKIDLE`, `RECOMMENDED`, `PER_REQUEST`, `UNTIL_FAILURE`).

## What to verify in the prompt

### Zod 4 API correctness

- `z.toJSONSchema(schema, opts)` is a Zod 4 native API — confirm the prompt does not import the deprecated `zod-to-json-schema` package (Stefan Terdell deprecated it in November 2025; Zod 4 ships native JSON Schema export)
- Options used must exist in Zod 4: `target: 'draft-07' | 'draft-2020-12' | 'openapi-3.0'`, `io: 'input' | 'output'`, `unrepresentable: 'any' | 'throw'`, `reused: 'inline' | 'ref'`
- `.meta({...})` exists on every Zod type and metadata propagates verbatim into JSON Schema output
- `.describe()` populates JSON Schema `description`; `title` comes via `.meta({ title })` (verify against current Zod 4 docs and adjust the prompt if the title path differs)
- `z.url()`, `z.coerce.number().int().min(...)`, `z.enum([...]).default(...)`, `z.array(...).min(1)`, `z.record(z.string(), z.unknown())` — all valid Zod 4 idioms; flag any that aren't
- `z.discriminatedUnion(...)` is the API surface to flag in the negative test (top-level `oneOf` is forbidden by Apify dialect)
- Reference: `https://zod.dev/json-schema` and `https://zod.dev/v4`

### Apify INPUT_SCHEMA dialect correctness

- The dialect is **not vanilla JSON Schema**. Apify docs explicitly warn: *"we cannot guarantee that JSON schema tooling will work on input schema documents."*
- Top-level shape is fixed: `{ title, description, type: "object", schemaVersion: 1, properties, required }` — verify the prompt's envelope matches
- `editor` is effectively required on every property; the prompt's per-type defaults table must match what the existing `input_schema.json` actually uses. Cross-check: `string` → `textfield`, `string` with `enum` → `select`, `integer`/`number` → `number`, `boolean` → `checkbox`, `array`/`object` → `json`. Special editors used in the existing file: `requestListSources`, `globs`, `pseudoUrls`, `proxy`, `select`, `json`, `textfield` — confirm all are covered
- Apify-only keys to preserve via `apifyMeta`: `prefill`, `sectionCaption`, `sectionDescription`, `enumTitles`, `isSecret`, `nullable`, `unit`, `resourceType`, `patternKey`, `patternValue`, `minProperties`, `maxProperties` — flag missing ones
- Apify rejects top-level `oneOf`/`anyOf`/`allOf` — generator must throw on these
- `Actor.getInput()` does **not** apply `INPUT_SCHEMA.json` defaults locally on the platform (open issue `apify/apify-sdk-js#287`); only `apify run` materializes them into `INPUT.json`. Therefore the prompt's `ContextractorInput.parse(...)` must run on platform input as well as local input, and Zod defaults must be the source of truth — verify the prompt enforces this and does not accidentally rely on platform-side defaulting
- References:
  - Spec: `https://docs.apify.com/platform/actors/development/actor-definition/input-schema/specification/v1`
  - Overview: `https://docs.apify.com/platform/actors/development/actor-definition/input-schema`
  - Secret input: `https://docs.apify.com/platform/actors/development/actor-definition/input-schema/secret-input`
  - Canonical meta-schema: `https://github.com/apify/apify-shared-js/blob/master/packages/json_schemas/schemas/input.schema.json` — vendor a copy at `packages/contextractor-schema/test/fixtures/apify-input.schema.json` and validate generator output against it with Ajv (do not fetch over network at test time)
  - SDK reference: `https://docs.apify.com/sdk/js/reference/class/Actor`

### Field-by-field translation correctness

The prompt promises the generator's output equals the existing `apps/contextractor-apify/.actor/input_schema.json` byte-for-byte (modulo trailing newline). Read both end-to-end and verify the field inventory in the prompt would actually produce that. Specifically check:

- `startUrls` (required, `editor: 'requestListSources'`, `prefill`)
- `globs`, `excludes` (`editor: 'globs'`, `default: []`)
- `pseudoUrls` (`editor: 'pseudoUrls'`, `default: []`)
- `linkSelector` (`editor: 'textfield'`, `default: ""`)
- `keepUrlFragments`, `respectRobotsTxtFile` (booleans with defaults)
- `initialCookies` (`editor: 'json'`, `prefill: []`, `isSecret: true`)
- `customHttpHeaders` (`editor: 'json'`, `prefill: {}`)
- `maxPagesPerCrawl`, `maxResultsPerCrawl`, `maxCrawlingDepth`, `maxConcurrency`, `maxRequestRetries` (integers, `minimum`, some with `unit`)
- `trafilaturaConfig` (`editor: 'json'`, `sectionCaption: 'Content extraction'`)
- `saveRawHtmlToKeyValueStore`, `saveExtractedTextToKeyValueStore`, `saveExtractedJsonToKeyValueStore`, `saveExtractedMarkdownToKeyValueStore` (booleans, `sectionCaption: 'Output settings'` on the first; `saveExtractedMarkdownToKeyValueStore` defaults to `true`, others `false`)
- `datasetName`, `keyValueStoreName`, `requestQueueName` (`editor: 'textfield'`)
- `proxyConfiguration` (`editor: 'proxy'`, `sectionCaption: 'Proxy'`)
- `proxyRotation` (`editor: 'select'`, `enum: ['RECOMMENDED','PER_REQUEST','UNTIL_FAILURE']`, `enumTitles`, default `RECOMMENDED`)
- `pageLoadTimeoutSecs` (`sectionCaption: 'Browser'`, `unit: 'seconds'`)
- `waitUntil` (`editor: 'select'`, `enum: ['NETWORKIDLE','LOAD','DOMCONTENTLOADED']`, `enumTitles`, default `LOAD`)
- `launcher` (`editor: 'select'`, `enum: ['CHROMIUM','FIREFOX']`, `enumTitles`, default `CHROMIUM`)
- `headless`, `ignoreCorsAndCsp`, `closeCookieModals`, `ignoreSslErrors` (booleans)
- `maxScrollHeightPixels` (`unit: 'pixels'`, `minimum: 0`, default `5000`)
- `userAgent` (`editor: 'textfield'`, default `""`)
- `debugLog` (`sectionCaption: 'Diagnostics'`)
- `browserLog`

If the prompt's schema would introduce or omit a field versus the existing JSON, fix the prompt — the snapshot test is the regression boundary and must pass on first run without modifying the existing `input_schema.json`.

### Standalone CLI translation correctness

The prompt rewires `apps/contextractor-standalone/` to feed `ContextractorInput.parse()`. Verify the Commander flag → schema field mapping is sound. The CLI exposes flags the Apify schema does not (`--save jsonl`, `--max-results`, `--config`, `--start-url`, `--format`, `--proxy-urls`, `--proxy-rotation`, `--page-load-timeout`, `--ignore-cors`, `--include-tables`/`--no-tables`, `--include-images`, `--include-formatting`/`--no-formatting`, `--deduplicate`, `--target-language`, `--with-metadata`/`--no-metadata`, `--precision`, `--recall`, `--fast`, `--verbose`). The schema is the Apify-shaped surface, so:

- Flags that map 1:1 to Apify fields (`--max-pages` → `maxPagesPerCrawl`, `--max-concurrency` → `maxConcurrency`, etc.) flow through `ContextractorInput.parse()`
- Flags that are CLI-only (`--config`, `--verbose`, `--precision`, `--recall`, `--fast`, save-format flags, trafilatura toggles) either (a) feed `trafilaturaConfig` (an `editor: 'json'` blob in the schema) or (b) stay outside the schema as orchestration flags consumed before/after `parse()`
- The prompt currently says "duplicate `buildCrawlConfig` into `apps/contextractor-standalone/src/config.ts`" with a `// TODO(phase-2)` — verify this is realistic given the standalone-only flags. The two existing `buildCrawlConfig` implementations are **not** identical; flag this if the prompt understates it
- `validateSaveFormats` and `loadConfigFile` are explicitly kept; verify they're still callable after the rewrite

### Build pipeline correctness

- The prompt rewires `apps/contextractor-apify/package.json` `build` to `pnpm -F @contextractor/gen-input-schema start && tsc -p tsconfig.json` — verify this works inside the Apify Docker build given `dockerContextDir: "../../.."`. The Dockerfile installs from the repo root, so `@contextractor/gen-input-schema` and `@contextractor/schema` are present. Confirm the prompt's build script does not break `apify run` or production Git-connected builds
- Generator must run before `tsc` so the Actor's compiled output is consistent with the freshly-generated `INPUT_SCHEMA.json`
- The snapshot test in `@contextractor/schema` runs under `pnpm -r test` and gates drift in CI — verify
- Root `package.json` scripts (`pnpm -r build`, `pnpm -r test`, `pnpm -r lint`) must continue to work without root-level changes

### Test coverage gaps

Add to the prompt if missing:

- A test that `ContextractorInput.parse(<sample valid Apify INPUT.json>)` round-trips with no surprises — use a real-world payload, not just the minimum-required object
- A test that boolean fields with `default: false` and `default: true` survive both `io: 'input'` JSON Schema generation and parse-time defaulting
- A test that integer fields preserve `minimum` constraints in the generated JSON Schema (`maxConcurrency` has `minimum: 1`, several others have `minimum: 0`)
- A test that the generator's output trailing-newline behavior matches the existing file (the existing file ends with `\n` after the closing brace)
- A test that the generator is deterministic (same input → byte-identical output across runs; key ordering matters for the snapshot test)

### MIT/Apache-2.0 license check

Both Zod (MIT) and Ajv (MIT) are MIT-licensed — verify the prompt does not introduce any non-MIT/non-Apache-2.0 dependencies (the user has a strong MIT preference per `userMemories`).

### Things the prompt should NOT do

- Should not propose migrating Commander to another parser
- Should not propose changes to `dataset_schema.json`, `output_schema.json`, the napi-rs crate, or `packages/contextractor-engine/`
- Should not propose `zod-to-json-schema` (deprecated November 2025) — only Zod 4's native `z.toJSONSchema()`
- Should not propose YAML examples anywhere
- Should not propose modifying `actor.json` `name` (production protection)
- Should not silently introduce defaults that change Apify Actor runtime behavior — every default in the Zod schema must match the existing `INPUT_SCHEMA.json` default exactly

## Strategic context (for your judgement, not for inclusion in the prompt)

This work fits a larger pattern: **JSON Schema has become the universal IDL for both CLI tools and LLM agent tools** (OpenAI function calling `parameters`, Anthropic tool use `input_schema`, MCP `inputSchema`/`outputSchema`, Gemini OpenAPI subset). MCP was donated to the Linux Foundation in December 2025; the official `@modelcontextprotocol/sdk` accepts Zod schemas directly via Standard Schema. So the same `ContextractorInput` schema becomes an MCP tool input with three lines of glue — the user's Phase 3 publish target (`zod-to-apify-input-schema` on npm, no such package exists in April 2026) plugs a confirmed ecosystem gap. **Do not expand the prompt's scope to include MCP wiring or the npm publish** — those are explicit Phase-2/3 deferrals. But if the prompt as written would make those follow-ups harder, flag it.

References for context:
- Standard Schema spec: `https://github.com/standard-schema/standard-schema`
- MCP TypeScript SDK: `https://github.com/modelcontextprotocol/typescript-sdk`
- `z.toJSONSchema` reference: `https://zod.dev/json-schema`
- Apify SDK input issue: `https://github.com/apify/apify-sdk-js/issues/287`
- Apify CLI input issue: `https://github.com/apify/apify-cli/issues/586`
- Crawlee config (no argv at runtime, env-vars only): `https://github.com/apify/crawlee/blob/master/packages/core/src/configuration.ts`
- Apify input schema canonical meta-schema: `https://github.com/apify/apify-shared-js/blob/master/packages/json_schemas/schemas/input.schema.json`

## Review method

1. Read the prompt end-to-end once for shape and intent
2. Read `apps/contextractor-apify/.actor/input_schema.json`, `apps/contextractor-apify/src/config.ts`, `apps/contextractor-apify/src/main.ts`, `apps/contextractor-standalone/src/cli.ts`, `apps/contextractor-standalone/src/config.ts`, `pnpm-workspace.yaml`, root `package.json`, and `CLAUDE.md`
3. Walk every checklist item above against the prompt — flag, don't accept on faith
4. Use the `web-research-specialist` agent if Zod 4 API surface, Apify dialect specifics, or `@modelcontextprotocol/sdk` Standard Schema acceptance need verification
5. Apply minimal-diff edits to the prompt where issues are found
6. Append a short "Review notes" section at the bottom of the prompt summarizing what was changed and why; if nothing material changed, write "Reviewed YYYY-MM-DD: no changes required, prompt accurate."

## Constraints on the review itself

- Edit `prompt.md` in place — do not move, rename, or split it
- Minimal diff per `.claude/rules/minimal-diff.md`; preserve unchanged sections verbatim
- Do not expand scope (MCP wiring, npm publish, parser swap, `CrawlConfig` Phase-2 deduplication) — keep deferrals explicit
- Use absolute paths when referring to files outside `packages/contextractor-schema/`
- All schema enums remain `SCREAMING_SNAKE_CASE`
- JSON config examples only; no YAML
- No confirmation prompts during execution
