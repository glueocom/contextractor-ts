---
description: Synchronized version bump across Rust + TypeScript packages, then tag and push (no publishing — Apify deploy is separate).
allowed-tools: Bash(git:*), Bash(cargo:*), Bash(find:*), Bash(jq:*), Bash(grep:*), Bash(rg:*), Bash(awk:*), Bash(sed:*), Read, Edit, Write, Glob, Grep
---

Cut a release of contextractor by syncing the version across every Rust and TypeScript manifest, then tagging and pushing. **No publishing.** This Actor ships only to Apify (`shortc/contextractor` prod, `shortc/contextractor-test` test) — deployment is a separate step via `/platform:push-and-get-working`.

## Steps

### 1. DETERMINE the next version

- Canonical Rust manifest order:
  1. `Cargo.toml` (workspace root) if present.
  2. Otherwise the per-crate manifests under `apps/` and `packages/` (e.g. `apps/contextractor/Cargo.toml`, `packages/contextractor_engine/Cargo.toml`).
- If `$ARGUMENTS` is a version string (`X.Y.Z` or `vX.Y.Z`), use it (strip any leading `v`).
- Otherwise read the current version from the canonical Rust manifest and bump the patch component (`0.1.0` → `0.1.1`).
- If no Rust manifest exists yet, **stop** with a clear message listing the missing files and exit cleanly. Do not guess a starting version.

### 2. UPDATE every manifest

Enumerate at runtime — do not hardcode paths:

- Rust: `find . -type f -name 'Cargo.toml' -not -path './target/*' -not -path './node_modules/*'`
  - For each, set `version = "X.Y.Z"` in the `[package]` (or `[workspace.package]`) table.
- TypeScript: `find tools -type f -name 'package.json' -not -path '*/node_modules/*'`
  - For each, set `"version": "X.Y.Z"` (use `jq` for safety; preserve formatting where possible).

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
- Print a one-line reminder: deployment to Apify is **separate** — run `/platform:push-and-get-working` (add `--production` to push to `shortc/contextractor` instead of `shortc/contextractor-test`).
