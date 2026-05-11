# Storage Architecture for `contextractor`: An Apify/Crawlee‑Inspired Reference

*A design document for adding volume‑based persistence and an HTTP API to a Dockerized, trafilatura‑based CLI extractor (`contextractor`), informed by deep study of Apify and Crawlee storage primitives and 2026 industry practice.*

---

## 0. Executive summary

The cleanest, most defensible 2026 design for `contextractor` is to **adopt Apify/Crawlee's storage layout almost verbatim** — a `storage/` directory that contains `datasets/`, `key_value_stores/`, and (optionally) `request_queues/` subdirectories. This single decision simultaneously satisfies all access patterns:

- **Volume** — the dataset is plain JSON files on disk. Any tool (jq, Python, another process) can read them directly with no HTTP layer.
- **API** — a `contextractor serve` subcommand starts an HTTP server that exposes the same directory through endpoints that mirror Apify's public API (`/v2/datasets/{id}/items`, `/v2/key-value-stores/{id}/records/{key}`).

Because the on‑disk layout is byte‑compatible with Apify/Crawlee, the same image can later be run as an Apify Actor (with `apify push`) without any code change, and existing Apify clients (`apify-client` for Python and JS, `curl`, MCP servers, integrations like Make.com / n8n) can read `contextractor`'s output directly.

---

## A. How Apify and Crawlee structure storage

### A1. The three storage primitives

| Primitive | Purpose | Mutability | On‑disk layout |
|---|---|---|---|
| **Dataset** | Append‑only tabular store of JSON records | Append‑only — items cannot be modified or deleted individually | `storage/datasets/<name>/000000001.json`, `…002.json`, … |
| **Key‑Value Store (KVS)** | Blob storage with arbitrary string keys and a MIME content type per record | Mutable — keys can be set, overwritten, deleted | `storage/key_value_stores/<name>/<key>.<ext>` |
| **Request Queue** | Deduplicated queue of URLs to crawl, with state tracking | Mutable | `storage/request_queues/<name>/entries.json` |

#### Dataset details

* Each call to `dataset.pushData(item)` (JS) or `dataset.push_data(item)` (Python) appends one row.
* In Crawlee's MemoryStorageClient and FileSystemStorageClient, **each item is its own JSON file**, named with a zero‑padded sequential index: `000000001.json`, `000000002.json`, …
* The `Dataset` class is append‑only: items can be read by index, sliced, paginated, exported (JSON, CSV, XML, Excel, RSS, HTML, JSONL), but never edited in place. Each item must be JSON‑serializable and under 9 MB.
* A `__metadata__.json` file alongside the items records dataset metadata (id, name, createdAt, modifiedAt, accessedAt, itemCount).

#### Key‑Value Store details

* The on‑disk path is `{CRAWLEE_STORAGE_DIR}/key_value_stores/{STORE_ID}/{KEY}.{EXT}`.
* The extension is derived from the record's MIME type: a JSON dict becomes `key.json`, plain text becomes `key.txt`, an image becomes `key.jpg`.
* By convention every Actor reads its run input from `INPUT.json` and writes its run output to `OUTPUT.json` (or, for tabular results, just pushes to the default dataset).

### A2. The storage‑client abstraction

The single most important architectural idea: the three primitives are exposed through a stable **high‑level API** (the `Dataset`, `KeyValueStore`, `RequestQueue` classes) that delegates to a pluggable **storage client**. Switching the client switches the backend without touching application code.

Crawlee for Python ships several clients:

* `MemoryStorageClient` — in‑memory only, no persistence.
* `FileSystemStorageClient` — the default. Persists to `CRAWLEE_STORAGE_DIR` (default `./storage`).
* `SqlStorageClient` — experimental, SQLite or PostgreSQL.
* `RedisStorageClient` — Redis 8.0+.
* `ApifyStorageClient` — talks to Apify's cloud REST API.

#### Environment variables

| Variable | Effect |
|---|---|
| `CRAWLEE_STORAGE_DIR` | Root storage directory (default: `./storage`) |
| `CRAWLEE_DEFAULT_DATASET_ID` | Override default dataset name (default: `default`) |
| `CRAWLEE_DEFAULT_KEY_VALUE_STORE_ID` | Override default KVS name |
| `APIFY_LOCAL_STORAGE_DIR` | Older synonym (Apify SDK) for `CRAWLEE_STORAGE_DIR` |
| `APIFY_TOKEN` | If set without `APIFY_LOCAL_STORAGE_DIR`, the SDK switches to cloud storage |
| `APIFY_IS_AT_HOME` | Set automatically by the Apify platform |

