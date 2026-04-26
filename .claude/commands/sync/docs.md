---
description: Sync READMEs with current Rust binary, TS tooling, and Apify schema state.
allowed-tools: Bash(*), Read(*), Edit(*), Write(*), Glob(*), Grep(*)
---

# Sync Contextractor Repo Documentation

Ensure every README under this repo reflects the current Rust binary CLI, the TypeScript tooling configuration, and the Apify Actor schemas. CLI help, config tables, and format lists must be in sync across all three.

**Scope:** This command only updates files inside `/Users/miroslavsekera/r/contextractor-ts/`. The Actor ships only to Apify — there is no separate package-registry README to sync.

## Source of Truth

The source files are canonical for what each README must document. When they disagree with each other, surface the mismatch in **Step VERIFY** rather than silently picking a winner.

- **Rust binary CLI definition** — `apps/contextractor/src/main.rs` plus any `clap` / `argh` / `bpaf` derive struct in supporting modules under `apps/contextractor/src/`.
- **Rust engine config** — `packages/contextractor_engine/src/lib.rs` (and any sub-modules) holding the trafilatura-equivalent options struct.
- **Rust output-format enum** — wherever the `OutputFormat` enum lives in the binary or engine crate (e.g. variants like `Txt`, `Markdown`, `Json`, `Jsonl`, `Xml`, `XmlTei`, `Html`).
- **TypeScript tooling config** — anything under `tools/platform-test-runner/` (and any future TS package under `tools/`) that defines a config type, zod schema, or input validator that mirrors the Rust config.
- **Apify Actor schemas** —
  - `apps/contextractor/.actor/input_schema.json`
  - `apps/contextractor/.actor/output_schema.json`
  - `apps/contextractor/.actor/dataset_schema.json`

## Step EXTRACT: Extract Current State

Read every source-of-truth file above and build one inventory covering all three surfaces:

- Every CLI flag (long name, short name if any, type, default, help text) — note that it lives in **Rust**.
- Every Rust engine config field (name, type, default, doc comment).
- Every Apify input-schema property (name, type, default, description, editor type) — note that it lives in **the schema**.
- Every TS-side type / zod field (name, type, default) — note that it lives in **TS**.
- Every output format the binary accepts (the union of the Rust enum and the `format` enum in `input_schema.json`).

Each row in the inventory must record where the entry lives so mismatches between Rust, TS, and the schema are visible.

## Step SYNC: Update READMEs

Enumerate READMEs at runtime so newly added ones are covered automatically:

```bash
find . -type f -name 'README.md' \
  -not -path './node_modules/*' \
  -not -path './target/*' \
  -not -path './.venv/*' \
  -not -path './.git/*'
```

At minimum the following READMEs are expected to exist:

- `README.md` (repo root)
- `apps/contextractor/README.md`

For each README found, sync:

- The CLI reference (every Rust binary flag with type, default, and help text).
- The config-field tables (Rust engine config + Apify input-schema fields, side-by-side where they correspond).
- The output-format list (every variant accepted by the binary).
- Any TypeScript-tooling section referencing config types — keep in sync with the TS source.

If a README does not yet have a section for the CLI or config, add it at the natural insertion point rather than skipping the file.

## Step VERSION: Update Docs Version

Update the "Docs version" timestamp at the end of `README.md`:

```bash
date -u +"%Y-%m-%dT%H:%M:%SZ"
```

If the existing slash command `/docs:update-docs-version` already covers a README (currently `apps/contextractor/README.md`), invoke it for that file instead of duplicating the logic.

## Step VERIFY: Verify Consistency

Cross-check across **all three surfaces**:

- Every Rust-binary CLI flag appears in every README.
- Every Apify `input_schema.json` property appears in every README.
- TS-side types / zod schemas (where defined) match the Rust engine config field-for-field.
- The Rust output-format enum, the `input_schema.json` `format` enum, and every README's format list agree.
- No removed flag, field, or format is still documented.
- Any flag named in the Rust binary but missing from the schema (or vice-versa) is flagged for human review — do not silently delete from either side.

Report any inconsistencies found and fix the docs side. Mismatches between Rust and the schema are out of scope for this command — fix those via `/sync:gui`.

## Step COMMIT: Commit

```bash
cd /Users/miroslavsekera/r/contextractor-ts
git add <each README touched in Step SYNC>
git commit -m "Sync documentation with current Rust + TS state and Apify schema"
git push
```

Stage only README files; do **not** stage Rust source, TS source, or schema files in this command.
