# Add Apify-compatible storage layer + serve mode to contextractor (Docker + npm)

## Context

`contextractor` is a TypeScript/Node CLI that wraps `rs-trafilatura` via a napi-rs native addon (`@contextractor/extraction-native`, distributed via npm `optionalDependencies`) for web content extraction. Today it writes extracted content to a local output directory (default `./output`). We want to add a persistent storage layer and an HTTP API, modelled on Apify/Crawlee, so the **same CLI surface** works in three transports:

1. **stdout** — pipe-friendly default, today's behaviour preserved.
2. **Volume-backed local storage** — append-only `Dataset` + mutable `KeyValueStore` on disk, byte-compatible with Apify/Crawlee's `FileSystemStorageClient` layout. Available in **both** the npm and Docker distributions.
3. **HTTP API** (`contextractor serve`) — a Hono server that exposes the storage directory through endpoints that mirror `https://api.apify.com/v2/`. Available in **both** distributions, but with platform-appropriate defaults: npm binds to `127.0.0.1` only and refuses `0.0.0.0`; Docker can bind to `0.0.0.0` with a mandatory bearer token.

The research that motivates these decisions lives in `./research/` next to this prompt — read those files before designing anything; they cover trade-offs, gotchas, and concrete numbers that aren't repeated here.

## Before you write any code: ground in the codebase

This prompt is intentionally codebase-agnostic. **Do not assume layout, build tooling, or existing CLI structure.** First:

1. `ls` the repo root, find the package.json, read `bin` / `main` / `exports`, and identify how the CLI entrypoint is wired.
2. Read the current CLI argument parser (commander, yargs, citty, oclif, or hand-rolled) and the current top-level command handler. The new subcommand structure must match the existing convention.
3. Read how the `rs-trafilatura` native addon (`@contextractor/extraction-native` napi-rs binding) is loaded at runtime. Storage code must not interfere with this.
4. Check whether there's an existing Dockerfile. If yes, plan modifications; if no, plan a new one alongside the npm distribution without breaking it.
5. Read `tsconfig.json`, the lint config (Biome per user's standing convention), and any existing test setup. Match conventions exactly.
6. Check whether ESM or CJS is used; storage code must match.
7. Identify the formatter (Biome) and run it on every file you change. Minimal diffs only — no reformatting of untouched code.

If anything in this prompt conflicts with what you find in the codebase, **the codebase wins** — adapt the prompt's conventions to fit, and call out the conflict in your final report.

## Reference reading (in `./research/` next to this prompt)

- [`research/01-docker-output-storage.md`](./research/01-docker-output-storage.md) — Five storage strategies for Dockerized CLIs, with examples from pandoc/ffmpeg/aws-cli/yt-dlp/Apify. Establishes stdout-first + bind-mount pattern.
- [`research/02-stdout-streaming-at-scale.md`](./research/02-stdout-streaming-at-scale.md) — Why stdout streaming holds up to multi-GB output, the Docker Engine ≥24.0.6 requirement (containerd #8643), the json-file logging driver double-write problem, and the `--log-driver=none` recommendation for large outputs.
- [`research/03-apify-crawlee-storage-architecture.md`](./research/03-apify-crawlee-storage-architecture.md) — The Apify/Crawlee storage primitives (Dataset, KeyValueStore, RequestQueue), their on-disk layout, the Apify v2 HTTP API contract, and the recommendation to mimic the layout without taking the heavy SDK as a runtime dependency.

Treat these as authoritative for *what to build*. The prompt below specifies *which pieces of that to ship now*.

## What ships in this change

A single CLI surface that compiles into:

- the npm package (Node ≥20, runs on the user's machine), and
- a Docker image (multi-arch `linux/amd64,linux/arm64`, with a Playwright-capable runtime image, runs the same Node CLI).

The TypeScript source is **shared**. The only differences are: (a) Dockerfile and docker-compose.yml exist only in the Docker distribution; (b) the `serve` subcommand has stricter host-binding rules when running outside Docker.

### CLI surface (shared between npm and Docker)

```
contextractor extract <url> [<url>…]   [-o, --dataset <name>] [--no-stdout] [--save txt|markdown|json|html|original]
contextractor extract --input-file <file>   [-o, --dataset <name>] [--ndjson]
contextractor list [<dataset>]   [--limit <n>] [--offset <n>] [--format json|jsonl|csv] [--desc]
contextractor get <dataset> <index>
contextractor kvs put <key> <file-or-->   [--store <name>] [--content-type <mime>]
contextractor kvs get <key>   [--store <name>]
contextractor kvs ls   [--store <name>] [--limit <n>] [--exclusive-start-key <key>]
contextractor kvs rm <key>   [--store <name>]
contextractor purge   [--all]
contextractor serve   [--host <host>] [--port <port>] [--token <token>] [--insecure]
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
│       ├── 000000001.json
│       ├── 000000002.json
│       └── …
├── key_value_stores/
│   └── <name>/
│       ├── __metadata__.json
│       ├── INPUT.json
│       ├── OUTPUT.json
│       └── <key>.<ext>          # extension derived from MIME via mime-db
└── request_queues/               # NOT created in v1; reserve the path
```

**`__metadata__.json` note:** Crawlee's `@crawlee/memory-storage` only writes `__metadata__.json` when `writeMetadata: true` (triggered by `DEBUG=crawlee:memory-storage`). Contextractor writes it unconditionally in every dataset and KVS directory because file-based index coordination requires it. This is the one intentional deviation from Crawlee's default on-disk output.

Storage directory resolution order (top wins):
1. `--storage-dir` CLI flag
2. `CONTEXTRACTOR_STORAGE_DIR` env var
3. `./storage` if cwd contains `.actor/` or an existing `./storage/` (Apify/Crawlee compat)
4. `${XDG_DATA_HOME:-~/.local/share}/contextractor/storage`

Inside Docker, `CONTEXTRACTOR_STORAGE_DIR=/storage` is set in the image and `/storage` is the recommended bind/volume target. Do **not** declare `VOLUME /storage` in the Dockerfile — see research/01 §8 (causes anonymous volume leaks).

### `extract` semantics

- One URL, no `-o`: extract → push one record to `datasets/default/<n>.json` → echo the JSON record on stdout.
- Multiple URLs, no `-o`: extract each → push to `datasets/default/` → emit **NDJSON** on stdout (one record per line). With `--ndjson` the user can force NDJSON for the single-URL case too.
- `-o my-archive`: route to `datasets/my-archive/`. Stdout behaviour unchanged.
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
       ?format=json|jsonl|csv|xml|rss
       &limit=&offset=&desc=&fields=&omit=&clean=&skipEmpty=
POST   /v2/datasets/:name/items                    # body: object or array of objects

GET    /v2/key-value-stores
GET    /v2/key-value-stores/:name/keys
       ?limit=&exclusiveStartKey=
GET    /v2/key-value-stores/:name/records/:key     # raw bytes + Content-Type
PUT    /v2/key-value-stores/:name/records/:key     # body bytes, Content-Type from request header
DELETE /v2/key-value-stores/:name/records/:key

POST   /v2/extract                                 # contextractor-specific
       body: { "url": "…" } or { "urls": ["…"] } with optional options
       behaviour: extract → push to default dataset → return the record(s)

GET    /openapi.json
GET    /docs                                        # Swagger UI
GET    /healthz
```

**Pagination envelope** — exactly Apify's shape so `apify-client` works unmodified:

```json
{ "data": { "total": 42, "offset": 0, "limit": 100, "count": 42, "desc": false, "items": [ … ] } }
```

KVS keys list uses Apify's exclusive-start-key envelope (see research/03 §A3).

**Error shape** — `{"error": {"type": "string", "message": "…"}}` with HTTP 4xx/5xx, again to match Apify.

### `serve` security rules — DIFFERENT between npm and Docker

This is the only place where the two distributions diverge.

**npm distribution (running on user's machine):**
- Default and **only** allowed bind host is `127.0.0.1`.
- Reject `--host 0.0.0.0` and any non-loopback host with a clear error message: *"The npm distribution of contextractor only serves on localhost. To expose the API on the network, use the Docker image (see <link to docs>)."*
- The `--insecure` flag does **not** override this in the npm version. It exists only in Docker.
- No bearer token is required; loopback-only is the security boundary.
- `CONTEXTRACTOR_API_TOKEN`, if set, is still honoured (defence in depth).

**Docker distribution:**
- Default bind host is `127.0.0.1`. Override with `--host 0.0.0.0` to expose externally.
- If `--host` is anything other than `127.0.0.1`/`::1`/loopback:
  - `CONTEXTRACTOR_API_TOKEN` env var is **mandatory**; refuse to start without it (clear error).
  - All `/v2/*` endpoints require `Authorization: Bearer $CONTEXTRACTOR_API_TOKEN`. `/healthz` is unauthenticated.
  - Override with `--insecure` (development only); print a loud stderr warning every request.
- `/healthz` always works without auth (Docker health checks need it).

This split is enforced at runtime via a single `isRunningInDocker()` check (look for `/.dockerenv` or `CONTEXTRACTOR_DOCKER=1` env baked in by the Dockerfile). Choose one detection method and document it.

### Implementation tasks

Carry these out in order. Each numbered item should be a discrete commit if the codebase uses small commits.

1. **Storage helper module** (`src/storage/`) — pure TypeScript, no Crawlee/Apify SDK dep.
   - `Dataset` class: `pushData(item | item[]) → indexes`, `getItems({offset, limit, desc, format}) → items`, `count()`, `metadata()`, `drop()`.
   - `KeyValueStore` class: `setValue(key, value, contentType?)`, `getValue(key) → {value, contentType}`, `deleteValue(key)`, `listKeys({limit, exclusiveStartKey})`.
   - `resolveStorageDir()` implementing the precedence rules above.
   - All file writes use atomic write-and-rename (write to `.tmp` then `rename`) to keep the directory consistent under `kill -9`.
   - Concurrent appenders to a Dataset must coordinate via file-based state because each CLI invocation is a fresh process with no shared in-memory state. (Crawlee's `@crawlee/memory-storage` coordinates in-process memory and is explicitly not safe for concurrent multi-process writes — do not reference it as a model here.) Strategy: read `__metadata__.json`, take the next sequential index, write the item file, update metadata atomically. If you hit a contention loop, fall back to advisory file locking via `proper-lockfile` only if the codebase already includes it; otherwise add a brief retry with jittered backoff. Document the choice.
   - MIME → extension via `mime-db` or `mime-types` (add only if not already present).
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
   - Auth middleware applies the npm/Docker split documented above.
   - OpenAPI 3.1 spec — auto-generated if the chosen router supports it (Hono + `@hono/zod-openapi`); otherwise hand-write a minimal spec at `/openapi.json` and serve Swagger UI from a CDN-loaded HTML page at `/docs`.
   - `/healthz` returns `{"status":"ok","storageDir":"…","datasetCount":N}` with no auth.
   - Integration tests via `supertest` or the router's built-in test client: full round-trip extract → list dataset items via API → fetch KVS record.

4. **Dockerfile** (in the Docker repo/folder, leave the npm package untouched)
   - Multi-stage: `node:22-slim` build → `mcr.microsoft.com/playwright:v<X.Y.Z>-noble` runtime, where `<X.Y.Z>` matches the `playwright` version in `packages/crawler/package.json`. `node:22-slim` lacks the Chrome binary required by Playwright.
   - Non-root user `ctx` with UID/GID 1000.
   - `WORKDIR /storage` (or `WORKDIR /app` and document `/storage` as the mount target — pick one and be consistent).
   - `ENV CONTEXTRACTOR_STORAGE_DIR=/storage CONTEXTRACTOR_DOCKER=1 PORT=8080`.
   - `EXPOSE 8080`.
   - **Do not** declare `VOLUME /storage` (research/01 §8).
   - `ENTRYPOINT ["node", "/app/dist/cli.js"]`, `CMD ["--help"]`. (The `bin` field in `apps/standalone/package.json` maps to `dist/cli.js`; there is no `bin/` directory in the deploy output.)
   - Multi-arch build via `docker buildx`; document the `linux/amd64,linux/arm64` build line in the Dockerfile or a sibling `BUILD.md`.
   - The `rs-trafilatura` native addon is installed automatically by `pnpm install` via `optionalDependencies` — only the linux arch-matched prebuild is resolved. No manual binary copying is needed.

5. **`docker-compose.yml`** at the Docker dist root, demonstrating both modes:
   - `api` service: `serve --host 0.0.0.0 --port 8080`, healthcheck on `/healthz`, `CONTEXTRACTOR_API_TOKEN` from env, named volume `ctx_storage:/storage`, `restart: unless-stopped`.
   - `extract` service under `profiles: ["cli"]`, same volume, entrypoint pointed at `extract`. Document the `docker compose run --rm extract <url>` invocation.

6. **README updates**
   - npm README: document `contextractor extract`, `contextractor serve` (loopback-only), the storage dir resolution, and the npm-vs-Docker split.
   - Docker README: cross-platform invocations (`$(pwd)`, `${PWD}`, `%cd%`), the three modes (stdout / volume / serve), `--log-driver=none` for multi-GB outputs (research/02 §7), `--user $(id -u):$(id -g)` for Linux UID safety, and the minimum Docker Engine version of 24.0.6 (research/02 §2).
   - One README snippet that ends with all three forms, copy-paste ready (mirror the pattern in research/03 §C6).

7. **Migration / backwards compatibility**
   - Existing users running `contextractor https://example.com` must see byte-identical file output in `./output/`. Verify with a snapshot test against a frozen input.
   - If today's CLI has any flag named `--output`, `--output-dir`, or `-o`, audit the new `-o` (dataset name) for collision and either keep both with a deprecation warning or rename the new one to `--dataset` and drop the `-o` short flag. Decide based on what the codebase shows.

8. **Things explicitly out of scope for v1** (note them as TODOs, do not implement):
   - `request_queues/` write path. Reserve the directory but don't expose endpoints.
   - Crawlee/Apify SDK runtime dependency. Layout compatibility only.
   - `.actor/actor.json` + `apify push` flow. Mention in README as a v2 follow-up.
   - S3/MinIO/cloud storage backends.
   - MCP server endpoint.
   - Datasette-style auto UI.
   - Apify Standby-mode readiness-probe header.

