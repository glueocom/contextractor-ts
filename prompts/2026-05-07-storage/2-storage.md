# Add Crawlee-backed storage layer to contextractor (npm-only)

> **TLDR**: Adds Crawlee-backed storage (Dataset + KeyValueStore) and new CLI subcommands for extracting and consuming data. Uses Crawlee's native Dataset and KeyValueStore directly; re-exports them from the library. No HTTP server.

## Context

`contextractor` is a TypeScript/Node CLI that wraps `rs-trafilatura` via a napi-rs native addon (`@contextractor/extraction-native`, distributed via npm `optionalDependencies`) for web content extraction. Today it writes extracted content to a local output directory (default `./output`). We want to add a persistent storage layer using Crawlee's native `Dataset` and `KeyValueStore`, so the CLI surface works in two transports:

1. **stdout** — pipe-friendly default, today's behaviour preserved.
2. **Volume-backed local storage** — append-only `Dataset` + mutable `KeyValueStore` on disk, using Crawlee's `@crawlee/memory-storage` on-disk layout.

The research that motivates these decisions lives in `./research/` next to this prompt — read those files before designing anything; they cover trade-offs, gotchas, and concrete numbers that aren't repeated here.

## Before you write any code: ground in the codebase

This prompt is intentionally codebase-agnostic. **Do not assume layout, build tooling, or existing CLI structure.** First:

