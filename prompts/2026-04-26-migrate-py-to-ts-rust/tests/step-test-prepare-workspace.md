# Test — prepare-workspace

## TLDR

Review the diff from `implementation/step-prepare-workspace.md`. Verify the Python uv workspace is gone and a pnpm + Cargo skeleton stands. Auto-fix any deviation.

## Inputs

- `../implementation/step-prepare-workspace.md`
- `../migrate-py-to-ts-rust-notes/target-state-snapshot.md`

## Review

- `git diff` should touch only root config: `pyproject.toml`, `uv.lock`, `package.json`, `pnpm-workspace.yaml`, `Cargo.toml`, `tsconfig.json`, `biome.json`, `.gitignore`, optionally `.npmrc`, `pnpm-lock.yaml`. **Anything else is scope creep — fix.**
- `pyproject.toml` and `uv.lock` must be deleted, not modified.
- `package.json` declares `"private": true`; pnpm workspace covers `apps/*`, `packages/*`, `packages/*/native`, `tools/*`.
- `Cargo.toml` `[workspace]` parses; the napi-rs member may be deferred to the next step but the file must exist and `cargo metadata` must succeed.
- `.gitignore` does not contain Python entries (`__pycache__`, `*.egg-info`, `.venv`, `dist/*.whl`).

## Verify

- `pnpm install` exits 0.
- `cargo metadata --format-version=1 >/dev/null` exits 0.
- `git ls-files | xargs grep -l 'pyproject\\.toml\\|uv\\.lock' | grep -v '^prompts/'` returns nothing.

## Auto-fix

If any check fails, patch the offending file with `Edit` and rerun the verifier. Do not leave the suite red.
