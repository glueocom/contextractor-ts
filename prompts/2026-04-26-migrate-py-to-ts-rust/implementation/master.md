# Migrate contextractor-ts — Master

## TLDR

Re-platform `/Users/miroslavsekera/r/contextractor-ts/` from Python to **TypeScript app logic + Rust `rs-trafilatura` (via napi-rs)**, propagating newer schemas and code from `/Users/miroslavsekera/r/contextractor/`. Touches every `apps/`, `packages/`, `tools/`, `docs/`, root config, `CLAUDE.md`, and the `.claude/commands/{sync,platform,git}/` commands. Tests run locally and on Apify test actor `glueo/contextractor-test`. Generates a separate follow-up prompt for `/Users/miroslavsekera/r/tools/`.

## Skills and Agents

Skills:

- `apify-actor-development`, `apify-actorization`, `apify-ops`, `apify-schemas`
- `rust`, `rust-packaging`, `async-rust-patterns`, `rust-testing-patterns`

Agents:

- `ts-pro` — TS engine, Apify actor, standalone CLI, vitest tests
- `rust-pro` — `rs-trafilatura` napi-rs wrapper crate
- `code-reviewer` — diff review per step
- `test-runner` — `pnpm`, `cargo`, `apify` smoke per step
- `web-research-specialist` — fallback for napi-rs / rs-trafilatura specifics

## Shared context

- Read `../user-entry-log/entry-initial-prompt.md` and every `entry-qa-*.md` before each step.
- Read all four files under `../migrate-py-to-ts-rust-notes/` before each step.
- Source repo `/Users/miroslavsekera/r/contextractor/` is read-only.
- Apify deploy in scope: `glueo/contextractor-test` only.
- Supported output formats after migration: `txt`, `markdown`, `json`, `html`. Drop `xml` and `xmltei`.
- After each implementation step, run the matching `tests/step-test-{name}.md` before moving on.

## Step list

- `step-prepare-workspace.md` — pnpm + Cargo workspace skeleton; remove Python root config; install Biome, vitest, TS toolchain.
- `step-rename-engine-package.md` — rename `packages/contextractor_engine/` → `packages/contextractor-engine/`; capture Python API surface for the TS port; drop Python sources.
- `step-build-napi-binding.md` — add `packages/contextractor-engine/native/` napi-rs crate wrapping `rs-trafilatura`; build a local `darwin-arm64` prebuild.
- `step-port-engine-to-ts.md` — rewrite `packages/contextractor-engine/src/index.ts` mirroring the Python API; drop `xml`/`xmltei`.
- `step-rename-and-port-apify-actor.md` — rename `apps/contextractor/` → `apps/contextractor-apify/`; TS port using Apify SDK + Crawlee TS; new `.actor/` schemas; Node + Playwright Dockerfile.
- `step-add-standalone-cli.md` — port `/r/contextractor/apps/contextractor-standalone/` to TS at `apps/contextractor-standalone/`; Crawlee TS crawler; drop PyInstaller / npm-wrapper artifacts.
- `step-port-tools-tests.md` — rewrite `tools/generated-unit-tests/` as vitest; copy `fixtures/` from source; refresh `tools/platform-test-runner/` inputs.
- `step-update-docs.md` — propagate `docs/` (skip `pypi-trusted-publishing.md`); rewrite app/package READMEs; strip PyPI / npm-of-Python references.
- `step-update-claude-config.md` — refresh `CLAUDE.md`, `.claude/commands/sync/{docs.md, gui.md}`, `.claude/commands/platform/push-and-get-working.md`, `.claude/commands/git/release.md` to match new reality and `glueo/*` actors.
- `step-run-sync-commands.md` — run `/sync/docs` and `/sync/gui`; fix drift.
- `step-local-and-platform-tests.md` — `pnpm -r build`, `pnpm -r test`, `cargo test`, `apify run` locally, `apify push` to `glueo/contextractor-test`, run platform-test-runner.
- `step-generate-r-tools-prompt.md` — emit a new prompt at `/Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-rewrite.md`; do not execute it.
