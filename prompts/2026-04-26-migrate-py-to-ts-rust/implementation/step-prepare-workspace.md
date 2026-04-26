# Step prepare-workspace

## TLDR

Replace the Python uv workspace at the target repo root with a pnpm + Cargo workspace skeleton. Touches: `/Users/miroslavsekera/r/contextractor-ts/{pyproject.toml, uv.lock, package.json, pnpm-workspace.yaml, Cargo.toml, biome.json, .gitignore, .npmrc}`. Adds Biome, vitest, TypeScript, `@napi-rs/cli`. Does not yet touch `apps/`, `packages/`, or `tools/` contents.

## Skills and agents

- `apify-ops` — local build assumptions.
- Agent: `ts-pro` to scaffold; `code-reviewer` to review.

## Inputs

- Read `../migrate-py-to-ts-rust-notes/target-state-snapshot.md` for the current root layout.
- Read `../user-entry-log/entry-qa-rust-bridge.md` for the napi-rs decision (informs `@napi-rs/cli` install).

## Actions

- Delete `pyproject.toml` and `uv.lock` at repo root.
- Add `package.json` at repo root declaring `"private": true`, scripts: `build`, `test`, `lint`, `format`. Use `pnpm` workspaces.
- Add `pnpm-workspace.yaml` with `packages: ["apps/*", "packages/*", "packages/*/native", "tools/*"]`.
- Add `Cargo.toml` at repo root with `[workspace] members = ["packages/contextractor-engine/native"]` (member added in `step-build-napi-binding`; keep the entry commented or omit until that step — pick one and document).
- Add root `tsconfig.json` (strict) and `biome.json` (Biome config matching contextractor-ts conventions: 4-space or 2-space — read existing `tools/platform-test-runner` to stay consistent).
- Add `.npmrc` if needed for napi-rs prebuild fetch.
- Update `.gitignore`: drop Python entries (`__pycache__`, `*.egg-info`, `.venv`, `dist/*.whl`); add Node entries (`node_modules/`, `*.tsbuildinfo`, `.turbo/`); add `target/` for Cargo.
- Run `pnpm install` to materialize the lockfile. Commit `pnpm-lock.yaml`.

## Constraints

- Do not yet rename or rewrite anything inside `apps/`, `packages/`, or `tools/` — those steps remain Python-shaped at this point and will simply be excluded from the workspace until later steps.
- Add an explicit "phase 1: skeleton only" note at the top of `package.json` via a `"description"` field so reviewers know subsequent steps will fill it in.

## Done when

- `git status` shows the root config swap and nothing inside `apps/`, `packages/`, or `tools/`.
- `pnpm install` succeeds.
- `cargo metadata --format-version=1 >/dev/null 2>&1` succeeds (workspace parses; empty members allowed).
- The matching `tests/step-test-prepare-workspace.md` passes.
