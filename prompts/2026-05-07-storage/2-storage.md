# Add Apify-compatible storage layer + serve mode to contextractor (Docker + npm)

> **TLDR**: Adds persistent Crawlee-compatible storage (Dataset + KeyValueStore) and an HTTP server mirroring the Apify v2 API, shipping as an npm package only. The storage module is pure TypeScript; the `serve` subcommand is localhost-only.

## Context

`contextractor` is a TypeScript/Node CLI that wraps `rs-trafilatura` via a napi-rs native addon (`@contextractor/extraction-native`, distributed via npm `optionalDependencies`) for web content extraction. Today it writes extracted content to a local output directory (default `./output`). We want to add a persistent storage layer and an HTTP API, modelled on Apify/Crawlee, so the CLI surface works in three transports:

1. **stdout** — pipe-friendly default, today's behaviour preserved.
2. **Volume-backed local storage** — append-only `Dataset` + mutable `KeyValueStore` on disk, byte-compatible with Apify/Crawlee's `FileSystemStorageClient` layout.
3. **HTTP API** (`contextractor serve`) — a Hono server that exposes the storage directory through endpoints that mirror `https://api.apify.com/v2/`. Binds to `127.0.0.1` only by default; no Docker distribution.

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
- [`research/03-apify-crawlee-storage-architecture.md`](./research/03-apify-crawlee-storage-architecture.md) — The Apify/Crawlee storage primitives (Dataset, KeyValueStore, RequestQueue), their on-disk layout, the Apify v2 HTTP API contract, and the recommendation to mimic the layout without taking the heavy SDK as a runtime dependency.
- [`research/04-crawlee-js-local-storage-reference.md`](./research/04-crawlee-js-local-storage-reference.md) — Crawlee for JS (`@crawlee/memory-storage`) on-disk layout in detail: directory structure, nine-digit zero-padded dataset indexes, KVS extension derivation from MIME, `__metadata__.json` written only in debug mode, purge behaviour, `CRAWLEE_STORAGE_DIR` env var, and why concurrent multi-process writes are unsafe with the default backend.
- [`research/05-crawlee-js-programmatic-access.md`](./research/05-crawlee-js-programmatic-access.md) — Crawlee's in-process JS/TS API (`Dataset`, `KeyValueStore`, `RequestQueue`), the lower-level `StorageClient` interface, confirmation that there is no built-in local HTTP API (must be built), cross-process access caveats, and patterns for embedding an HTTP server inside a Crawlee process.

Treat these as authoritative for *what to build*. The prompt below specifies *which pieces of that to ship now*.

## What ships in this change

