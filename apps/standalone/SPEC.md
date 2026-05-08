# apps/standalone — Specification

Standalone TypeScript CLI for local content extraction. Also exports a programmatic API.
Ships as an npm package and as a Docker image.

## CLI Surface

```bash
# Backward-compatible root command (legacy form)
contextractor [OPTIONS] [URLS...]

# Subcommands
contextractor extract <url> [<url>...]  [-o, --output-dir <dir>] [--dataset <name>] [--no-stdout] [--ndjson]
contextractor list [<dataset>]   [--limit <n>] [--offset <n>] [--format json|jsonl|csv] [--desc]
contextractor get <dataset> <index>
contextractor kvs put <key> <file-or-->   [--store <name>] [--content-type <mime>]
contextractor kvs get <key>   [--store <name>]
contextractor kvs ls   [--store <name>] [--limit <n>] [--exclusive-start-key <key>]
contextractor kvs rm <key>   [--store <name>]
contextractor purge   [--all]
contextractor serve   [--host <host>] [--port <port>] [--token <token>] [--insecure]
contextractor storage-dir
```

Full flag reference: auto-generated table in `apps/standalone/README.md`.

## Config merge order

`defaults (Zod schema) → config file (JSON) → CLI args`

Config file: optional JSON file with the same camelCase shape as the Apify input schema. CLI-only flags (`--output-dir`, `--save`, `--dataset`) are not accepted in the config file. Unknown keys are stripped by `ContextractorInput.parse()`.

## Storage

Extraction results are written to both the output directory (file-based sink) and the persistent storage directory (Crawlee/Apify-compatible JSON files on disk).

### Storage directory resolution (first match wins)

- `--storage-dir` CLI flag
- `CONTEXTRACTOR_STORAGE_DIR` env var
- `./storage` if cwd contains `.actor/` or an existing `./storage/`
- `${XDG_DATA_HOME:-~/.local/share}/contextractor/storage`

Inside Docker: `CONTEXTRACTOR_STORAGE_DIR=/storage` is set in the image; `/storage` is the recommended mount point.

### Storage layout (Crawlee/Apify-compatible)

```
${CONTEXTRACTOR_STORAGE_DIR}/
├── datasets/
│   └── <name>/
│       ├── __metadata__.json
│       ├── 000000000.json
│       └── …
├── key_value_stores/
│   └── <name>/
│       ├── __metadata__.json
│       └── <key>.<ext>
└── request_queues/   # reserved for v2; not exposed in v1
```

## HTTP API (`serve` subcommand)

Hono server exposing Apify-compatible endpoints at `/v2/`. Default port: 8080.

### Endpoints

- `GET /healthz` — health check (no auth)
- `GET /v2/datasets` — list datasets
- `GET /v2/datasets/:name/items` — get items (pagination headers + format=json|jsonl|csv)
- `POST /v2/datasets/:name/items` — append items
- `GET /v2/key-value-stores/:name/records/:key` — get record
- `PUT /v2/key-value-stores/:name/records/:key` — put record
- `DELETE /v2/key-value-stores/:name/records/:key` — delete record
- `GET /openapi.json` — OpenAPI 3.0 spec
- `GET /docs` — Swagger UI

### Security split (npm vs Docker)

**npm**: binds to `127.0.0.1` only. Non-loopback hosts are rejected.

**Docker** (`CONTEXTRACTOR_DOCKER=1` or `/.dockerenv` present): allows `--host 0.0.0.0`. When non-loopback, `CONTEXTRACTOR_API_TOKEN` is required (all `/v2/*` endpoints need `Authorization: Bearer <token>`). `--insecure` bypasses auth for development (logs a warning per request).

## Output

One file per crawled page in the output directory, named from a URL slug (e.g. `example-com-page.md`). Records are also pushed to the named dataset. Supported save formats: `txt`, `markdown`, `json`, `html`.

## Programmatic API

`@contextractor/standalone` exports `buildProgram()` for use as a Node.js library without the CLI binary.

## Sink

Uses `fileSink(outputDir, formats)` from `@contextractor/crawler` (writes one file per page per format) plus a `Dataset.pushData` call for persistent storage. Storage failures are non-fatal: a warning is logged and extraction continues.
