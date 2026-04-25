# Step 03 — Port `commands/sync/docs.md` for Rust + TypeScript Source-of-Truth

## TLDR

Create `commands/sync/docs.md` in target. The source command extracts CLI flags, config fields, and output formats from Python source-of-truth and syncs them into READMEs. Port to read **both Rust and TypeScript** source-of-truth (per the user's "all similar cases, rust and typescript" directive), plus the Apify input schema. Touches `.claude/commands/sync/docs.md`.

## Skills

- `rust` for reading Rust struct / enum / config files
- `apify-schemas` for the input/output/dataset schema files

## Inputs

- Source: `/Users/miroslavsekera/r/contextractor/.claude/commands/sync/docs.md`
- `../import-claude-from-py-repo-notes/target-source-of-truth.md` — explicit list of Rust files, TS files, and JSON schemas that count as canonical
- `../user-entry-log/entry-qa-commands.md` — the "all similar cases, rust and typescript" rule

## Target file

- `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/sync/docs.md` — new

## Actions

Author the new file with this structure (mirror the source's section names: Source of Truth, Step EXTRACT, Step SYNC, Step VERSION, Step VERIFY, Step COMMIT). Adapt every Python-specific reference.

1. **Frontmatter** — `description:` one sentence ("Sync READMEs with current Rust binary, TS tooling, and Apify schema state"). `allowed-tools:` `Bash(*)`, `Read(*)`, `Edit(*)`, `Write(*)`, `Glob(*)`, `Grep(*)`.

2. **Section "Source of Truth"** — list every canonical file. Cover both languages:
   - Rust binary CLI definition: `apps/contextractor/src/main.rs` and any `clap` / `argh` / `bpaf` derive struct in supporting modules.
   - Rust engine config: `packages/contextractor_engine/src/lib.rs` (or whatever struct holds the trafilatura-equivalent options).
   - Rust output-format enum (e.g. `OutputFormat { Txt, Markdown, Json, Jsonl, Xml, XmlTei }`) — wherever it lives.
   - TS tooling config: `tools/platform-test-runner/` types, schemas, or zod definitions.
   - Apify schemas: `apps/contextractor/.actor/input_schema.json`, `output_schema.json`, `dataset_schema.json`.

3. **Step EXTRACT** — instruct the runner to build a complete inventory across all three sources: every CLI flag (with type + default), every config field (Rust struct field, TS type field, Apify schema property), every output format. The inventory must include where each lives (Rust vs TS vs schema) so mismatches are visible.

4. **Step SYNC** — update READMEs. List exactly which README files exist or are likely to exist:
   - `README.md` (repo root)
   - `apps/contextractor/README.md`
   Plus any future TS package README. Use a `find . -name README.md -not -path './node_modules/*' -not -path './target/*' -not -path './.venv/*'` to enumerate at runtime so new READMEs get covered automatically.
   For each README, sync the CLI reference, config tables, and format lists.

5. **Step VERSION** — update the "Docs version" timestamp at the end of `README.md`, computed from `date -u +"%Y-%m-%dT%H:%M:%SZ"`. Reuse the existing slash command if present: `/docs:update-docs-version` (lives at `.claude/commands/docs/update-docs-version.md` in target).

6. **Step VERIFY** — cross-check that:
   - Every CLI flag in the Rust source appears in every README
   - Every Apify input-schema field appears in every README
   - TS-side types (if defined) match the Rust struct field-for-field
   - No removed flag / field is still documented

7. **Step COMMIT** — stage README files, commit with subject `Sync documentation with current Rust + TS state and Apify schema`, push.

## Constraints

- Do not reference `pyproject.toml`, `typer`, `Pydantic`, `dataclass`, Python `--help`, or any Python-specific tool.
- Where the source mentions "CLI options: `…/main.py`" — replace with the Rust equivalent.
- Where the source mentions npm/PyPI READMEs — drop. Target has no npm/PyPI distribution.
- camelCase / snake_case discussion (source's three-doc-style convention) does **not** carry over: the case-conventions rule was skipped in step-01 by design.

## Done when

- File exists with valid frontmatter
- `grep -E "pyproject|typer|Pydantic|FORMAT_EXTENSIONS|CrawlConfig|TrafilaturaConfig" .claude/commands/sync/docs.md` returns nothing
- The "Source of Truth" section names at least one Rust file, the Apify input schema, and `tools/` for TS coverage
- `Docs version` timestamp step is present