The key idiom: **the same scraper code runs locally writing to `./storage/` and runs on Apify cloud writing to Apify's distributed storage** — only an env var changes.

### A3. The API surface

#### HTTP API (Apify cloud, `https://api.apify.com/v2/`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/v2/datasets` | `GET` | List datasets |
| `/v2/datasets/{datasetId}` | `GET` / `PUT` / `DELETE` | Get/rename/delete one dataset |
| `/v2/datasets/{datasetId}/items` | `GET` | **Get items** (supports `format=json\|jsonl\|csv\|xlsx\|xml\|rss\|html`, `limit`, `offset`, `desc`, `clean`, `fields`, `omit`, `unwind`, `skipEmpty`, `skipHidden`, `flatten`, `view`) |
| `/v2/datasets/{datasetId}/items` | `POST` | Append items |
| `/v2/key-value-stores/{storeId}/keys` | `GET` | List keys |
| `/v2/key-value-stores/{storeId}/records/{key}` | `GET` | Read record (returns raw bytes with original `Content-Type`) |
| `/v2/key-value-stores/{storeId}/records/{key}` | `PUT` | Write record |
| `/v2/key-value-stores/{storeId}/records/{key}` | `DELETE` | Delete record |

**Auth:** Bearer token in the `Authorization` header (`Authorization: Bearer apify_api_…`).

**Pagination response envelope:**

```json
{
  "data": {
    "total": 2560,
    "offset": 250,
    "limit": 1000,
    "count": 1000,
    "desc": false,
    "items": [ {…}, … ]
  }
}
```

**Content negotiation** is via the `format=` query parameter on `/items`, not via `Accept` headers.

### A4. Actor input/output conventions

* **Input** is a single JSON object read from `KeyValueStore.default → INPUT.json`.
* **Output** is either tabular results appended to `Dataset.default` via `pushData()`, or a single file/blob at `KeyValueStore.default → OUTPUT`.

This convention gives every Actor on the Apify Store the same uniform interface — exactly the abstraction that makes Apify's MCP servers work.

---

## B. Industry‑standard 2026 patterns

### B1. Filesystem‑as‑API

The simplest pattern: the program writes structured files to a directory, and the directory **is** the data API. Anything that can read files can read your data.

* **Plain JSON** — one file per record (Apify/Crawlee dataset style). Trivially diffable, grep‑able, concurrent‑append‑safe.
* **JSONL** — one record per line. More compact, but appending from multiple writers requires file locking.
* **SQLite** — single file, ACID, queryable with SQL.
* **Datasette** — wraps any SQLite file in an instant read‑only JSON API + auto‑generated HTML UI.

### B2. Sidecar / companion API server

Run the extractor and the API server as separate containers that share a volume. This is what Datasette, prometheus/grafana, meilisearch, qdrant, clickhouse-server, and many others adopt. Most ship a single binary with both modes (`hugo server`, `datasette serve`, `mkdocs serve`) — the server reads the same data dir the CLI writes.

### B3. Embedded HTTP API in the same binary

A `contextractor serve` subcommand that starts an embedded HTTP server. For Node/TS in 2026:

* **Hono** — minimal, fast, excellent OpenAPI integration via `@hono/zod-openapi`. Runs on Node, Bun, Deno, Cloudflare Workers.
* **Fastify** — mature, plugin ecosystem, JSON Schema-based validation.
* **Express** — still ubiquitous but lacks first-class TypeScript and async patterns.

OpenAPI 3.1 spec auto‑generated by Hono with `@hono/zod-openapi` gives a self‑documenting API and Swagger UI for free.

**Auth options** for `serve`:

* None for `127.0.0.1` binds (the default).
* Static bearer token from `CONTEXTRACTOR_API_TOKEN` env var when bound to `0.0.0.0`. Reject requests without `Authorization: Bearer …` if the env var is set.
* mTLS / reverse‑proxy for production.

### B5. The "data dir + REST API" default of modern data tools

Examining how Meilisearch, Qdrant, ClickHouse, Typesense ship reveals they have **converged on the same design**:

* Single Docker image.
* Single persistent volume (`/meili_data`, `/qdrant/storage`, etc.).
* REST API on a documented port.
* Bind to `0.0.0.0` inside the container, expose via `-p`.
* Optional master key / token via env var.
* Empty data dir on first run is fine; the tool initialises itself.

---

## C. Concrete recommendations for `contextractor`

### C1. Recommended storage layout

Adopt the Apify/Crawlee layout 1:1, with `default` as the well‑known name:

