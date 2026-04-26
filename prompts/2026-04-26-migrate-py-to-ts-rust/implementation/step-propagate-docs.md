# Step PROPAGATE_DOCS: Propagate `docs/` and READMEs

## TLDR

Bring every markdown file from `/Users/miroslavsekera/r/contextractor/docs/` and the source READMEs into the target repo, dropping Python-only content and rewriting code samples to Rust + TypeScript.

## Skills and agents

- `general-purpose` agent — for surveying both repos' markdown.
- `code-reviewer` agent — final pass for tone and consistency.

## Inputs

- Source: `/Users/miroslavsekera/r/contextractor/docs/`, `/Users/miroslavsekera/r/contextractor/README.md`, `/Users/miroslavsekera/r/contextractor/apps/*/README.md`, `/Users/miroslavsekera/r/contextractor/packages/contextractor_engine/README.md`.
- Drop list: `pypi-trusted-publishing.md` (Python-only); any doc whose entire body is Python install/build instructions.

## Step SURVEY: Inventory

Inventory every `.md` under source `docs/`, and every README. Compare to target `docs/` and READMEs. List:

- Files to copy verbatim (Rust/TS-agnostic specs).
- Files to copy with code-sample rewrites (Python → Rust or TS).
- Files to drop.

## Step COPY: Copy and rewrite

For each file in the keep set:

- Drop every `pip install`, `uv`, `pyproject.toml`, `python3 -m`, and `pytest` snippet. Replace with `cargo`, `pnpm`, or `npm` equivalents.
- Drop every PyPI-related claim ("Also available on PyPI as ...").
- Rewrite Python API examples to Rust API calls referencing the target `packages/contextractor_engine` types.
- Update every `apps/contextractor-apify/...` and `apps/contextractor-standalone/...` path reference.
- Update the supported-format list: `HTML, TXT, JSON, Markdown` (no XML, no XML-TEI).

## Step ROOT_README: Root README

Rewrite `/Users/miroslavsekera/r/contextractor-ts/README.md`:

- Project description (Rust + TS Apify Actor wrapping `rs-trafilatura`).
- Repo layout matching the post-rename structure.
- Quick-start: `cargo run -p contextractor-apify` (local), `apify run`, `cargo run -p contextractor` (standalone CLI).
- Supported formats: HTML, TXT, JSON, Markdown.
- Apify owner: `glueo` (per `../user-entry-log/entry-qa-apify-owner.md`).
- Drop every PyPI mention.

## Step DOCS_VERSION: Version stamp

Run `/docs:update-docs-version` for any README it covers. Otherwise append a "Docs version: <UTC timestamp>" footer manually.
