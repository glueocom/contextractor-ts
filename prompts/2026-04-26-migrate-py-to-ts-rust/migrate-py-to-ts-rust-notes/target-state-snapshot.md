# Target repo current state — `/Users/miroslavsekera/r/contextractor-ts/`

Snapshot taken 2026-04-26. The repo name is `-ts` but the implementation is **still Python today**. CLAUDE.md describes an aspirational "Rust binary + TypeScript tooling" state that does not match disk; the migration replaces both descriptions with the new TS-app + Rust-extractor design.

## Filesystem reality

- `apps/contextractor/` — Python Apify Actor (`pyproject.toml`, `src/{__main__.py, main.py, handler.py, extraction.py, config.py}`, `apify/actor-python-playwright` Dockerfile). Mirrors `apps/contextractor-apify/` in the source repo.
  - **Action:** rename to `apps/contextractor-apify/`, then rewrite contents in TypeScript using the source repo's logic + new schemas.
- `packages/contextractor_engine/` — Python lib (`pyproject.toml`, `src/contextractor_engine`, `tests/`).
  - **Action:** rename directory to `packages/contextractor-engine/` (per TS naming convention) and rewrite as a TypeScript package that loads a napi-rs binding to `rs-trafilatura`.
- `tools/platform-test-runner/` — already TypeScript (`apify-client`, tsx, tsc). Keep; only update tests/inputs to match the renamed actor and new schemas.
- `tools/generated-unit-tests/` — currently Python (`conftest.py`, `pytest`, `fixtures/`). Rewrite as TS vitest package; keep `fixtures/` verbatim.
- `docs/{spec, troubleshooting, unit-test-cases, notes}` — present. Sync from source repo's docs (skip `pypi-trusted-publishing.md`).
- Root: `pyproject.toml` (uv workspace), `uv.lock`, `Dockerfile`, `LICENSE`, `logo.*`. No `README.md`.
- `.claude/commands/sync/{docs.md, gui.md}` — already exist and reference Rust + TS. Update them to drop Rust-binary assumption and use TS-engine + Rust-napi-rs assumption (engine source-of-truth becomes the TS types, not the Rust struct).
- `.claude/commands/platform/push-and-get-working.md`, `.claude/commands/git/release.md` — reference `glueo/contextractor-test` and `Cargo.toml` version sync. Update per `entry-qa-test-actor.md` and per the new "no Rust binary" reality.

## CLAUDE.md drift

CLAUDE.md currently says:
- "Dual-language (Rust binary + TypeScript tooling) Apify Actor" — wrong after this migration; correct description is "TypeScript Apify Actor + standalone CLI, with a `rs-trafilatura` napi-rs binding for extraction".
- Project Structure block lists `apps/contextractor/src/main.rs`, `packages/contextractor_engine/src/lib.rs` as Rust — replace with TS paths and the napi-rs crate path.
- Commands block lists `cargo build`, `cargo test`, `cargo nextest`, `cargo clippy` — keep (the napi-rs crate still uses cargo) but add `pnpm -r build`, `pnpm -r test`, `biome check`.
- Production Protection block uses `glueo/contextractor[-test]` — replace with `glueo/contextractor[-test]`.
- Active Skills block lists Rust skills — keep them; the napi-rs crate is real Rust. Add the TS skills (none yet — leave to per-step prompts to introduce as needed).

## PyPI references in target

`grep -rni 'pypi\|/help/pypi' --include='*.md' --include='*.json' --include='*.toml'` shows hits **only inside `prompts/`** (historical user-entry logs from prior prompts) — none in production code, docs, or CLAUDE.md. The migration must not introduce new PyPI references; existing prompt-folder references are read-only history and stay as-is.