```
${CONTEXTRACTOR_STORAGE_DIR:-./storage}/
├── datasets/
│   └── default/
│       ├── __metadata__.json     # {"name":"default","createdAt":"…","itemCount":42}
│       ├── 000000001.json        # one extracted record per file
│       ├── 000000002.json
│       └── …
├── key_value_stores/
│   └── default/
│       ├── __metadata__.json
│       ├── INPUT.json            # optional: last invocation's input args
│       ├── OUTPUT.json           # optional: last run summary
│       ├── <url-hash>.html       # raw HTML snapshots, MIME preserved
│       └── <url-hash>.txt        # plain‑text extractions, etc.
└── request_queues/               # optional, only if batch crawling is added later
    └── default/
```

**Why this layout:**

* Per‑record JSON in a dataset is **safe to append concurrently** from multiple processes without locking.
* A separate `__metadata__.json` lets the API answer `GET /datasets/default` without scanning the directory.
* A KVS is the right place for non‑tabular artifacts: original HTML, screenshots, extraction provenance JSON.

### C2. CLI mode

```
contextractor extract <URL> [--dataset <name>]
contextractor extract --input-file urls.txt
contextractor list [<dataset-name>] [--limit N] [--offset N] [--format json|jsonl|csv]
contextractor get <dataset-name> <index>
contextractor kvs put <key> <file>
contextractor kvs get <key>
contextractor kvs ls
contextractor purge [--all]
contextractor serve [--host 127.0.0.1] [--port 8080] [--token <token>]
```

Storage directory resolution order: `--storage-dir` flag > `CONTEXTRACTOR_STORAGE_DIR` env var > `./storage/` if cwd contains `.actor/` or `storage/` > `${XDG_DATA_HOME:-~/.local/share}/contextractor/storage/`.

### C3. API / `serve` mode

A `contextractor serve` subcommand starts a Hono app that exposes the storage directory. Mirror Apify's URL shape so existing Apify clients can be pointed at `http://localhost:8080/v2/`:

```
GET    /v2/datasets                                       → list datasets
GET    /v2/datasets/{name}                                → dataset metadata
DELETE /v2/datasets/{name}
GET    /v2/datasets/{name}/items?format=json|jsonl|csv|xml|rss
       &limit=&offset=&desc=&fields=&clean=&skipEmpty=
POST   /v2/datasets/{name}/items                          → append

GET    /v2/key-value-stores                               → list KVS
GET    /v2/key-value-stores/{name}/keys?limit=&exclusiveStartKey=
GET    /v2/key-value-stores/{name}/records/{key}          → raw bytes + Content-Type
PUT    /v2/key-value-stores/{name}/records/{key}
DELETE /v2/key-value-stores/{name}/records/{key}

POST   /v2/extract                                        → contextractor‑specific
GET    /openapi.json
GET    /docs                                              → Swagger UI
GET    /healthz
```

**Auth:**

* If `--host 127.0.0.1` (the default) and `CONTEXTRACTOR_API_TOKEN` is unset → no auth.
* If bound to `0.0.0.0` → require `Authorization: Bearer $CONTEXTRACTOR_API_TOKEN` and refuse to start without a token unless `--insecure` is passed.

### C4. Docker patterns

Single image, multi‑mode. The default `CMD` runs the CLI; subcommands switch behaviour.

```dockerfile
FROM node:22-slim
WORKDIR /app
RUN groupadd -g 1000 ctx && useradd -m -u 1000 -g ctx ctx
COPY --chown=ctx:ctx . /app
RUN npm ci --omit=dev
ENV CONTEXTRACTOR_STORAGE_DIR=/storage
RUN mkdir -p /storage && chown ctx:ctx /storage
USER ctx
EXPOSE 8080
ENTRYPOINT ["node", "/app/bin/contextractor.js"]
CMD ["--help"]
```

Three canonical invocations:

```bash
# 1) Extract with volume persistence
docker run --rm -v ctx_storage:/storage contextractor extract https://example.com

# 2) API server reading the same volume
docker run -d --name ctx-api -v ctx_storage:/storage -p 8080:8080 \
  -e CONTEXTRACTOR_API_TOKEN=devtoken \
  contextractor serve --host 0.0.0.0 --port 8080
```

`docker-compose.yml`:

```yaml
name: contextractor

services:
  api:
    image: contextractor:latest
    command: serve --host 0.0.0.0 --port 8080
    ports: ["8080:8080"]
    environment:
      CONTEXTRACTOR_STORAGE_DIR: /storage
      CONTEXTRACTOR_API_TOKEN: ${CTX_TOKEN:-devtoken}
    volumes:
      - ctx_storage:/storage
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:8080/healthz"]
      interval: 10s
      retries: 3
    restart: unless-stopped

  extract:
    image: contextractor:latest
    profiles: ["cli"]
    entrypoint: ["node", "/app/bin/contextractor.js", "extract"]
    environment:
      CONTEXTRACTOR_STORAGE_DIR: /storage
    volumes:
      - ctx_storage:/storage

volumes:
  ctx_storage:
```

