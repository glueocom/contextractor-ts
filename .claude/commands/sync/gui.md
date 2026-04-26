---
description: Verify internal consistency of contextractor config across Rust, TS, and Apify schemas.
allowed-tools: Bash(*), Read(*), Edit(*), Write(*), Glob(*), Grep(*)
---

# Verify Package Consistency

Verify that the contextractor internals agree across **four** surfaces: the Rust binary CLI, the Rust engine config, any TypeScript tooling that mirrors them, and the Apify Actor schemas. Auto-fix conservatively where the canonical source is unambiguous; surface anything ambiguous for human review.

## Scope

This command only verifies and fixes files inside `/Users/miroslavsekera/r/contextractor-ts/`. It is internal-consistency only — no cross-repo sync.

## Step READ: Read Current State from Source

Read every file below before making any change:

- **Rust binary** — `apps/contextractor/src/main.rs` (CLI flag definitions) plus any supporting modules under `apps/contextractor/src/` that define the binary's input config struct.
- **Rust engine** — `packages/contextractor_engine/src/lib.rs` and any sub-modules holding the trafilatura-equivalent options struct (the engine-config struct).
- **Rust output-format enum** — wherever the `OutputFormat` enum lives (binary or engine crate). Capture every variant.
- **TypeScript tooling** — anything under `tools/platform-test-runner/` (and any future TS package under `tools/`) that defines a config type, zod schema, or input validator mirroring the Rust config.
- **Apify schemas** —
  - `apps/contextractor/.actor/input_schema.json`
  - `apps/contextractor/.actor/output_schema.json`
  - `apps/contextractor/.actor/dataset_schema.json`
  - `apps/contextractor/.actor/actor.json`

## Step VERIFY: Cross-Check Internal Consistency

Run each check below. Treat the Rust source as canonical; the schema and TS validators must match it.

1. **Binary ⇄ engine** — every Rust binary CLI flag has a matching field on the engine config struct, **or** is documented in the binary source as a CLI-only flag (logging level, verbosity, output path, etc.).
2. **Binary ⇄ output formats** — the Rust output-format enum covers every format the binary CLI accepts.
3. **Binary ⇄ Apify input schema** — every property in `apps/contextractor/.actor/input_schema.json` corresponds to a field on the Rust binary config, with names converted by serde rename rules:
   - Apify uses camelCase by convention; the Rust struct typically uses snake_case.
   - Read `#[serde(rename = "...")]` attributes on the Rust struct where present, and compare those names to the JSON property names.
   - A schema property with no Rust counterpart is **not** auto-deleted — surface it for human review.
4. **Binary ⇄ TS tooling** — TS-side validators (zod schema, type alias, etc.) under `tools/` are kept in sync with the Rust binary config. New Rust fields propagate to TS; removed Rust fields propagate to TS.
5. **Default values** — defaults agree across binary defaults, schema `default` properties, and any TS defaults.
6. **Format enum ⇄ schema enum** — the schema's `format` (or equivalent) enum lists exactly the variants of the Rust output-format enum.

## Step REPORT and AUTO-FIX

For each inconsistency:

- **Schema missing a field that exists in Rust** → add it to `input_schema.json` with type, default, and description derived from the Rust struct's doc comments and `#[serde]` attributes.
- **Schema has a field with no Rust counterpart** → list it; do **not** delete. Wait for human review.
- **TS validator missing a Rust field** → add it to the TS schema/type with the matching type and default.
- **TS validator has a field with no Rust counterpart** → list it; do **not** delete.
- **Default disagreement** → list each surface's value; do **not** auto-pick. The fix may belong in the Rust source, not the schema.
- **Format enum mismatch** → if Rust adds a variant, add it to the schema enum. If the schema has an extra variant, list it for human review.

The auto-fix is conservative: schemas and TS validators may grow to match Rust, never shrink without human review.

## Step COMMIT: Commit if Changed

```bash
cd /Users/miroslavsekera/r/contextractor-ts
git diff --stat
# Only commit if there are changes from this command:
git add <only the schema and TS files modified above>
git commit -m "Fix internal package consistency"
git push
```

Stage only the schema files and TS validator files modified by Step REPORT. Do not stage Rust source — the Rust source is canonical and must change via deliberate edits, not by this command.
