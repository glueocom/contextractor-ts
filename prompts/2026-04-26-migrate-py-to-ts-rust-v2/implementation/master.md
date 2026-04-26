# Migrate `contextractor-ts` — Master (v2)

## TLDR

Re-platform `/Users/miroslavsekera/r/contextractor-ts/` from Python to **TypeScript app logic + `rs-trafilatura` (Rust) via napi-rs**, propagating newer schemas and code from `/Users/miroslavsekera/r/contextractor/`. Touches every `apps/`, `packages/`, `tools/`, `docs/`, root config, `CLAUDE.md`, the `.claude/commands/{sync,platform,git}/` commands, and `.github/workflows/`. Tests run locally and on Apify test actor `glueo/contextractor-test` only. Generates a separate follow-up prompt under `/Users/miroslavsekera/r/tools/prompts/`.

This is **v2**. The v1 pass at `prompts/2026-04-26-migrate-py-to-ts-rust/` was reverted (commit `e04ecf4`). The v2 entry prompt at `../user-entry-log/entry-initial-prompt.md` codifies the lessons from v1.

## Skills and Agents

Skills:

- `apify-actor-development`, `apify-actorization`, `apify-ops`, `apify-schemas` — Actor structure, Git-connected build, schemas, runtime ops.
- `rust`, `rust-packaging`, `rust-testing-patterns`, `async-rust-patterns` — napi-rs crate, Cargo lints, packaging.
- `autonomous-task` — execute end-to-end across steps without confirmation prompts.

Agents:

- `ts-pro` — TS engine, Apify Actor, standalone CLI, vitest tests.
- `rust-pro` — napi-rs crate wrapping `rs-trafilatura`.
- `code-reviewer` — per-step diff review.
- `test-runner` — `pnpm`, `cargo`, `apify` smoke per step.
- `web-research-specialist` — fallback for napi-rs / rs-trafilatura specifics.
- `prompt-writer` — used by `step-generate-r-tools-prompt` only.

## Shared context

Read the entire `../user-entry-log/` and the entire `../migrate-py-to-ts-rust-v2-notes/` before any step. The QA decisions and the notes files cover decisions that are not derivable from the code:

- `../user-entry-log/entry-initial-prompt.md` — v2 entry prompt with "Lessons from the v1 implementation pass".
- `../user-entry-log/entry-qa-prebuild-distribution.md` — workspace-package layout for `.node` prebuilds; committed binaries; no external publishing.
- `../user-entry-log/entry-qa-ci-scope.md` — `.github/workflows/build-napi.yml` is in scope; no other workflows.
- `../user-entry-log/entry-qa-config-field-scope.md` — drop only `pruneXpath` and `dateExtractionParams`.
- `../migrate-py-to-ts-rust-v2-notes/source-repo-inventory.md` — what to propagate from `/r/contextractor/`.
- `../migrate-py-to-ts-rust-v2-notes/target-state-snapshot.md` — current target tree and clutter to clean.
- `../migrate-py-to-ts-rust-v2-notes/rs-trafilatura-0.2.md` — confirmed v0.2.2 API surface.
- `../migrate-py-to-ts-rust-v2-notes/napi-rs-monorepo-prebuilds.md` — layout, loader, pitfalls.
- `../migrate-py-to-ts-rust-v2-notes/apify-monorepo-deploy.md` — Dockerfile, actor.json, pnpm deploy.
- `../migrate-py-to-ts-rust-v2-notes/v1-lessons-codified.md` — lessons turned into per-step checks.
- `../migrate-py-to-ts-rust-v2-notes/cross-repo-followup.md` — what the final step writes for `/r/tools/`.

Recurring constraints (do not regress in any step):

- Source repo `/Users/miroslavsekera/r/contextractor/` is read-only.
- Apify deploy: `glueo/contextractor-test` only. Production `glueo/contextractor` must not be pushed.
- `actor.json.name` MUST be `contextractor-test`. The `Step ACTOR_NAME_GUARD` in `.claude/commands/platform/push-and-get-working.md` is the existing safety net; do not regress it.
- Supported output formats: `txt | markdown | json | html`. No `xml`, no `xmltei`.
- TS engine config no-op fields dropped: `pruneXpath`, `dateExtractionParams`. Do not drop `teiValidation` or `withMetadata`.
- "Built on rs-trafilatura and Crawlee" wording in every README, Actor description, spec, and CLAUDE.md.
- After each step, run the matching `../tests/step-test-{name}.md` before moving to the next.

## Step list

- `step-prepare-workspace.md` — clean v1 build leftovers; pnpm + Cargo workspace skeleton; root `package.json`, `pnpm-workspace.yaml`, `Cargo.toml`, `tsconfig.json`, `biome.json` with the required ignore set; `.gitignore` and `.npmrc`.
- `step-build-napi-binding.md` — `packages/contextractor-engine/native/` Cargo crate wrapping `rs-trafilatura` 0.2.x with napi-rs macros. Strict Cargo lints. Bare `Result<T>`. Local `darwin-arm64` prebuild. Delete the Python `packages/contextractor_engine/` original.
- `step-prebuild-platforms-and-ci.md` — cross-platform prebuild (`darwin-arm64`, `darwin-x64`, `linux-x64-gnu`, `linux-arm64-gnu`); commit binaries under `packages/contextractor-engine/native/npm/<platform>/`; add `.github/workflows/build-napi.yml`.
- `step-port-engine-to-ts.md` — TS `@contextractor/engine` package mirroring the Python API; drop `xml`, `xmltei`, `pruneXpath`, `dateExtractionParams`; vitest tests.
- `step-rename-and-port-apify-actor.md` — `git mv apps/contextractor apps/contextractor-apify`; TS port; new `.actor/` schemas; Node + Playwright multi-stage Dockerfile; `actor.json.name = contextractor-test`, `dockerContextDir = ../../..`.
- `step-add-standalone-cli.md` — TS CLI port; drop PyInstaller / npm artifacts; drop `xml` and `xmltei` from `FORMAT_EXTENSIONS`.
- `step-port-tools-tests.md` — `tools/generated-unit-tests/` as a vitest package; copy `fixtures/` verbatim; update `.claude/commands/platform-tests/generate-unit-tests.md` to emit vitest.
- `step-update-docs-and-readmes.md` — propagate `docs/` (skip `pypi-trusted-publishing.md`); rewrite all READMEs with the `rs-trafilatura` + Crawlee wording; strip PyPI / npm references.
- `step-run-sync-commands.md` — run `/sync/docs` and `/sync/gui`; fix any drift they surface.
- `step-local-and-platform-tests.md` — full local suite (`pnpm -r build / test / lint`, `cargo test`, `cargo clippy`); `apify run` smoke; `apify push` to `glueo/contextractor-test`; platform-test-runner suite.
- `step-generate-r-tools-prompt.md` — emit (do not execute) a structured prompt under `/Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-rewrite/`.
