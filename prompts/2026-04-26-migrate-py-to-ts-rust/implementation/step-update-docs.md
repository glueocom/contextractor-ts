# Step update-docs

## TLDR

Propagate `/r/contextractor/docs/{spec, troubleshooting, unit-test-cases, notes}` into the target's `docs/` (skip `pypi-trusted-publishing.md`). Rewrite each app/package README. Strip every PyPI / `pip install` / npm-of-Python-package / `https://www.contextractor.com/help/pypi/` reference. Create a root `README.md` if absent.

## Skills and agents

- Agent: `ts-pro` for app/package READMEs, `code-reviewer` for tone consistency.

## Inputs

- Read `../migrate-py-to-ts-rust-notes/source-repo-inventory.md` (docs section).
- Read source: `/r/contextractor/docs/`, `/r/contextractor/README.md`, `/r/contextractor/packages/contextractor_engine/README.md`, `/r/contextractor/apps/*/README.md`.
- Read `../user-entry-log/entry-qa-xml-formats.md` (supported formats list for tables).

## Actions

- Diff `/r/contextractor/docs/` against `/r/contextractor-ts/docs/`. For each new or updated file under `spec/`, `troubleshooting/`, `unit-test-cases/`, `notes/`:
  - Write the source content to the target.
  - Strip any PyPI / `pip install` / npm-of-Python references.
  - Replace Python code blocks with TypeScript or CLI equivalents where they exemplify usage. Algorithm explanations stay language-agnostic.
- Skip `docs/pypi-trusted-publishing.md` entirely.
- Rewrite `apps/contextractor-apify/README.md` describing the TS Apify actor (input schema highlights, output dataset shape, Dockerfile base, `glueo/contextractor-test`).
- Rewrite `apps/contextractor-standalone/README.md` describing the TS CLI (install via `pnpm` workspace; per `.claude/rules/json-config-only.md`, only document JSON config).
- Rewrite `packages/contextractor-engine/README.md` describing the TS API + the napi-rs `rs-trafilatura` backend; document the supported-formats list (`txt`, `markdown`, `json`, `html`); call out the temporary xml/xmltei gap once.
- Add a root `README.md` if missing — short overview pointing at the apps and engine; **no** PyPI / npm sections.
- Run `grep -rni 'pypi\|/help/pypi\|pip install' --include='*.md' --include='*.json' --include='*.toml'` (excluding `prompts/`) — must return zero matches before this step is done.

## Constraints

- Do not modify anything inside `prompts/` (historical user logs).
- Per `.claude/rules/json-config-only.md` — config docs use JSON, never YAML.

## Done when

- `grep -rni 'pypi\|/help/pypi\|pip install' --include='*.md' --include='*.json' --include='*.toml' . | grep -v '^./prompts/'` returns nothing.
- All app and package READMEs exist and document the new TS reality.
- The matching `tests/step-test-update-docs.md` passes.
