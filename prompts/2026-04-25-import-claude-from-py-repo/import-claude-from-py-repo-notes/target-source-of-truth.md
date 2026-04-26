# Target Repo Source-of-Truth Files

Reference for the ported `sync/docs.md`, `sync/gui.md`, and `git/release.md` commands. The CLAUDE.md describes the target as a Rust binary + TypeScript tooling Apify Actor; the actual codebase is still partly Python (mid-migration). The ported commands target the *Rust + TS* surface that CLAUDE.md commits to, not the legacy Python.

## Rust workspace (planned / partial)

Per CLAUDE.md project structure:

- `apps/contextractor/` — Rust binary Apify Actor
  - `apps/contextractor/.actor/` — `actor.json`, `input_schema.json`, `output_schema.json`, `dataset_schema.json`, `Dockerfile`
  - `apps/contextractor/src/` — `main.rs` and supporting modules (planned)
- `packages/contextractor_engine/` — Rust library wrapping `rs-trafilatura`
  - `packages/contextractor_engine/src/lib.rs` (planned)

A Cargo workspace root (`Cargo.toml`) does not yet exist. The ported `git/release.md` should target `Cargo.toml` files once they exist; for now it should fail gracefully with a message identifying which files are missing rather than guess.

## TypeScript workspace

- `tools/platform-test-runner/` — TypeScript / Node test orchestrator
  - `tools/platform-test-runner/package.json`
- `tools/generated-unit-tests/` — Rust integration tests + HTML fixtures (despite the name, this is Rust)

## Apify Actor schemas (always JSON)

Source-of-truth for input fields, dataset rows, and output URLs:

- `apps/contextractor/.actor/actor.json`
- `apps/contextractor/.actor/input_schema.json`
- `apps/contextractor/.actor/output_schema.json`
- `apps/contextractor/.actor/dataset_schema.json`

These files are referenced by both the Rust binary and any TS tooling that needs to validate runs.

## Documentation files

- `README.md` (repo root) — primary user-facing doc
- `apps/contextractor/README.md` — Actor-specific README per CLAUDE.md
- `CLAUDE.md` — agent instructions

The ported `sync/docs.md` keeps these in sync with the Rust CLI flags (once defined) and the Apify input schema.

## What "all similar cases, rust and typescript" means here

Where the source command reads a single Python file as canonical, the ported version reads:

- the Rust source file holding the equivalent struct / enum / config
- the TS file holding the equivalent type / Zod schema (if any)
- the JSON schema (`input_schema.json`, etc.) where applicable

…and verifies all three are mutually consistent.

## Distribution channels for `git/release.md`

Target ships only to Apify (`glueo/contextractor` prod, `glueo/contextractor-test` test). No npm, no PyPI, no crates.io publishing is set up. The ported `git/release.md` is a version-bump-and-tag flow only — version sync across `Cargo.toml`s and `package.json`, then tag + push. Actual deployment remains `apify push` via `commands/platform/push-and-get-working.md`.
