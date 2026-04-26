---
description: Verify internal consistency of contextractor config across the TS engine, the napi-rs binding, the standalone CLI, and the Apify schemas.
allowed-tools: Bash(*), Read(*), Edit(*), Write(*), Glob(*), Grep(*)
---

# Verify Package Consistency

Verify that the contextractor internals agree across **four** surfaces: the TS engine config (`packages/contextractor-engine/src/index.ts`), the napi-rs binding mirror (`packages/contextractor-engine/native/src/lib.rs`), the standalone CLI flags (`apps/contextractor-standalone/src/cli.ts`), and the Apify Actor schemas. Auto-fix conservatively where the canonical source is unambiguous; surface anything ambiguous for human review. The TS engine is the authoritative source-of-truth — it directly maps to the napi-rs binding.

## Scope

This command only verifies and fixes files inside `/Users/miroslavsekera/r/contextractor-ts/`. It is internal-consistency only — no cross-repo sync.

## Step READ: Read Current State from Source

Read every file below before making any change:

- **TS engine** — `packages/contextractor-engine/src/index.ts` (`TrafilaturaConfig` interface, `OutputFormat` union, `DEFAULT_CONFIG`).
- **napi-rs binding mirror** — `packages/contextractor-engine/native/src/lib.rs` (`TrafilaturaConfig` struct).
- **Standalone CLI** — `apps/contextractor-standalone/src/cli.ts` (commander option definitions) plus `apps/contextractor-standalone/src/config.ts` (`CrawlConfig` interface).
- **Apify Actor source** — `apps/contextractor-apify/src/{config.ts, types.ts}` (input parsing).
- **Apify schemas** —
  - `apps/contextractor-apify/.actor/input_schema.json`
  - `apps/contextractor-apify/.actor/output_schema.json`
  - `apps/contextractor-apify/.actor/dataset_schema.json`
  - `apps/contextractor-apify/.actor/actor.json`

## Step VERIFY: Cross-Check Internal Consistency

Run each check below. Treat the **TS engine** as canonical; the napi-rs binding, the CLI, and the Apify schemas must match it.

- **TS engine ⇄ napi-rs binding** — every field on the TS `TrafilaturaConfig` interface has a matching field on the napi-rs `TrafilaturaConfig` Rust struct (camelCase → snake_case via napi-derive auto-conversion).
- **TS engine ⇄ standalone CLI** — every TS engine config field that is exposed at the CLI surface has a corresponding `commander` option in `apps/contextractor-standalone/src/cli.ts` and a matching field on `CrawlConfig` (`apps/contextractor-standalone/src/config.ts`). Fields that are CLI-only (verbosity, output path, etc.) live only on `CrawlConfig`.
- **TS engine ⇄ Apify input schema** — every property in `apps/contextractor-apify/.actor/input_schema.json` either corresponds to a field on the TS engine `TrafilaturaConfig` (under the `trafilaturaConfig` object) or to an actor-only crawler/browser setting. A schema property with no TS counterpart is **not** auto-deleted — surface it for human review.
- **Output formats** — the TS `OutputFormat` union (`txt | markdown | json | html`) is the authoritative format list. The Apify schema's per-format save flags must cover the same set, and no schema flag may exist for unsupported formats (`xml`, `xmltei`).
- **Default values** — defaults agree across `DEFAULT_CONFIG` (TS engine), the Apify schema `default` properties, and the standalone CLI defaults.

## Step REPORT and AUTO-FIX

For each inconsistency:

- **Schema missing a TS field** → add it to `input_schema.json` with type, default, and description derived from the TS interface JSDoc.
- **Schema has a field with no TS counterpart** → list it; do **not** delete. Wait for human review.
- **napi-rs binding missing a TS field** → add it to the Rust struct with the matching type. Then `pnpm -F @contextractor/engine-native build` to regenerate the bindings.
- **napi-rs binding has a field with no TS counterpart** → list it; do **not** delete.
- **Default disagreement** → list each surface's value; do **not** auto-pick. The fix usually belongs in `DEFAULT_CONFIG` (TS) or the schema, not the binding.
- **Format set mismatch** — if the Apify schema has a save flag for `xml` or `xmltei`, drop it (formats are unsupported in this engine version).

The auto-fix is conservative: schemas, the napi-rs binding, and the CLI may grow to match the TS engine, never shrink without human review.

## Step COMMIT: Commit if Changed

```bash
cd /Users/miroslavsekera/r/contextractor-ts
git diff --stat
# Only commit if there are changes from this command:
git add <only the schema and TS files modified above>
git commit -m "Fix internal package consistency"
git push
```

Stage only the schema files, the napi-rs binding `lib.rs`, and the CLI / config TS files modified by Step REPORT. Do not stage `packages/contextractor-engine/src/index.ts` — the TS engine is canonical and must change via deliberate edits, not by this command.
