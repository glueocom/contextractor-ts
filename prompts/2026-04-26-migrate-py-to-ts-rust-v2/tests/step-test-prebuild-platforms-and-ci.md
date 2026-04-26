# Test step prebuild-platforms-and-ci

## TLDR

Reviews `../implementation/step-prebuild-platforms-and-ci.md`. Verifies that the four platform packages exist with committed `.node` binaries, `optionalDependencies` resolve to workspace packages, and `.github/workflows/build-napi.yml` is valid.

## Inputs

- `../implementation/step-prebuild-platforms-and-ci.md`.
- `../user-entry-log/entry-qa-prebuild-distribution.md`.
- `../user-entry-log/entry-qa-ci-scope.md`.
- `../migrate-py-to-ts-rust-v2-notes/napi-rs-monorepo-prebuilds.md`.

## Verification

- `packages/contextractor-engine/native/npm/{darwin-arm64,darwin-x64,linux-x64-gnu,linux-arm64-gnu}/` each contain:
  - `package.json` with `name`, `version`, `main`, `files`, `os`, `cpu` (and `libc` for linux), `private: true`.
  - The matching `contextractor-engine-native.<platform>.node` binary.
  - All four are tracked in git (`git ls-files | grep '\.node$'` lists exactly four files).
- `packages/contextractor-engine/native/package.json` `optionalDependencies` lists all four `@contextractor/engine-native-<platform>: workspace:*`.
- `pnpm install` keeps the lockfile minimal (no entries for unpublished `@contextractor/*` packages).
- `node -e "require('@contextractor/engine-native')"` succeeds on the host (resolves to the matching prebuild).
- `.github/workflows/build-napi.yml` exists. Parse-check with `actionlint` (or `python -m yaml`); verify trigger is `push: tags: ["v*"]` and `workflow_dispatch`; verify the matrix lists all four targets.
- Workflow does **not** run lint/test/security beyond napi-rs build (per `entry-qa-ci-scope.md`).

## Auto-fix examples

- Missing `os` field on a per-platform package.json — add it.
- `.node` not tracked — `git add` it.
- Workflow uses outdated action versions — bump to current pins.
- Workflow runs unrelated jobs — strip them.

## Done when

All four prebuilds resolve via `optionalDependencies`. The workflow is valid and scoped to napi-rs builds only.
