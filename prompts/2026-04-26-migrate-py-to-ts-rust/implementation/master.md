# Migrate `contextractor-ts` from Python to Rust + TypeScript

## TLDR

Port the Python `contextractor` codebase at `/Users/miroslavsekera/r/contextractor/` into the Rust + TypeScript shell at `/Users/miroslavsekera/r/contextractor-ts/`. Replace `trafilatura` (PyPI) with `rs-trafilatura` (crates.io). Rename `apps/contextractor` → `apps/contextractor-apify`, add `apps/contextractor-standalone`, port the engine to Rust, propagate schemas/docs/tools, drop XML/XML-TEI output, switch the canonical Apify owner to `glueo`, run local + Apify tests, and author a sibling propagation prompt for the `/r/tools/` repo.

## Skills and Agents

Activate during execution:

- `rust` — anything touching Rust source or `Cargo.toml`.
- `async-rust-patterns` — engine and binary tokio code.
- `rust-testing-patterns` — Rust integration tests under `tools/generated-unit-tests/`.
- `rust-packaging` — workspace `Cargo.toml`, lints, semver.
- `apify-actor-development` — `.actor/` schemas, Dockerfile, Actor entrypoint conventions.
- `apify-actorization` — converting Python actor logic to a new stack.
- `apify-schemas` — input / output / dataset schema edits.
- `apify-ops` — local + cloud builds, runs, dataset access for tests.

Implementer / reviewer agents:

- `rust-pro` — primary implementer for Rust code (engine, binaries).
- `ts-pro` — TS test orchestrator and any Apify TS shim.
- `code-reviewer` — final review across Rust + TS diffs.
- `test-runner` — format, lint, unit, integration, smoke runs.

## Step list (run in order)

- `step-engine-port.md` — port `packages/contextractor_engine` from Python to Rust on top of `rs-trafilatura`. Decide chromiumoxide vs. TS-side Playwright fallback up front.
- `step-rename-app.md` — `git mv apps/contextractor apps/contextractor-apify` and update every reference (CLAUDE.md, sync commands, READMEs, Dockerfile, workspace manifests).
- `step-port-apify-app.md` — replace target `apps/contextractor-apify/` Python sources with Rust binary + Apify glue mirroring source Actor functionality.
- `step-add-standalone-app.md` — propagate `apps/contextractor-standalone/` (Python) to a Rust CLI binary with an `npm/` distribution wrapper.
- `step-propagate-schemas.md` — propagate `apps/contextractor-apify/.actor/` schemas with the XML/XML-TEI toggles dropped, PyPI mention removed, and Rust-binary defaults applied.
- `step-port-tools.md` — keep `tools/platform-test-runner/` as TS; rewrite `tools/generated-unit-tests/` from pytest to Cargo integration tests reusing the source's HTML fixtures.
- `step-propagate-docs.md` — propagate `docs/` and every README from source, dropping Python-only docs (e.g. `pypi-trusted-publishing.md`) and rewriting code samples to Rust + TS.
- `step-switch-apify-owner.md` — replace every `shortc/contextractor*` reference in the target repo with `glueo/contextractor*`.
- `step-run-sync-commands.md` — run `/sync:gui` then `/sync:docs` and reconcile any consistency findings.
- `step-run-tests.md` — run local Rust + TS tests, then `apify push` to `glueo/contextractor-test` and execute platform tests; do **not** push to production.
- `step-write-sibling-prompt.md` — author a full structured prompt at `/Users/miroslavsekera/r/tools/prompts/2026-04-26-propagate-contextractor-ts-changes/` covering `contextractor-site`, `contextractor-api`, `distributed-packages/contextractor-engine`, and `.claude/commands/projects/contextractor`.
- `step-review.md` — review every prior step's diff, run all tests + builds, verify all `user-entry-log/` requirements are covered, and auto-fix gaps.

## Shared context

- Source repo: `/Users/miroslavsekera/r/contextractor/` (Python, canonical functionality).
- Target repo: `/Users/miroslavsekera/r/contextractor-ts/` (this repo).
- Sibling target: `/Users/miroslavsekera/r/tools/`.
- Engine: `rs-trafilatura` 0.2.2 (crates.io). API and gaps documented in `../migrate-py-to-ts-rust-notes/rs-trafilatura-api.md`.
- Architecture decision: `../migrate-py-to-ts-rust-notes/architecture-decision.md`.
- Repo state snapshot: `../migrate-py-to-ts-rust-notes/repo-state-snapshot.md`.
- PyPI deprecation matrix: `../migrate-py-to-ts-rust-notes/pypi-deprecation.md`.
- User intent: `../user-entry-log/entry-initial-prompt.md`.
- Decisions:
  - `../user-entry-log/entry-qa-format-gap.md` — drop XML and XML-TEI.
  - `../user-entry-log/entry-qa-apify-owner.md` — canonical owner is `glueo`.
  - `../user-entry-log/entry-qa-rename-scope.md` — rename app dir and update all references.
  - `../user-entry-log/entry-qa-sibling-prompt.md` — full structured sibling prompt.

## Constraints

- No deployment to `glueo/contextractor` (production). Tests run against `glueo/contextractor-test` only.
- No PyPI artefacts produced; no `pyproject.toml`, `uv.lock`, or `.venv` left in the target repo after migration.
- Schema changes are conservative — never silently drop a field that has a Rust counterpart; surface for review (per `.claude/commands/sync/gui.md` Step REPORT semantics).
- Follow `.claude/rules/no-confirmation-prompts.md`, `.claude/rules/json-config-only.md`, `.claude/rules/minimal-diff.md`, `.claude/rules/formatting-guidelines.md`.
