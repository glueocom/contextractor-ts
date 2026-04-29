---
description: Verify internal consistency of contextractor config across the TS engine, the napi-rs binding, the standalone CLI, and Apify schemas.
allowed-tools: Bash(*), Read(*), Edit(*), Write(*), Glob(*), Grep(*)
---

# Verify Package Consistency

Verify that the contextractor internals agree across **four** surfaces: the TypeScript engine API, the napi-rs binding (Rust), the standalone CLI flags, and the Apify Actor schemas. Auto-fix conservatively where the canonical source is unambiguous; surface anything ambiguous for human review.

The **`@contextractor/schema` Zod 4 schema** is canonical for every input field — CLI flags, Apify INPUT_SCHEMA fields, the `ContextractorInputType` interface, and enum values. The **TypeScript engine API** (`@contextractor/engine`'s `TrafilaturaConfig`) is canonical for the extraction internals — the napi-rs binding follows it. The standalone CLI and the Apify Actor are projections of these two canonical sources.

## Scope

This command only verifies and fixes files inside `/Users/miroslavsekera/r/contextractor-ts/`. It is internal-consistency only — no cross-repo sync.

## Step READ: Read Current State from Source

Read every file below before making any change:

- **Input schema (canonical for input fields)** — `packages/schema/src/input.ts` (the `ContextractorInput` Zod schema with every field's type, `.default(...)`, `.describe(...)`, and `apifyMeta(...)`). Capture every field, default, and enum.
- **TS engine (canonical for extraction internals)** — `packages/contextractor-engine/src/index.ts` (the `TrafilaturaConfig` interface, `ContentExtractor` class, `OutputFormat` union, `DEFAULT_CONFIG`). Capture every field with type and default.
- **napi-rs binding** — `packages/contextractor-engine/native/src/lib.rs`. Capture every `#[napi(object)]` field and the function signatures.
- **Standalone CLI** — `apps/standalone/src/cli.ts` (`buildProgram()` exports the configured Commander program; the generator imports it). Plus `apps/standalone/src/config.ts` for `CrawlConfig` and `loadConfigFile`.
- **Apify schemas** —
  - `apps/apify-actor/.actor/input_schema.json` — generated from `packages/schema/src/input.ts` by `@contextractor/gen-input-schema`; never hand-edit
  - `apps/apify-actor/.actor/output_schema.json`
  - `apps/apify-actor/.actor/dataset_schema.json`
  - `apps/apify-actor/.actor/actor.json`
- **Apify Actor TS** — `apps/apify-actor/src/{main.ts, handler.ts, extraction.ts, config.ts}` (consumes `ContextractorInput.parse()` and `@contextractor/engine`).

## Step VERIFY: Cross-Check Internal Consistency

Run each check below. The Zod schema is canonical for input fields; the TS engine is canonical for extraction internals.

- **Zod schema ⇄ generated `INPUT_SCHEMA.json`** — the `@contextractor/schema` snapshot test (`packages/schema/test/to-apify-schema.test.ts`) guards zero diff between `toApifyInputSchema(ContextractorInput)` and `apps/apify-actor/.actor/input_schema.json`. Run it via `pnpm --filter @contextractor/schema test`. If it fails, regenerate via `pnpm --filter @contextractor/gen-input-schema start` and commit the result; never hand-edit the JSON.
- **Zod schema ⇄ Commander program** — every `ContextractorInput` field is reachable as a flag (kebab-case `--max-pages` ↔ camelCase `maxPagesPerCrawl`) or as a JSON config key (camelCase). The standalone CLI also exposes the documented CLI-only orchestration flags (`--config`, `--output-dir`, `--save`, `--start-url`, `--format`, `--proxy-urls`, `--verbose`, plus `trafilaturaConfig` shorthands like `--precision`, `--recall`, `--fast`, `--no-links`, `--no-comments`, etc.).
- **`npm run docs:check` passes** — running `npm run docs:update` followed by `git diff --exit-code -- '**/*.md'` must be clean. Drift here means a marker region was hand-edited and the rebuild reverted the change; pull the relevant fact into the canonical source instead.
- **TS engine ⇄ napi-rs binding** — every `TrafilaturaConfig` field has a matching `#[napi(object)]` field. Names compare in camelCase (napi-rs auto-converts snake_case → camelCase in generated `.d.ts`). Function signatures match (`extract`, `extractMetadata`, `extractAllFormats`).
- **Default values** — defaults agree across `DEFAULT_CONFIG` (TS engine), `Default` impl on the napi-rs struct (Rust), the Zod schema's `.default(...)` calls (input), and the generated `default` property in `input_schema.json`.
- **OutputFormat union** — the TS `OutputFormat` union, the napi-rs string enum, and `FORMAT_EXTENSIONS` in the CLI must all be exactly `txt | markdown | json | html`. Any reappearance of `xml` or `xmltei` is a regression.
- **No-op fields** — `pruneXpath` and `dateExtractionParams` are dropped (no rs-trafilatura 0.2.x backing). Flag any reappearance.
- **Actor metadata** — `actor.json.name` is `contextractor-test` (or `contextractor` for production); `actor.json.dockerContextDir` is `"../../.."`; `actor.json.description` mentions "built on rs-trafilatura and Crawlee".
- **Workspace deps** — the Apify Actor and the standalone CLI both declare `"@contextractor/engine": "*"` and `"@contextractor/schema": "*"` under the root npm workspaces setup (no `vendor/` directory).

## Step REPORT and AUTO-FIX

For each inconsistency:

- **`input_schema.json` drifted from the Zod schema** → re-run `pnpm --filter @contextractor/gen-input-schema start` and commit the regenerated file. Never hand-edit `input_schema.json`. If the snapshot test still fails, the fix belongs in `packages/schema/src/input.ts`.
- **CLI missing a `ContextractorInput` field** → add a `program.option(...)` in `apps/standalone/src/cli.ts` with sensible kebab-case name; map it through `buildSchemaOverrides` so it reaches `ContextractorInput.parse()`.
- **Markdown region drift (`npm run docs:check` fails)** → run `npm run docs:update`, inspect the diff (the marker block was hand-edited and the rebuild reverted), and pull the desired fact into the canonical source (`packages/schema/src/input.ts` for input fields, `apps/standalone/src/cli.ts` for CLI flags) before regenerating.
- **napi-rs binding missing a TS engine field** → list it for the implementer; the Rust struct must follow the TS interface, but adding it requires implementing the underlying call into `rs-trafilatura`.
- **napi-rs binding has a field absent from TS engine** → flag it. The TS engine should expose what the binding offers, unless the field maps to a field that has no `rs-trafilatura` 0.2.x backing (e.g. `pruneXpath`) — in which case drop the napi-rs field too.
- **Default disagreement** → list each surface's value; do **not** auto-pick. The fix for input-side defaults belongs in the Zod schema; the fix for engine-side defaults belongs in the TS engine.
- **Format enum mismatch** → reset every surface to `txt | markdown | json | html`.
- **`name` mismatch** → leave `actor.json.name` alone (it must match the deploy target); flag for human review.

The auto-fix is conservative: regenerate the JSON schema and the markdown regions from canonical sources; never hand-shrink them.

## Step COMMIT: Commit if Changed

```bash
cd /Users/miroslavsekera/r/contextractor-ts
git diff --stat
# Only commit if there are changes from this command:
git add <only the schema, CLI, and napi-rs files modified above>
git commit -m "Fix internal package consistency"
git push
```

Stage only the schema files, the standalone CLI, and the napi-rs binding files modified by Step REPORT. Do not stage `packages/contextractor-engine/src/index.ts` — the TS engine is canonical and must change via deliberate edits, not by this command.
