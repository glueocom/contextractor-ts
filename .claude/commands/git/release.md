---
description: Synchronized version bump across Rust + TypeScript packages, then tag and push (no publishing — Apify deploy is separate).
allowed-tools: Bash(git:*), Bash(cargo:*), Bash(find:*), Bash(jq:*), Bash(grep:*), Bash(rg:*), Bash(awk:*), Bash(sed:*), Read, Edit, Write, Glob, Grep
---

Cut a release of contextractor by syncing the version across every TypeScript `package.json` and the single napi-rs `Cargo.toml`, then tagging and pushing. **No publishing.** This Actor ships only to Apify (`glueo/contextractor` prod, `glueo/contextractor-test` test) — deployment is a separate step via `/platform:push-and-get-working`.

## Steps

### 1. DETERMINE the next version

- Canonical version source order:
  - `packages/contextractor-engine/package.json` (the engine drives the release cadence).
  - `packages/contextractor-engine/native/Cargo.toml` (the napi-rs crate must match).
- If `$ARGUMENTS` is a version string (`X.Y.Z` or `vX.Y.Z`), use it (strip any leading `v`).
- Otherwise read the current version from the canonical engine `package.json` and bump the patch component (`0.3.12` → `0.3.13`).
- If the canonical manifest is missing, **stop** with a clear message and exit cleanly. Do not guess a starting version.

### 2. UPDATE every manifest

Enumerate at runtime — do not hardcode paths:

- TypeScript: `find apps packages tools -type f -name 'package.json' -not -path '*/node_modules/*' -not -path '*/dist/*'`
  - For each, set `"version": "X.Y.Z"` (use `jq` for safety; preserve formatting where possible). Skip the root `package.json` (`contextractor-workspace`).
- Rust: only the napi-rs crate at `packages/contextractor-engine/native/Cargo.toml` carries a version.
  - Set `version = "X.Y.Z"` in its `[package]` table.

If any expected manifest is unreadable or malformed, list it and **stop** rather than skip.

### 3. COMMIT the version bump

- Stage **only** the manifest files changed in step 2 (`git add <paths>`).
- Commit subject: `Release vX.Y.Z`.
- Do **not** add a `Co-Authored-By` footer (per `.claude/rules/no-confirmation-prompts.md` and the existing project convention in `.claude/commands/git/commit.md`).

### 4. TAG and push

- `git tag vX.Y.Z`
- `git push && git push origin vX.Y.Z`

### 5. REPORT

- Print the new tag (`vX.Y.Z`).
- Print the GitHub Actions URL: `<TODO once CI exists>`.
- Print a one-line reminder: deployment to Apify is **separate** — run `/platform:push-and-get-working` (add `--production` to push to `glueo/contextractor` instead of `glueo/contextractor-test`).