A single CLI surface that compiles into the npm package (Node ≥20, runs on the user's machine). There is no Docker distribution.

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
contextractor serve   [--host <host>] [--port <port>] [--token <token>]
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

**`__metadata__.json` note:** Crawlee's `@crawlee/memory-storage` only writes `__metadata__.json` when `writeMetadata: true` (triggered by `DEBUG=crawlee:memory-storage`). Contextractor writes it unconditionally in every dataset and KVS directory because file-based index coordination requires it. This is the one intentional deviation from Crawlee's default on-disk output.

Storage directory resolution order (top wins):
1. `--storage-dir` CLI flag
2. `CONTEXTRACTOR_STORAGE_DIR` env var
3. `./storage` if cwd contains `.actor/` or an existing `./storage/` (Apify/Crawlee compat)
4. `${XDG_DATA_HOME:-~/.local/share}/contextractor/storage`


### `extract` semantics

- One URL, no `--dataset`: extract → push one record to `datasets/default/<n>.json` → echo the JSON record on stdout.
- Multiple URLs, no `--dataset`: extract each → push to `datasets/default/` → emit **NDJSON** on stdout (one record per line). With `--ndjson` the user can force NDJSON for the single-URL case too.
- `--dataset my-archive`: route to `datasets/my-archive/`. Stdout behaviour unchanged. (Do not use `-o` — it is already taken by `--output-dir`.)
- `--no-stdout`: silence the stdout echo (storage write still happens). Use this for batch jobs where the user only wants the persistent copy.
- Logs go to **stderr** via a small logger (`pino` or `console.error` — match what the codebase already uses; do not add a new logging dep).
- Exit codes: 0 full success, 2 partial (some URLs failed but storage is consistent), 1 hard error.

The single new thing here is "always also write to storage". If the storage-dir is read-only or full, log a warning to stderr and continue with stdout-only output — extraction must not fail because of storage issues.

### `serve` semantics

A Hono HTTP server (or whatever lightweight router the codebase already uses; check first) on the configured port. Endpoints **mirror Apify's v2 shape** exactly, so existing Apify clients can be pointed at `http://localhost:<port>/v2/`:

```
GET    /v2/datasets
GET    /v2/datasets/:name
DELETE /v2/datasets/:name
GET    /v2/datasets/:name/items
       ?format=json|jsonl|csv|html|xlsx|xml|rss
       &limit=&offset=&desc=&fields=&omit=&clean=&skipEmpty=
POST   /v2/datasets/:name/items                    # body: object or array of objects

GET    /v2/key-value-stores
GET    /v2/key-value-stores/:name/keys
       ?limit=&exclusiveStartKey=
GET    /v2/key-value-stores/:name/records/:key     # raw bytes + Content-Type
PUT    /v2/key-value-stores/:name/records/:key     # body bytes, Content-Type from request header
DELETE /v2/key-value-stores/:name/records/:key

POST   /v2/extract                                 # contextractor-specific (v1: return 501 if not trivially wirable)
       body: { "url": "…" } or { "urls": ["…"] } with optional options
       behaviour: extract → push to default dataset → return the record(s)
       note: implementing this endpoint requires wiring the full crawl pipeline inside
       the serve handler. If that is not straightforward given the codebase structure,
       return HTTP 501 with {"error":{"type":"NOT_IMPLEMENTED","message":"Use POST /v2/datasets/:name/items to push data directly, or run contextractor extract <url> from the CLI."}}
       and document the limitation. Do not block the other endpoints on this.

GET    /openapi.json
GET    /docs                                        # Swagger UI
GET    /healthz
```

**Dataset items response** — `GET /v2/datasets/:name/items` returns a raw JSON array. Pagination metadata is in response headers:
- `X-Apify-Pagination-Total`
- `X-Apify-Pagination-Offset`
- `X-Apify-Pagination-Limit`
- `X-Apify-Pagination-Count`

KVS keys list uses the `{ "data": { … } }` envelope with `exclusiveStartKey` pagination (see research/03 §A3).

**Error shape** — `{"error": {"type": "string", "message": "…"}}` with HTTP 4xx/5xx, again to match Apify.

### `serve` security rules

There is no Docker distribution. `serve` is npm-only.

- Default bind host is `127.0.0.1`. If `--host` is set to a non-loopback address, log a warning to stderr but proceed (this allows CI pipelines to bind to `0.0.0.0` for local integration testing).
- No `--insecure` flag. No `isRunningInDocker()`. No `CONTEXTRACTOR_DOCKER`.
- `CONTEXTRACTOR_API_TOKEN`, if set, is honoured as optional defence-in-depth: all `/v2/*` endpoints require `Authorization: Bearer <token>`. If not set, no auth is required.
- `/healthz` is always unauthenticated.

### Implementation tasks

Carry these out in order. Each numbered item should be a discrete commit if the codebase uses small commits.

1. **Storage helper module** (`src/storage/`) — pure TypeScript, no Crawlee/Apify SDK dep.
   - `Dataset` class: `pushData(item | item[]) → indexes`, `getItems({offset, limit, desc, format}) → items`, `count()`, `metadata()`, `drop()`.
   - `KeyValueStore` class: `setValue(key, value, contentType?)`, `getValue(key) → {value, contentType}`, `deleteValue(key)`, `listKeys({limit, exclusiveStartKey})`.
   - `resolveStorageDir()` implementing the precedence rules above.
   - All file writes use atomic write-and-rename (write to `.tmp` then `rename`) to keep the directory consistent under `kill -9`.
   - Concurrent appenders to a Dataset must coordinate via file-based state because each CLI invocation is a fresh process with no shared in-memory state. (Crawlee's `@crawlee/memory-storage` coordinates in-process memory and is explicitly not safe for concurrent multi-process writes — do not reference it as a model here.) Strategy: read `__metadata__.json`, take the next sequential index, write the item file, update metadata atomically. If you hit a contention loop, fall back to advisory file locking via `proper-lockfile` only if the codebase already includes it; otherwise add a brief retry with jittered backoff. Document the choice.
   - MIME → extension via `mime-types` (add only if not already present).
   - Unit tests: round-trip a Dataset and a KVS, verify byte-compatible layout, parallel pushers don't lose records.

2. **CLI subcommand wiring**
   - Refactor the existing entrypoint to add the subcommand structure listed above, preserving the existing single-URL stdout shorthand if present.
   - `extract` writes to storage AND stdout by default; `--no-stdout` for storage-only.
   - `list` / `get` / `kvs *` / `purge` / `storage-dir` are simple wrappers over the storage helper.
   - All log output to stderr; data to stdout.
   - Exit codes per the §extract semantics.
   - Unit tests for each subcommand using a temp storage dir.

3. **`serve` subcommand**
   - Pick the smallest router that fits the existing dep set. Hono is the recommendation; if the project already includes Fastify or Express, use that instead.
   - Implement all the endpoints above. Use a shared response-envelope helper to keep shape parity with Apify.
   - Auth middleware: if `CONTEXTRACTOR_API_TOKEN` env var is set, require `Authorization: Bearer <token>` on all `/v2/*` requests (optional defence-in-depth). Otherwise no auth.
   - OpenAPI 3.0 spec — auto-generated if the chosen router supports it (Hono + `@hono/zod-openapi`); otherwise hand-write a minimal spec at `/openapi.json` and serve Swagger UI from a CDN-loaded HTML page at `/docs`.
   - `/healthz` returns `{"status":"ok","storageDir":"…","datasetCount":N}` with no auth.
   - No `--insecure` flag. No `isRunningInDocker()`. No Docker-mode logic.
   - Integration tests via Hono's `testClient` (from `hono/testing`) or `app.request()`: full round-trip extract → list dataset items via API → fetch KVS record.

4. **README updates** (`apps/standalone/README.md`)
   - Document `contextractor extract`, `contextractor serve` (localhost-only), and the storage dir resolution.
   - No Docker content.

5. **Migration / backwards compatibility**
   - Existing users running `contextractor https://example.com` must see byte-identical file output in `./output/`. Verify with a snapshot test against a frozen input.
   - The current CLI uses `-o` / `--output-dir` for the file output directory. The new dataset name flag must be `--dataset` (long form only) to avoid the collision. Do **not** reuse `-o` as a short form for `--dataset` — it is already taken. All examples and docs must use `--dataset <name>`, never `-o <name>` for dataset routing.

6. **Things explicitly out of scope for v1** (note as TODOs, do not implement):
   - `request_queues/` write path. Reserve the directory but don't expose endpoints.
   - Crawlee/Apify SDK runtime dependency. Layout compatibility only.
   - `.actor/actor.json` + `apify push` flow. Mention in README as a v2 follow-up.
   - S3/MinIO/cloud storage backends.
   - MCP server endpoint.
   - Datasette-style auto UI.
   - Apify Standby-mode readiness-probe header.

## Unit Tests

Write these tests alongside the implementation. Use vitest; use a temp directory via `os.tmpdir()` or `fs.mkdtempSync` for all storage operations — never use real paths.

### `src/storage/dataset.test.ts`

- `pushData(item)` creates `000000000.json` (nine-digit zero-padded) and sets `itemCount: 1` in `__metadata__.json`
- `pushData` called twice sequentially creates `000000000.json` and `000000001.json`
- `getItems({offset: 0, limit: 2})` returns the first two items in insertion order
- `getItems({desc: true})` returns items in reverse insertion order
- Two `pushData` calls run in parallel (separate `Dataset` instances on the same directory) — both records appear in `getItems` with no data loss
- `drop()` removes the dataset directory; subsequent `getItems` returns an empty array

### `src/storage/key-value-store.test.ts`

- `setValue('my-key', buffer, 'image/png')` writes `my-key.png`; `getValue('my-key')` returns the same bytes with `contentType: 'image/png'`
- `setValue('my-key', {json: true}, 'application/json')` writes `my-key.json`; `getValue` returns the same value
- `deleteValue('my-key')` removes the file; subsequent `getValue` returns `null`
- `listKeys({limit: 2})` returns at most two keys and the correct `exclusiveStartKey` for the next page

### `src/storage/resolve-storage-dir.test.ts`

- `--storage-dir` CLI flag takes precedence over env var and heuristics
- `CONTEXTRACTOR_STORAGE_DIR` env var takes precedence over the `.actor/` heuristic and the XDG fallback
- Presence of `.actor/` directory in cwd resolves to `./storage`
- Falls back to `${XDG_DATA_HOME}/contextractor/storage` when no other signal is present

### `src/serve/serve.test.ts`

Use `hono/testing` `testClient` or `app.request()` — no real network port is needed:

- `GET /healthz` returns `{"status":"ok","storageDir":"…","datasetCount":N}` without auth
- `GET /v2/datasets/default/items` returns a JSON array; response has all four `X-Apify-Pagination-*` headers
- `GET /v2/datasets/default/items?format=jsonl` returns NDJSON with `Content-Type: application/x-ndjson`
- `POST /v2/datasets/default/items` with `{"url":"x","text":"y"}` appends a record; subsequent `GET` returns it
- No token set: all `/v2/*` endpoints accessible without `Authorization` header
- `CONTEXTRACTOR_API_TOKEN=secret` set: `GET /v2/datasets` without `Authorization` → HTTP 401; with `Authorization: Bearer secret` → HTTP 200; `/healthz` still 200 without auth

