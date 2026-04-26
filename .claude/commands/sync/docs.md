---
description: Sync READMEs with current TypeScript engine, standalone CLI, napi-rs binding, and Apify schema state.
allowed-tools: Bash(*), Read(*), Edit(*), Write(*), Glob(*), Grep(*)
---

# Sync Contextractor Repo Documentation

Ensure every README under this repo reflects the current TypeScript standalone CLI (`apps/contextractor-standalone/src/cli.ts`), the TypeScript engine (`packages/contextractor-engine/src/index.ts`), the napi-rs binding mirror (`packages/contextractor-engine/native/src/lib.rs`), and the Apify Actor schemas. CLI help, config tables, and format lists must be in sync across all surfaces.

**Scope:** This command only updates files inside `/Users/miroslavsekera/r/contextractor-ts/`. The Actor ships only to Apify — there is no separate package-registry README to sync.

## Source of Truth

The source files are canonical for what each README must document. When they disagree with each other, surface the mismatch in **Step VERIFY** rather than silently picking a winner.

- **Standalone TS CLI definition** — `apps/contextractor-standalone/src/cli.ts` (commander definitions) plus the `CrawlConfig` interface in `apps/contextractor-standalone/src/config.ts`.
- **TypeScript engine config** — `packages/contextractor-engine/src/index.ts` holding the `TrafilaturaConfig` interface and `OutputFormat` union (authoritative source-of-truth — the napi-rs binding mirrors this).
- **napi-rs binding mirror** — `packages/contextractor-engine/native/src/lib.rs` defines the Rust struct that mirrors the TS interface. The TS interface wins on disagreement.
- **TS output-format union** — `OutputFormat = 'txt' | 'markdown' | 'json' | 'html'` in `packages/contextractor-engine/src/index.ts`.
- **TypeScript tooling config** — anything under `tools/platform-test-runner/src/types.ts` that mirrors the Apify input shape.
- **Apify Actor schemas** —
  - `apps/contextractor-apify/.actor/input_schema.json`
  - `apps/contextractor-apify/.actor/output_schema.json`
  - `apps/contextractor-apify/.actor/dataset_schema.json`

## Step EXTRACT: Extract Current State

Read every source-of-truth file above and build one inventory covering all three surfaces:

- Every CLI flag from `apps/contextractor-standalone/src/cli.ts` (long name, short name if any, type, default, help text).
- Every TypeScript engine config field from `TrafilaturaConfig` (name, type, default, JSDoc).
- Every Apify input-schema property (name, type, default, description, editor type) — note that it lives in **the schema**.
- Every napi-rs `TrafilaturaConfig` field — must match the TS interface.
- Every output format the engine accepts (`OutputFormat` union in `packages/contextractor-engine/src/index.ts`).

Each row in the inventory must record where the entry lives so mismatches between TS, the napi-rs binding, and the schema are visible.

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
- `apps/contextractor-apify/README.md`
- `apps/contextractor-standalone/README.md`
- `packages/contextractor-engine/README.md`

For each README found, sync:

- The CLI reference (every standalone-CLI flag with type, default, and help text).
- The config-field tables (TS engine `TrafilaturaConfig` + Apify input-schema fields, side-by-side where they correspond).
- The output-format list (every variant in the `OutputFormat` union).
- Any napi-rs binding section — keep in sync with the TS interface (TS wins).

If a README does not yet have a section for the CLI or config, add it at the natural insertion point rather than skipping the file.

## Step VERSION: Update Docs Version

Update the "Docs version" timestamp at the end of `README.md`:

```bash
date -u +"%Y-%m-%dT%H:%M:%SZ"
```

If the existing slash command `/docs:update-docs-version` already covers a README (currently `apps/contextractor-apify/README.md`), invoke it for that file instead of duplicating the logic.

## Step VERIFY: Verify Consistency

Cross-check across **all four surfaces** (TS engine, napi-rs binding, Apify schemas, READMEs):

- Every standalone-CLI flag appears in every README that documents the CLI.
- Every Apify `input_schema.json` property appears in every README that documents the Actor.
- The TS engine `TrafilaturaConfig` interface and the napi-rs `TrafilaturaConfig` struct agree field-for-field.
- The TS `OutputFormat` union, the `input_schema.json` save flags, and every README's format list agree.
- No removed flag, field, or format is still documented.
- Any flag named in the TS CLI but missing from the schema (or vice-versa) is flagged for human review — do not silently delete from either side.

Report any inconsistencies found and fix the docs side. Mismatches between TS and the schema are out of scope for this command — fix those via `/sync:gui`.

## Step COMMIT: Commit

```bash
cd /Users/miroslavsekera/r/contextractor-ts
git add <each README touched in Step SYNC>
git commit -m "Sync documentation with current TS + napi-rs state and Apify schema"
git push
```

Stage only README files; do **not** stage TS source, the napi-rs crate, or schema files in this command.
