---
name: apify-ops
description: Apify platform operations including builds, runs, storage, and deployment. Use for managing Actor builds, monitoring runs, accessing datasets/key-value stores, and diagnosing errors on the Apify platform.
---

# Apify Platform Operations

One path per operation. `mcpc` for the operations the `mcp.apify.com` server exposes; `apify` CLI for everything else (local dev and remote ops not covered by mcpc).

## One-time setup

```bash
npm install -g @apify/mcpc                                 # Install mcpc (≥ v0.2.6)
mcpc login mcp.apify.com                                   # OAuth, stores creds in OS keychain
mcpc connect mcp.apify.com @apify                          # Persistent session named @apify
```

After this, every example below uses the short `mcpc @apify ...` form. Verify the session with `mcpc @apify` (prints server info).

## Path Selection

| Operation | Path |
|-----------|------|
| Search Actors, fetch Actor README/schema | `mcpc` |
| Call an Actor (run + wait or async) | `mcpc` |
| Get a specific run's metadata (`runId` known) | `mcpc` |
| Get a run's output dataset items (`datasetId` known) | `mcpc` |
| Search and fetch Apify docs | `mcpc` |
| List recent runs / stream a run's log | `apify` CLI (`apify runs ls|log`) |
| Builds (list, info, log, create) | `apify` CLI (`apify builds *`) |
| Free-standing dataset / KV store inspection | `apify` CLI (`apify datasets|key-value-stores ...`) |
| Local dev (run, push, login, info) | `apify` CLI |

`mcp.apify.com` v0.9.20 currently exposes 8 tools. Anything not listed in `references/mcpc-tools.md` is not available via mcpc.

## Get Actor Identity

Read actor name from `.actor/actor.json`. Use `apify info` to get username for the full actor ID (`username/actor-name`).

## Remote Operations via mcpc

See [references/mcpc-tools.md](references/mcpc-tools.md) for full mcpc tool reference.

**Quick reference:**
- `call-actor` — run any Actor (two-step: info → call)
- `get-actor-run` — run metadata by `runId`
- `get-actor-output` — run output items by `datasetId`
- `search-actors` / `fetch-actor-details` — discover Actors
- `search-apify-docs` / `fetch-apify-docs` — documentation

## Local Development and Remote Ops via apify CLI

See [references/cli-commands.md](references/cli-commands.md) for full CLI reference.

**Quick reference:**
```bash
# Local dev
apify run                            # Run locally
apify push                           # Deploy
apify login                          # Authenticate
apify info                           # Identity check

# Remote ops (no mcpc equivalent)
apify runs ls <actorId>              # List runs
apify runs log <runId>               # Stream run log
apify builds ls --limit 5            # List builds
apify builds log <buildId>           # Build log
apify datasets ls                    # List datasets
apify datasets get-items <id>        # Download dataset items
apify key-value-stores ls            # List KV stores
apify key-value-stores get-value <id> <key>
```

## Common Workflows

### Fix Build Errors (Git-based)

- **Commit and push** — Stage, commit, and push changes to Git
- **Wait for auto-build** — Apify webhook triggers build from Git
- **Check build status** — `apify builds ls --limit 3` until latest is `SUCCEEDED` or `FAILED`
- **If failed:** `apify builds log <buildId>`, fix locally, repeat from start

### Diagnose Failed Run

- **Get run info** — `mcpc --json @apify tools-call get-actor-run runId:="<runId>"`
- **Check log** — `apify runs log <runId>` (no mcpc equivalent for run logs)
- **Review input** — `apify key-value-stores get-value <storeId> INPUT`
- **Analyze output** — `mcpc --json @apify tools-call get-actor-output datasetId:="<datasetId>" limit:=20`

### Access Run Output

- **Get run details** — `mcpc --json @apify tools-call get-actor-run runId:="<runId>"` to obtain `defaultDatasetId`
- **Fetch items** — `mcpc --json @apify tools-call get-actor-output datasetId:="<datasetId>" limit:=100 fields:="title,url"`

## Common Error Types

| Error Type | Location | Fix |
|------------|----------|-----|
| Schema validation | `*_schema.json` | Check JSON Schema format |
| Dataset schema | `dataset_schema.json` | Ensure `fields` is JSON Schema |
| Dockerfile | `Dockerfile` | Check base image, dependencies |
| Cargo dependencies | `Cargo.toml` | Verify versions, run `cargo update` and `cargo build --workspace` |
| Rust compile error | `src/*.rs` | Read full diagnostic, fix types, run `cargo check --workspace --all-targets` |
| Cargo lints | `src/*.rs` | Run `cargo clippy --workspace --all-targets -- -D warnings` |
| TS dependencies | `package.json` | Verify versions, run `pnpm install --frozen-lockfile` |
| TypeScript types | `tools/**/*.ts` | Run `tsc --noEmit`, fix type errors |
| Biome lint | `tools/**/*.ts` | Run `biome check --write tools/` |

## Prerequisites

- `mcpc` ≥ v0.2.6 with `@apify` session connected (see one-time setup above)
- Apify CLI installed (`brew install apify-cli` on macOS, or `npm install -g apify-cli`) for local dev and operations not exposed by mcpc
- `APIFY_TOKEN` env var set for `apify-client` SDK and CLI fallback paths
