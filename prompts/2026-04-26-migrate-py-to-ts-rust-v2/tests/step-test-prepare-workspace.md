# Test step prepare-workspace

## TLDR

Reviews `../implementation/step-prepare-workspace.md`. Verifies workspace skeleton, leftover cleanup, root configs, and `cargo metadata` parses with the stub crate. Auto-fixes drift.

## Inputs

- `../implementation/step-prepare-workspace.md`.
- `../migrate-py-to-ts-rust-v2-notes/target-state-snapshot.md`.
- `../migrate-py-to-ts-rust-v2-notes/v1-lessons-codified.md`.

## Verification

Run each check; auto-fix any failure by editing the offending file or running the missing command.

- `git status --porcelain` shows root config swap + napi-rs stub crate; no leftovers under `apps/contextractor-apify/`, `apps/contextractor-standalone/`, `packages/contextractor-engine/{dist,node_modules}`.
- `npm ci` succeeds.
- `workspaces` array in root `package.json` includes `apps/*`, `packages/*`, `packages/*/native`, `packages/*/native/npm/*`, `tools/*`.
- Root `package.json` declares `"private": true`, `packageManager: "npm@10.0.0"`, scripts for `build/test/lint/format/check` fanning out via `npm run <script> -ws --if-present`.
- `Cargo.toml` at root: `[workspace] members = ["packages/contextractor-engine/native"]`, `resolver = "2"`.
- Stub crate exists at `packages/contextractor-engine/native/{Cargo.toml, src/lib.rs}`.
- `cargo metadata --format-version=1 >/dev/null 2>&1` succeeds.
- Root `tsconfig.json` strict; `exactOptionalPropertyTypes` is `false` or unset.
- `biome.json` ignores include `.claude/**`, `prompts/**`, `**/fixtures/**`, `**/test-suites/**`, `**/test-suites-output/**`, `**/*.node`, `packages/contextractor-engine/native/index.{js,d.ts}`, `packages/contextractor-engine/native/npm/**`.
- `.gitignore` has Node entries (`node_modules/`, `*.tsbuildinfo`, `dist/`), Cargo `target/`, no Python `__pycache__` / `.venv` / `*.egg-info` / `dist/*.whl`.
- Root `pyproject.toml` and `uv.lock` are gone.
- Apify CLI ≥ 1.4 (`apify --version`), Node 22+, npm 10+ — surface a clear error if missing.

## Auto-fix examples

- Missing dev dep → `npm install -D <pkg>`.
- Wrong `tsconfig` flag → edit and rerun.
- Leftover dir → `rm -rf` it (only inside the v1-leftover allow-list).
- Missing stub crate → recreate it.

## Done when

All checks pass. No remaining auto-fixes needed.
