# Step prepare-workspace

## TLDR

Replace the Python uv workspace at the target repo root with a npm + Cargo workspace skeleton. Clean up untracked v1 build leftovers. Touches root configs only — does not yet rewrite `apps/`, `packages/`, or `tools/` contents beyond a napi-rs stub crate that lets `cargo metadata` parse on day one.

## Skills and Agents

- Skills: `apify-ops` (local build assumptions only).
- Agents: `ts-pro` to scaffold; `code-reviewer` to review the diff.

## Reference reading

- `../user-entry-log/entry-initial-prompt.md` (root-config rewrite, prereqs).
- `../migrate-py-to-ts-rust-v2-notes/target-state-snapshot.md` (current root layout + clutter to clean).
- `../migrate-py-to-ts-rust-v2-notes/v1-lessons-codified.md` (Cargo workspace stub, vitest `--passWithNoTests`, Biome ignores, prereqs).
- `../migrate-py-to-ts-rust-v2-notes/napi-rs-monorepo-prebuilds.md` (workspace member globs).

## Actions

### Clean v1 leftovers

- `rm -rf packages/contextractor-engine/{dist,node_modules,native}` — untracked v1 artifacts.
- `rm -rf apps/contextractor-apify/{dist,node_modules,storage,apps}` — untracked v1 artifacts plus stray `apps/` subdirectory.
- `rm -rf apps/contextractor-standalone/{dist,node_modules}` — untracked v1 artifacts.
- `rm -rf node_modules target` at repo root.
- Do **not** delete tracked Python sources (`apps/contextractor/`, `packages/contextractor_engine/`, `pyproject.toml`, `uv.lock`, `Dockerfile`, `tools/generated-unit-tests/`) — later steps move/replace them with `git mv` so history is preserved.

### Root-config rewrite

- Delete `pyproject.toml` and `uv.lock` at repo root.
- Add `package.json` at repo root: `"private": true`, packageManager pinned to `npm@10.0.0`, `"workspaces": ["apps/*", "packages/*", "packages/*/native", "packages/*/native/npm/*", "tools/*"]`, scripts `build`, `test`, `lint`, `format`, `check` that fan out via `npm run <script> -ws --if-present`. The double `native` + `native/npm/*` entries are required because the napi-rs `npm/<platform>/` packages are workspace members (see `napi-rs-monorepo-prebuilds.md`).
- Add `Cargo.toml` at repo root with `[workspace] members = ["packages/contextractor-engine/native"]` and `resolver = "2"`. Create the stub crate at `packages/contextractor-engine/native/{Cargo.toml, src/lib.rs}` with a one-line `pub fn placeholder() {}` so `cargo metadata` parses. The next step replaces the stub with the real wrapper.
- Add root `tsconfig.json` (strict, but `exactOptionalPropertyTypes: false` per `v1-lessons-codified.md` — the napi-rs binding is incompatible with `true`).
- Add `biome.json` with the ignore set required for this repo: `.claude/**`, `prompts/**`, `**/fixtures/**`, `**/test-suites/**`, `**/test-suites-output/**`, `**/*.node`, `packages/contextractor-engine/native/index.{js,d.ts}`, `packages/contextractor-engine/native/npm/**`. Use Biome 2.x defaults otherwise.
- Add `.npmrc` if needed for napi-rs prebuild resolution — at minimum `auto-install-peers=true`, `enable-pre-post-scripts=true`.
- Update `.gitignore`: drop Python entries (`__pycache__`, `*.egg-info`, `.venv`, `dist/*.whl`); add Node entries (`node_modules/`, `*.tsbuildinfo`, `.turbo/`, `dist/`); add Cargo `target/`. Keep `__pypackages__/` block (already present).

### Install dev tooling

- `npm install` to materialize `package-lock.json`.
- `npm install -D typescript @biomejs/biome vitest @napi-rs/cli @types/node` (workspace-root dev deps; the napi-rs CLI is needed by the next step).

## Constraints

- Do not yet rename or rewrite anything inside `apps/`, `packages/contextractor_engine/`, or `tools/generated-unit-tests/`.
- Do not yet add the real napi-rs source — only the stub crate that satisfies `cargo metadata`.
- Local prereqs: Rust toolchain via `rustup`, Apify CLI ≥ 1.4, Node 22+, npm 10+. If any is missing, abort the step and surface the missing tool.

## Done when

- `git status` shows only the root config swap and the napi-rs stub crate.
- `npm install` succeeds; lockfile committed.
- `cargo metadata --format-version=1 >/dev/null 2>&1` succeeds.
- `biome check .` passes (or reports only files outside the ignore set, intentionally — ignore set respected).
- The matching `../tests/step-test-prepare-workspace.md` passes.
