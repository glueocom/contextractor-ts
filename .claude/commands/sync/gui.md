---
description: Verify internal consistency of contextractor config across the TS engine, the napi-rs binding, the standalone CLI, and Apify schemas.
allowed-tools: Bash(*), Read(*), Edit(*), Write(*), Glob(*), Grep(*)
---

# Verify Package Consistency

Verify that the contextractor internals agree across **four** surfaces: the TypeScript engine API, the napi-rs binding (Rust), the standalone CLI flags, and the Apify Actor schemas. Auto-fix conservatively where the canonical source is unambiguous; surface anything ambiguous for human review.

The **TypeScript engine API** is canonical. The napi-rs binding follows the TS interface. The standalone CLI and the Apify input schema follow the TS interface too — they are user-facing projections of the same fields.

## Scope

This command only verifies and fixes files inside `/Users/miroslavsekera/r/contextractor-ts/`. It is internal-consistency only — no cross-repo sync.

## Step READ: Read Current State from Source

Read every file below before making any change:

- **TS engine (canonical)** — `packages/contextractor-engine/src/index.ts` (the `TrafilaturaConfig` interface, `ContentExtractor` class, `OutputFormat` union, `DEFAULT_CONFIG`). Capture every field with type and default.
- **napi-rs binding** — `packages/contextractor-engine/native/src/lib.rs`. Capture every `#[napi(object)]` field and the function signatures.
- **Standalone CLI** — `apps/contextractor-standalone/src/cli.ts` (commander/yargs definitions) plus `apps/contextractor-standalone/src/config.ts`.
- **Apify schemas** —
  - `apps/contextractor-apify/.actor/input_schema.json`
  - `apps/contextractor-apify/.actor/output_schema.json`
  - `apps/contextractor-apify/.actor/dataset_schema.json`
  - `apps/contextractor-apify/.actor/actor.json`
- **Apify Actor TS** — `apps/contextractor-apify/src/{main.ts, handler.ts, extraction.ts, config.ts}` (whatever consumes `@contextractor/engine` and reads input).

## Step VERIFY: Cross-Check Internal Consistency

Run each check below. Treat the TS engine as canonical; the napi-rs binding, the standalone CLI, and the schemas must match it.

- **TS engine ⇄ napi-rs binding** — every TS engine config field has a matching `#[napi(object)]` field. Names compare in camelCase (napi-rs auto-converts snake_case → camelCase in generated `.d.ts`). Function signatures match (`extract`, `extractMetadata`, `extractAllFormats`).
- **TS engine ⇄ standalone CLI** — every TS engine config field is reachable as a CLI flag (kebab-case) or as a JSON config key (camelCase). CLI-only flags (output path, log level) are documented inline in `cli.ts`.
- **TS engine ⇄ Apify input schema** — every property in `input_schema.json` corresponds to a TS engine field (camelCase on both sides). A schema property with no TS counterpart is **not** auto-deleted — surface it for human review.
- **Default values** — defaults agree across `DEFAULT_CONFIG` (TS), `Default` impl on the napi-rs struct (Rust), the CLI default, and the schema `default` property.
- **OutputFormat union** — the TS `OutputFormat` union, the napi-rs string enum, the schema `format` enum, and `FORMAT_EXTENSIONS` in the CLI must all be exactly `txt | markdown | json | html`. Any reappearance of `xml` or `xmltei` is a regression.
- **No-op fields** — `pruneXpath` and `dateExtractionParams` are dropped (no rs-trafilatura 0.2.x backing). Flag any reappearance.
- **Actor metadata** — `actor.json.name` is `contextractor-test` (or `contextractor` for production); `actor.json.dockerContextDir` is `"../../.."`; `actor.json.description` mentions "built on rs-trafilatura and Crawlee".
- **Workspace dep** — the Apify Actor's `package.json` declares `"@contextractor/engine": "workspace:*"` (no `vendor/` directory).

## Step REPORT and AUTO-FIX

For each inconsistency:

- **Schema missing a field that exists in TS** → add it to `input_schema.json` with type, default, and description derived from the TS interface's JSDoc and the `DEFAULT_CONFIG` value.
- **Schema has a field with no TS counterpart** → list it; do **not** delete. Wait for human review.
- **napi-rs binding missing a TS field** → list it for the implementer; the Rust struct must follow the TS interface, but adding it requires implementing the underlying call into `rs-trafilatura`.
- **napi-rs binding has a field absent from TS** → flag it. The TS engine should expose what the binding offers, unless the field maps to a field that has no `rs-trafilatura` 0.2.x backing (e.g. `pruneXpath`) — in which case drop the napi-rs field too.
- **CLI missing a TS field** → add a flag with sensible kebab-case name and the same default.
- **Default disagreement** → list each surface's value; do **not** auto-pick. The fix usually belongs in the TS engine, not the schema.
- **Format enum mismatch** → reset every surface to `txt | markdown | json | html`.
- **`name` mismatch** → leave `actor.json.name` alone (it must match the deploy target); flag for human review.

The auto-fix is conservative: schemas, the CLI, and the napi-rs binding may grow to match the TS engine, never shrink without human review.

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
