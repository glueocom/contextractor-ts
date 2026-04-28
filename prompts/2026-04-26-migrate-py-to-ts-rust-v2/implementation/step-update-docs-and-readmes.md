# Step update-docs-and-readmes

## TLDR

Propagate `docs/` from the source repo (skip `pypi-trusted-publishing.md`). Rewrite every README to say Contextractor is built on `rs-trafilatura` and Crawlee. Strip every PyPI / npm-of-Python reference. Add `README.md` at the repo root.

## Skills and Agents

- Agents: `ts-pro`, `code-reviewer`.

## Reference reading

- `../user-entry-log/entry-initial-prompt.md` (Crawlee + rs-trafilatura wording rule; PyPI removal).
- `../migrate-py-to-ts-rust-v2-notes/source-repo-inventory.md` (`docs/` propagation list).
- `../migrate-py-to-ts-rust-v2-notes/v1-lessons-codified.md` ("Built on" wording rule and prereq documentation).
- Existing `.claude/commands/sync/docs.md` — same source-of-truth list as the next step's auto-sync uses.

## Actions

### `docs/` propagation

- For each file in `/r/contextractor/docs/{spec, troubleshooting, unit-test-cases, notes}/`, copy to the matching path under `/r/contextractor-ts/docs/`. Update Python-specific references to TS equivalents inline.
- **Skip** `/r/contextractor/docs/pypi-trusted-publishing.md` — it does not apply.
- For each `docs/spec/*.md`, update language-stack references (Python → TypeScript + napi-rs Rust crate). Verify the supported-format list says `txt | markdown | json | html`.

### App and package READMEs

- `apps/contextractor-apify/README.md`:
  - One-paragraph "What is this Actor for?" lead.
  - Says: "Built on `rs-trafilatura` (extraction) and [Crawlee](https://crawlee.dev/) (TypeScript crawler driving Playwright)."
  - Lists supported formats: `txt | markdown | json | html`. Notes XML / XML-TEI are unsupported pending upstream `rs-trafilatura` work.
  - "Local prerequisites" section: Rust toolchain via `rustup`, Apify CLI ≥ 1.4, Node 22+, npm 10+.
  - "Local development" section: `npm install`, `npm run build -w @contextractor/apify`, `apify run`.
  - "Deploy" section: notes that production deploys are a Git-connected build in the Apify Console (not `apify push`); links to `.claude/commands/platform/push-and-get-working.md`.
- `apps/contextractor-standalone/README.md`:
  - "Built on" line as above.
  - CLI usage with the canonical JSON config example (per `.claude/rules/json-config-only.md`).
  - Supported formats: `txt | markdown | json | html`.
- `packages/contextractor-engine/README.md`:
  - "Built on" line as above.
  - API documentation derived from `src/index.ts` — `ContentExtractor`, `TrafilaturaConfig`, `extract`, `extractMetadata`, `extractAllFormats`.
  - "Pitfalls" section linking to `napi-rs-monorepo-prebuilds.md` content (rs-trafilatura title heuristic, napi-rs `Result<T>` rule, `exactOptionalPropertyTypes`).
- `README.md` at repo root (currently missing — see `target-state-snapshot.md`):
  - Top-level project description.
  - "Built on" line.
  - Link to each app and package README.
  - Workspace commands list (`npm run build -ws --if-present`, `npm run test -ws --if-present`, `cargo build --workspace`, etc.).
  - Local prereqs.

### PyPI / npm reference cleanup

- `grep -rni 'pypi\|/help/pypi\|pip install\|trafilatura>=' --include='*.md' --include='*.json' --include='*.toml' .` outside `prompts/` must return zero results after this step.
- Hits inside `prompts/` are read-only history — leave alone.

## Constraints

- Do not edit `prompts/**` or `.claude/rules/**` (rules already declare the policies; READMEs reflect them).
- Every README must mention `rs-trafilatura` AND Crawlee in the same sentence; use the canonical wording from `../user-entry-log/entry-initial-prompt.md`.
- Do not rewrite `CLAUDE.md` here — that file is updated by the migration only via the `step-run-sync-commands` step's drift fixes.

## Done when

- `docs/` matches the source repo (minus `pypi-trusted-publishing.md`) with TS-stack edits applied.
- Every README mentions both `rs-trafilatura` and Crawlee.
- `grep -rni 'pypi\|/help/pypi\|pip install' --include='*.md' --include='*.json' --include='*.toml' . | grep -v '^\./prompts/'` returns nothing.
- Repo-root `README.md` exists.
- The matching `../tests/step-test-update-docs-and-readmes.md` passes.
