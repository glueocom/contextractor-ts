---
name: autonomous:maintenance:deps:update
description: WHEN updating all pnpm and Cargo dependencies to their latest compatible versions. WHEN-NOT for security-specific fixes; use autonomous:maintenance:test:deps-autofix for that.
allowed-tools: Bash(pnpm:*), Bash(cargo:*)
model: haiku
disable-model-invocation: true
---

Update all dependencies to their latest compatible versions.

## Step NPM: Update pnpm packages

```bash
pnpm update --latest --recursive
```

## Step RUST: Update Cargo lockfile

```bash
cargo update
```

## Step VERIFY: Confirm builds pass

```bash
pnpm build
cargo build --workspace
```
