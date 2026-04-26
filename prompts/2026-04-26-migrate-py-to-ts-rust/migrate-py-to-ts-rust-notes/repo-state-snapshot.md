# Repo state snapshot — 2026-04-26

## Source repo `/Users/miroslavsekera/r/contextractor/` (Python, canonical functionality)

- `apps/contextractor-apify/` — Apify Actor (Python + Crawlee Playwright). Schemas under `.actor/`.
- `apps/contextractor-standalone/` — Standalone CLI (`typer` + Crawlee), npm wrapper under `npm/`, PyInstaller spec.
- `packages/contextractor_engine/` — Python wrapper around `trafilatura`. Public API: `ContentExtractor`, `TrafilaturaConfig`, `ExtractionResult`, `MetadataResult`.
- `tools/platform-test-runner/` — TypeScript / Node test orchestrator (already TS).
- `tools/generated-unit-tests/` — pytest suite with HTML fixtures (Python).
- `docs/` — `notes/`, `spec/`, `troubleshooting/`, `unit-test-cases/`, `pypi-trusted-publishing.md`.
- `CLAUDE.md`: pushes to `glueo/contextractor-test` (default) and `glueo/contextractor` (production).

## Target repo `/Users/miroslavsekera/r/contextractor-ts/` (currently Python; migration not yet executed)

Filesystem still Python:

- `apps/contextractor/src/*.py` — Python actor entry, mirror of source.
- `packages/contextractor_engine/src/contextractor_engine/` — Python engine.
- `tools/generated-unit-tests/` — pytest.
- Root `Dockerfile`, `apps/contextractor/Dockerfile` — `apify/actor-python-playwright` base.
- `pyproject.toml`, `uv.lock` — Python workspace.

`CLAUDE.md` is **forward-looking** — describes desired Rust binary + TS tooling state, references `apps/contextractor/` paths, declares `shortc/contextractor-test` as default (overridden to `glueo` per QA).

`.claude/commands/sync/docs.md` and `.claude/commands/sync/gui.md` already encode the desired Rust binary + TS tooling structure; both reference `apps/contextractor/` paths that will move to `apps/contextractor-apify/`.

Existing prompt `prompts/2026-04-25-import-claude-from-py-repo/` ported the Claude setup ahead of this migration.

## `/Users/miroslavsekera/r/tools/` propagation targets

- `apps/contextractor-site/` — Next.js site, contains `content/automatic/help/{pypi,npm,docker,web,apify}/`. PyPI page must be edited (not deleted) to mark the package as no longer supported.
- `apps/contextractor-api/` — Next.js API.
- `distributed-packages/contextractor-engine/` — Python wheel (`contextractor_engine-0.3.12-py3-none-any.whl`). Must move to a TS-side artifact or a Rust crate re-export; sibling prompt decides specifics.
- `.claude/commands/projects/contextractor/sync-all.md`, `sync-docs.md`, `sync-gui.md` — keep in sync with `contextractor-ts`'s `.claude/commands/sync/*.md` (and the renamed app path).
- PyPI mentions exist in: `apps/contextractor-site/content/automatic/trafilatura/...`, `.../trafilatura-vs-readability-vs-newspaper/...`, `.../trafilatura-vs-jina-readerlm/...`, `.../help/help.md`, `.../help/help-blurb.md`, `.../help/web/web.md`, `.../help/npm/npm.md`. All must be audited; remove links to `https://www.contextractor.com/help/pypi/` from these docs (the destination page itself stays, edited).

## Apify owner audit

Replace every `shortc/contextractor` and `shortc/contextractor-test` reference in `contextractor-ts` with `glueo/contextractor` and `glueo/contextractor-test`. Known sites: `CLAUDE.md`, `.claude/skills/apify-*`, `.claude/commands/platform/*`, `.claude/commands/git/release.md`, `apps/*/README.md`, root `README.md`.