1. `ls` the repo root, find the package.json, read `bin` / `main` / `exports`, and identify how the CLI entrypoint is wired.
2. Read the current CLI argument parser (commander, yargs, citty, oclif, or hand-rolled) and the current top-level command handler. The new subcommand structure must match the existing convention.
3. Read how the `rs-trafilatura` native addon (`@contextractor/extraction-native` napi-rs binding) is loaded at runtime. Storage code must not interfere with this.
4. Read `tsconfig.json`, the lint config (Biome per user's standing convention), and any existing test setup. Match conventions exactly.
5. Check whether ESM or CJS is used; storage code must match.
6. Identify the formatter (Biome) and run it on every file you change. Minimal diffs only — no reformatting of untouched code.

If anything in this prompt conflicts with what you find in the codebase, **the codebase wins** — adapt the prompt's conventions to fit, and call out the conflict in your final report.

## Reference reading (in `./research/` next to this prompt)

- [`research/01-docker-output-storage.md`](./research/01-docker-output-storage.md) — Five storage strategies for Dockerized CLIs, with examples from pandoc/ffmpeg/aws-cli/yt-dlp/Apify. Establishes stdout-first + bind-mount pattern.
- [`research/02-stdout-streaming-at-scale.md`](./research/02-stdout-streaming-at-scale.md) — Why stdout streaming holds up to multi-GB output, the Docker Engine ≥24.0.6 requirement (containerd #8643), the json-file logging driver double-write problem, and the `--log-driver=none` recommendation for large outputs.
- [`research/03-apify-crawlee-storage-architecture.md`](./research/03-apify-crawlee-storage-architecture.md) — The Apify/Crawlee storage primitives (Dataset, KeyValueStore, RequestQueue), their on-disk layout, and the Apify v2 API shape used by Crawlee's dataset/KVS types.
- [`research/04-crawlee-js-local-storage-reference.md`](./research/04-crawlee-js-local-storage-reference.md) — Crawlee for JS (`@crawlee/memory-storage`) on-disk layout in detail: directory structure, nine-digit zero-padded dataset indexes, KVS extension derivation from MIME, `__metadata__.json` written only in debug mode, purge behaviour, `CRAWLEE_STORAGE_DIR` env var, and why concurrent multi-process writes are unsafe with the default backend.
- [`research/05-crawlee-js-programmatic-access.md`](./research/05-crawlee-js-programmatic-access.md) — Crawlee's in-process JS/TS API (`Dataset`, `KeyValueStore`, `RequestQueue`), the lower-level `StorageClient` interface, cross-process access caveats, and patterns for embedding storage access in a CLI.
- [`research/06-crawlee-recommended-consumption-workflow.md`](./research/06-crawlee-recommended-consumption-workflow.md) — Recommended consumption pattern using `Dataset.open()`/`getData()`; `purgeOnStart: false` requirement for CLI use; `Dataset.exportToJSON/CSV`; when direct file reads are fine vs. API preferred.

Treat these as authoritative for *what to build*. The prompt below specifies *which pieces of that to ship now*.

## What ships in this change

A single CLI surface that compiles into the npm package (Node ≥22, runs on the user's machine). There is no Docker distribution.

### CLI surface

```
contextractor extract <url> [<url>…]   [--dataset <name>] [--no-stdout] [--save txt|markdown|json|html|original]
contextractor extract --input-file <file>   [--dataset <name>] [--ndjson]
contextractor list [<dataset>]   [--limit <n>] [--offset <n>] [--format json|jsonl|csv] [--desc]
contextractor get <dataset> <index>
contextractor kvs put <key> <file-or-->   [--store <name>] [--content-type <mime>]
contextractor kvs get <key>   [--store <name>]
contextractor kvs ls   [--store <name>] [--limit <n>] [--exclusive-start-key <key>]
contextractor kvs rm <key>   [--store <name>]
contextractor purge   [--all]
contextractor storage-dir   # prints the resolved storage path and exits
```

Existing single-URL stdout behaviour stays intact: `contextractor https://example.com` (no subcommand) is treated as `contextractor extract https://example.com` for backwards compatibility, **only if** the existing CLI already does this. If the current CLI already requires a subcommand, leave that.

### Storage layout (shared)

Compatible with Crawlee's `@crawlee/memory-storage` on-disk JSON layout. (JS Crawlee has no `FileSystemStorageClient` — that class exists only in Crawlee for Python. The JS equivalent is `MemoryStorage` from `@crawlee/memory-storage`.)

```
${CONTEXTRACTOR_STORAGE_DIR}/
├── datasets/
│   └── <name>/
│       ├── __metadata__.json
│       ├── 000000000.json
│       ├── 000000001.json
│       └── …
├── key_value_stores/
│   └── <name>/
│       ├── __metadata__.json
│       ├── INPUT.json
│       ├── OUTPUT.json
│       └── <key>.<ext>          # extension derived from MIME via mime-types
└── request_queues/               # NOT created in v1; reserve the path
```

**`__metadata__.json` note:** Crawlee's `@crawlee/memory-storage` only writes `__metadata__.json` when `writeMetadata: true` (triggered by `DEBUG=crawlee:memory-storage`). Contextractor does not require it — Crawlee's `Dataset.getData()` and `KeyValueStore.getValue()` read files directly. Enable `writeMetadata: true` in the Crawlee configuration if downstream tools need the metadata sidecar.

Storage directory resolution order (top wins):
1. `--storage-dir` CLI flag
2. `CONTEXTRACTOR_STORAGE_DIR` env var
3. `CRAWLEE_STORAGE_DIR` env var (Crawlee native compatibility)
4. `./storage` if cwd contains `.actor/` or an existing `./storage/` (Apify/Crawlee compat)
5. `${XDG_DATA_HOME:-~/.local/share}/contextractor/storage`


### `extract` semantics

- One URL, no `--dataset`: extract → push one record to `datasets/default/<n>.json` → echo the JSON record on stdout.
- Multiple URLs, no `--dataset`: extract each → push to `datasets/default/` → emit **NDJSON** on stdout (one record per line). With `--ndjson` the user can force NDJSON for the single-URL case too.
- `--dataset my-archive`: route to `datasets/my-archive/`. Stdout behaviour unchanged. (Do not use `-o` — it is already taken by `--output-dir`.)
- `--no-stdout`: silence the stdout echo (storage write still happens). Use this for batch jobs where the user only wants the persistent copy.
- Logs go to **stderr** via a small logger (`pino` or `console.error` — match what the codebase already uses; do not add a new logging dep).
- Exit codes: 0 full success, 2 partial (some URLs failed but storage is consistent), 1 hard error.

The single new thing here is "always also write to storage". If the storage-dir is read-only or full, log a warning to stderr and continue with stdout-only output — extraction must not fail because of storage issues.

Set `Configuration.getGlobalConfig().set('purgeOnStart', false)` before any storage interaction — Crawlee's default (`purgeOnStart: true`) wipes default storage on every new run and must be disabled for persistent CLI use.

### Implementation tasks

Carry these out in order. Each numbered item should be a discrete commit if the codebase uses small commits.

1. **Storage configuration** (`src/storage/`) — Crawlee-backed.
   - Add `crawlee` as a runtime dependency (ask before running `pnpm add`).
   - `resolveStorageDir()` implementing the five-level precedence above; apply the result via `Configuration.getGlobalConfig().set('storageClientOptions', { localDataDirectory: resolvedDir })` before any storage call.
   - Set `Configuration.getGlobalConfig().set('purgeOnStart', false)` at the start of every subcommand invocation — Crawlee's default wipes default storage on every run.
   - Use `Dataset.open(name)` / `pushData()` / `getData({ offset, limit, desc })` / `dataset.forEach()` / `dataset.drop()` from `crawlee` directly — do not build a custom Dataset class.
   - Use `KeyValueStore.open(name)` / `kvs.getValue(key)` / `kvs.setValue(key, value, { contentType })` / `kvs.setValue(key, null)` (to delete) / `kvs.forEachKey(iteratee)` or `kvs.keys()` (to iterate) from `crawlee` directly.
   - Unit tests: verify `resolveStorageDir()` precedence; verify a `pushData`/`getData` round-trip using a temp dir with Crawlee configured to that dir.

2. **CLI subcommand wiring**
   - Refactor the existing entrypoint to add the subcommand structure listed above, preserving the existing single-URL stdout shorthand if present.
   - `extract` writes to storage AND stdout by default; `--no-stdout` for storage-only.
   - `list` / `get` / `kvs *` / `purge` / `storage-dir` call Crawlee's `Dataset` and `KeyValueStore` APIs directly.
   - All log output to stderr; data to stdout.
   - Exit codes per the §extract semantics.
   - Unit tests for each subcommand using a temp storage dir.

3. **Library type re-exports**
   - Re-export `Dataset`, `KeyValueStore`, `DatasetContent`, and `Configuration` from `crawlee` in `@contextractor/standalone`'s public API (`src/index.ts` or equivalent export entry).
   - Verify the re-exports compile: `import { Dataset, KeyValueStore, Configuration } from '@contextractor/standalone'`.
   - No new dependencies needed — `crawlee` is already a runtime dep from task 1.

4. **README updates** (`apps/standalone/README.md`)
   - Document `contextractor extract`, the storage subcommands (`list`, `get`, `kvs *`, `purge`), storage dir resolution, and the Crawlee type re-exports.
   - No Docker content.

5. **Migration / backwards compatibility**
   - Existing users running `contextractor https://example.com` must see byte-identical file output in `./output/`. Verify with a snapshot test against a frozen input.
   - The current CLI uses `-o` / `--output-dir` for the file output directory. The new dataset name flag must be `--dataset` (long form only) to avoid the collision. Do **not** reuse `-o` as a short form for `--dataset` — it is already taken. All examples and docs must use `--dataset <name>`, never `-o <name>` for dataset routing.

6. **Things explicitly out of scope for v1** (note as TODOs, do not implement):
   - `request_queues/` write path. Reserve the directory but don't expose endpoints.
   - `serve` HTTP API. No local HTTP server is provided.
   - `.actor/actor.json` + `apify push` flow. Mention in README as a v2 follow-up.
   - S3/MinIO/cloud storage backends.
   - Datasette-style auto UI.
   - Apify Standby-mode readiness-probe header.

## Unit Tests

Write these tests alongside the implementation. Use vitest; use a temp directory via `os.tmpdir()` or `fs.mkdtempSync` for all storage operations — never use real paths.

### `src/storage/dataset.test.ts`

- `pushData(item)` persists the item; `getData()` returns it with `total: 1`
- Two sequential `pushData` calls; `getData()` returns them in insertion order
- `getData({ offset: 0, limit: 2 })` returns the first two items
- `getData({ desc: true })` returns items in reverse insertion order
- `dataset.drop()` removes the dataset; subsequent `getData()` returns `{ items: [], total: 0 }`
- `Configuration.getGlobalConfig().set('purgeOnStart', false)` prevents auto-wipe on re-open

### `src/storage/key-value-store.test.ts`

- `kvs.setValue('my-key', buffer, { contentType: 'image/png' })` persists the value; `kvs.getValue('my-key')` returns the same bytes
- `kvs.setValue('my-key', {json: true})` persists a JSON value; `kvs.getValue('my-key')` returns the same object
- `kvs.setValue('my-key', null)` removes the key; subsequent `kvs.getValue('my-key')` returns `null`
- `kvs.forEachKey()` iterates all stored keys; collect via iteratee and assert collected key names match what was stored

### `src/storage/resolve-storage-dir.test.ts`

- `--storage-dir` CLI flag takes precedence over env var and heuristics
- `CONTEXTRACTOR_STORAGE_DIR` env var takes precedence over `CRAWLEE_STORAGE_DIR`, the `.actor/` heuristic, and the XDG fallback
- `CRAWLEE_STORAGE_DIR` env var takes precedence over the `.actor/` heuristic and XDG fallback when `CONTEXTRACTOR_STORAGE_DIR` is not set
- Presence of `.actor/` directory in cwd resolves to `./storage`
- Falls back to `${XDG_DATA_HOME}/contextractor/storage` when no other signal is present


