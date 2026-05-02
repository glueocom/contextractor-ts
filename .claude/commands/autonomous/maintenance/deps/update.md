---
description: Update all packages to latest — pnpm workspaces and Rust (cargo update)
allowed-tools: Bash(pnpm:*), Bash(cargo:*)
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
