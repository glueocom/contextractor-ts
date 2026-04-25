# Step 04 — Port `commands/sync/gui.md` as Cross-Package Consistency Check

## TLDR

Create `commands/sync/gui.md` in target. The source command verifies internal consistency between Python config, models, CLI, and Apify input schema. Port to verify consistency across **Rust binary config, Rust engine config, TS tooling, and Apify schemas** — covering both languages per the user directive. Touches `.claude/commands/sync/gui.md`.

## Skills

- `rust`
- `apify-schemas`

## Inputs

- Source: `/Users/miroslavsekera/r/contextractor/.claude/commands/sync/gui.md`
- `../import-claude-from-py-repo-notes/target-source-of-truth.md`
- `../user-entry-log/entry-qa-commands.md`

## Target file

- `/Users/miroslavsekera/r/contextractor-ts/.claude/commands/sync/gui.md` — new

## Actions

Author the new file. Despite the source name `sync/gui.md`, the source command is a no-cross-repo, internal-consistency check (read the source first to confirm). Keep the same name and intent; adapt the content.

1. **Frontmatter** — `description:` one sentence ("Verify internal consistency of contextractor config across Rust, TS, and Apify schemas"). `allowed-tools:` `Bash(*)`, `Read(*)`, `Edit(*)`, `Write(*)`, `Glob(*)`, `Grep(*)`.

2. **Scope** — explicit one-paragraph scope: only verifies / fixes files inside `/Users/miroslavsekera/r/contextractor-ts/`. No cross-repo sync.

3. **Step READ** — list every source-of-truth file the verifier reads:
   - Rust binary `apps/contextractor/src/main.rs` (CLI flags) and supporting modules with the config struct.
   - Rust engine `packages/contextractor_engine/src/lib.rs` and any sub-modules holding the `TrafilaturaConfig`-equivalent struct.
   - TS tooling under `tools/platform-test-runner/` — any type, zod schema, or input-validator that mirrors the config.
   - `apps/contextractor/.actor/input_schema.json`, `output_schema.json`, `dataset_schema.json`, `actor.json`.

4. **Step VERIFY** — concrete checks (translate each Python source check into a Rust + TS + schema equivalent):
   - Every Rust-binary CLI flag has a matching field on the engine config struct (or is documented as a CLI-only flag).
   - Engine config struct fields match the extraction-related subset of the binary config.
   - The output-format enum in Rust covers every format the binary CLI accepts.
   - `input_schema.json` properties match the Rust binary config field-for-field, with names converted between snake_case (Rust) and camelCase (Apify) by serde rename rules — reading `#[serde(rename = "…")]` attributes where present.
   - TS-side validators (if any) are kept in sync with the Rust struct.
   - Default values agree across all four surfaces.

5. **Step REPORT** — list any inconsistency found. Auto-fix where the canonical source is unambiguous: if the Rust struct gains a field that's missing from `input_schema.json`, add it to the schema; if the schema has a field with no Rust counterpart, surface it for the human to resolve (don't auto-delete).

6. **Step COMMIT** — only commit if there are changes. Stage only the changed source-of-truth and schema files. Commit subject `Fix internal package consistency`. Push.

## Constraints

- Do not reference `config.py`, `crawler.py`, `models.py`, `CrawlConfig`, `TrafilaturaConfig`, `FORMAT_EXTENSIONS`, or any Python identifier.
- The case-conventions handling here is just serde rename rules — do not write a rule about camelCase/snake_case docs (that rule was deliberately skipped in step-01).
- The auto-fix is conservative: schema can grow to match Rust, never shrink without human review.

## Done when

- File exists with valid frontmatter
- `grep -E "config\\.py|crawler\\.py|models\\.py|CrawlConfig|TrafilaturaConfig|FORMAT_EXTENSIONS" .claude/commands/sync/gui.md` returns nothing
- "Step READ" lists at least one Rust file, the Apify input schema, and a TS path under `tools/`
- "Step VERIFY" includes at least one check that ties the Rust struct to `input_schema.json`
