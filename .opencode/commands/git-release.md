---
description: Synchronized version bump across Rust + TypeScript packages, then tag and push (no publishing — Apify deploy is separate).
---

Cut a release of contextractor by syncing the version across every TypeScript `package.json` and the napi-rs `Cargo.toml`, then tagging and pushing. **No publishing.** This Actor ships only to Apify (`glueo/contextractor` prod, `glueo/contextractor-test` test) — deployment is a separate step via `/platform:push-and-get-working`.

## Steps

### Step DETERMINE: Pick the next version

- Canonical manifest order:
  - Workspace root `package.json` (private, version-bearing) if it pins one.
  - Otherwise the per-package `package.json` files under `apps/` and `packages/` plus the single Rust crate at `packages/extraction/native/Cargo.toml`.
- If `$ARGUMENTS` is a version string (`X.Y.Z` or `vX.Y.Z`), use it (strip any leading `v`).
- Otherwise read the current version from the canonical TS manifest and bump the patch component (`0.1.0` → `0.1.1`).
- If no manifest exists yet, **stop** with a clear message listing the missing files and exit cleanly. Do not guess a starting version.

### Step UPDATE: Update every manifest

Enumerate at runtime — do not hardcode paths:

- TypeScript: `find . -type f -name 'package.json' -not -path '*/node_modules/*' -not -path '*/dist/*'`
  - For each, set `"version": "X.Y.Z"` (use `jq` for safety; preserve formatting where possible).
- Rust (only the napi-rs crate): `find packages -type f -name 'Cargo.toml' -not -path '*/target/*'`
  - For each, set `version = "X.Y.Z"` in the `[package]` table.

If any expected manifest is unreadable or malformed, list it and **stop** rather than skip.

### Step COMMIT: Commit the version bump

- Stage **only** the manifest files changed in Step UPDATE (`git add <paths>`).
- Also stage `pnpm-lock.yaml` if `pnpm install` updated it during the bump.
- Commit subject: `Release vX.Y.Z`.
- Do **not** add a `Co-Authored-By` footer (per `.claude/rules/no-confirmation-prompts.md` and the existing project convention in `.claude/commands/git/commit.md`).

### Step TAG: Tag and push

- `git tag vX.Y.Z`
- `git push && git push origin vX.Y.Z`

### Step REPORT: Report

- Print the new tag (`vX.Y.Z`).
- Print the GitHub Actions URL: `<TODO once CI exists>`.
- Print a one-line reminder: deployment to Apify is **separate** — run `/platform:push-and-get-working` (add `--production` to push to `glueo/contextractor` instead of `glueo/contextractor-test`).