### C5. Migration / Apify compatibility

| Approach | Pros | Cons |
|---|---|---|
| **Custom layout, custom storage code** | Zero deps; any shape you want | Reinvents what already works; no Apify cloud deployment without rework |
| **Apify‑compatible layout, custom storage code** *(recommended)* | Apify CLI / `apify-client` can read your output; trivial to later wrap as an Actor; tiny dep footprint | You have to write ~200 lines of file I/O |
| **Use `crawlee` SDK as the storage backend** | Zero file I/O code; storage clients are batteries‑included | Pulls in Crawlee's full crawler stack as a transitive dep; opinionated about async; heavier install |

**Recommendation:** start with the middle option for v1. The layout is so simple that depending on Crawlee just for storage is overkill.

---

## D. Decision matrix and final recommendation

### D1. Comparison of options

| Option | Setup cost | Volume access | API access | Networked | Apify deployable | Best for |
|---|---|---|---|---|---|---|
| Bind mount + raw JSON files | Trivial | ✅ direct | ❌ | ❌ | ❌ | One‑off scripts |
| **Named volume + Apify‑compatible layout (recommended)** | Low | ✅ direct | ✅ via `serve` | ✅ when bound to 0.0.0.0 | ✅ (drop in `.actor/`) | **`contextractor` v1** |
| Embedded SQLite + Datasette | Low–medium | ✅ via `sqlite3` | ✅ Datasette | ✅ | ✅ but unusual | Heavy queries/analytics |
| MinIO / S3 | Medium | ✅ via mc/aws CLI | ✅ S3 API | ✅ | ✅ via Apify cloud KVS | Multi‑host scale |
| Sidecar API container | Medium | ✅ shared volume | ✅ separate svc | ✅ | ⚠️ awkward | Strict separation of concerns |
| Full Crawlee/Apify SDK | Medium (heavy deps) | ✅ same layout | Build on top | ✅ | ✅ trivial | Eventually a real Apify Actor |

### D2. Final recommendation

**Adopt option 2 — Apify‑compatible storage layout, custom thin storage helper, Hono/FastAPI `serve` subcommand — for v1.**

1. **v1 (ship now):**
   * `./storage/datasets/default/000000NNN.json` + `__metadata__.json` layout, byte‑identical to Apify/Crawlee's FileSystemStorageClient.
   * `./storage/key_value_stores/default/INPUT.json` and `OUTPUT.json` conventions; record MIME type preserved via file extension.
   * `contextractor extract URL` writes to the default dataset.
   * `contextractor serve` starts on `127.0.0.1:8080` by default, exposing `/v2/datasets/{name}/items`, `/v2/key-value-stores/{name}/records/{key}`, and a single product‑specific `POST /v2/extract` shortcut.
   * Auth: none on loopback; mandatory bearer token via `CONTEXTRACTOR_API_TOKEN` on `0.0.0.0`. Refuse to start on `0.0.0.0` without a token (`--insecure` to override for dev).
   * Pagination envelope and `format=` query parameter identical to Apify's.
   * Single Docker image, three modes (`extract`, `serve`, default `--help`); a `docker-compose.yml` showing the API container + on‑demand extract container sharing a named volume.

2. **v2 (defer):**
   * Optional `.actor/` directory + `apify push` blessing.
   * Optional Datasette mode for analytics.
   * Optional S3/MinIO storage backend.
   * Optional Apify Standby‑mode compatibility.
   * Optional MCP server endpoint at `/mcp`.

### D3. Trade‑offs

**Pros of going Apify‑compatible:**

* Free deployability to Apify cloud (`apify push`).
* The Apify ecosystem (apify‑client SDKs, Make.com / n8n / Zapier connectors, MCP, the Apify Console UI) reads the layout natively.
* Your tests can use `crawlee.storage_clients.MemoryStorageClient` for free.

**Cons:**

* If you adopt the heavier `apify` SDK as a hard dependency, you pull in Crawlee, async machinery, and storage clients for backends you don't use.
* The convention has Apify‑specific quirks (`#`‑prefixed hidden fields, `unwind`/`flatten`/`view` query params, exclusive‑start‑key pagination on KVS).

The pragmatic compromise — **mimic the on‑disk layout and HTTP API exactly, without taking the SDK as a runtime dependency** — captures ~95% of the upside for a one‑file storage helper and a small Hono router.
