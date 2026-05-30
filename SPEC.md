# Contextractor — Specification

## Overview

Contextractor crawls websites and extracts clean, readable main-content text. Built on **`rs-trafilatura`** (Rust port of Trafilatura, accessed via a napi-rs binding) and **[Crawlee](https://crawlee.dev/)** (TypeScript crawler driving Playwright).

Available as:

- **Apify Actor** — `glueo/contextractor` on the Apify platform; output saved to the run's Key-Value Store + Dataset
- **Standalone CLI** (`@contextractor/standalone`) — local TypeScript CLI; output written to disk and/or Crawlee storage (Dataset / KeyValueStore)
- **Extraction library** (`@contextractor/extraction`) — embedded engine used by both surfaces above

Supported output formats: `txt | markdown | json | html | original`.

## Architecture

```
packages/extraction/        TypeScript engine + napi-rs Rust crate
packages/crawler/           Shared Crawlee + Playwright crawler factory
packages/schema/            Zod 4 single source of truth for input
apps/apify-actor/           Apify Actor  (depends on extraction + crawler + schema)
apps/standalone/            Standalone CLI (depends on extraction + crawler + schema)
```

Data flow:

```
Input URLs → [SitemapRequestList (optional)] → PlaywrightCrawler → ContentExtractor (TS) → sink
                                                                                           ├── KVS + Dataset (Actor)
                                                                                           └── KVS + Dataset (CLI)
```

When `useSitemaps` is enabled, `SitemapRequestList.open()` fetches `sitemap.xml` at each start URL's domain root and feeds discovered URLs into the crawler alongside the explicit start URLs.

### Native binding

```
TS engine → require('@contextractor/extraction-native')
         → loader picks @contextractor/extraction-native-<platform>
         → loads contextractor-extraction-native.<platform>.node
         → calls into rs-trafilatura via napi-rs
```

Platform prebuilds (`darwin-arm64`, `darwin-x64`, `linux-x64-gnu`, `linux-arm64-gnu`) are committed under `packages/extraction/native/npm/<platform>/` and refreshed by CI on tag pushes. The `.node` files ship via `optionalDependencies` — no Rust toolchain needed in the production image.

## Stack

- **TypeScript 5.x** — all app logic
- **Rust 1.85+ (Edition 2024)** — only the `napi-rs` wrapper around `rs-trafilatura`; no other Rust crates
- **`rs-trafilatura` 0.2.x** — Rust port of Trafilatura; drives all extraction
- **Crawlee 3.x** with `PlaywrightCrawler` for crawling
- **Apify SDK 3.x** (Actor only)
- **commander** for the standalone CLI
- **Zod 4** for input schema and validation
- **vitest** — TypeScript unit tests; **cargo test** — Rust crate tests
- **Biome** — TypeScript lint + format
- **pnpm 10** workspace + **Cargo workspace** at the repo root
- **knip** — dead-code and unused-export analysis; `examples/` is excluded via `knip.json` (examples are not workspace packages and have no `workspace:*` deps)

## Tools

Internal tooling under `tools/` for development, testing, and code generation:

- **`gen-input-schema`** — generates `apps/apify-actor/.actor/input_schema.json` from the Zod schema
- **`gen-md-regions`** — auto-regenerates markdown sections in READMEs from schemas and JSON outputs
- **`platform-test-runner`** — orchestrates integration tests against Apify Platform
- **`proxy-simulator`** — mock HTTP proxy server for testing proxy rotation
- **`proxy-rotation-tester`** — comprehensive test suite for proxy rotation across all entry points

See individual tool README.md files for usage details.

## Input Schema

Canonical definition: `packages/schema/src/source-of-truth/input.ts` (`ContextractorInput` Zod schema).

`apps/apify-actor/.actor/input_schema.json` is generated at build time by `@contextractor/gen-input-schema`. The input table in `apps/apify-actor/README.md` is auto-rebuilt from the same schema by `@contextractor/gen-md-regions`.

### Content extraction fields

The public input surface exposes first-class top-level extraction fields rather than a nested `trafilaturaConfig` object:

- `mode` — `'precision' | 'balanced' | 'recall'` (default `'balanced'`)
- `includeComments` — boolean, default `true`
- `includeTables` — boolean, default `true`
- `includeImages` — boolean, default `false`
- `includeLinks` — boolean, default `true`
- `targetLanguage` — string, default `''` (empty means accept any language)

Internal binding-only knobs (`favorPrecision`, `favorRecall`, `includeFormatting`, `withMetadata`, `onlyWithMetadata`, `teiValidation`, `deduplicate`, `fast`) remain inside `@contextractor/extraction` / `@contextractor/crawler` and are not part of the user-facing schema.

### Standalone CLI config file

The CLI accepts an optional JSON config file with the same camelCase shape as the Apify input schema. CLI-only flags are `--proxy`, `--clean`, and the named-dataset override `--dataset`. Shared schema fields like `save`, `saveDestination`, `datasetName`, `keyValueStoreName`, and `requestQueueName` are honored from config.

Config merge order: `schema defaults → config file → explicit CLI args`.

## Output Schema

### Apify Actor — Dataset entry

**`saveDestination: ["key-value-store"]` (default)**

```json
{
  "url": "https://example.com/page",
  "status": "success",
  "metadata": {
    "title": "Page Title",
    "author": null,
    "publishedAt": "2024-01-15",
    "description": "Meta description",
    "siteName": "Example Site",
    "languageCode": "en"
  },
  "crawl": {
    "loadedUrl": "https://example.com/page",
    "loadedTime": "2026-04-27T18:58:36Z",
    "httpStatusCode": 200,
    "depth": 0,
    "referrerUrl": null
  },
  "original": {
    "hash": "d41d8cd98f00b204e9800998ecf8427e",
    "bytes": 89898,
    "key": "original-abc123.html",
    "url": "https://api.apify.com/v2/key-value-stores/{id}/records/original-abc123.html"
  },
  "markdown": { "hash": "...", "bytes": 6887, "key": "markdown-abc123.md", "url": "..." },
  "txt": { "hash": "...", "bytes": 5200, "key": "txt-abc123.txt", "url": "..." }
}
```

**`saveDestination: ["dataset"]`**

```json
{
  "url": "https://example.com/page",
  "status": "success",
  "metadata": { "title": "Page Title", "author": null, "publishedAt": "2024-01-15", "description": "Meta description", "siteName": "Example Site", "languageCode": "en" },
  "crawl": { "loadedUrl": "https://example.com/page", "loadedTime": "2026-04-27T18:58:36Z", "httpStatusCode": 200, "depth": 0, "referrerUrl": null },
  "original": { "hash": "d41d8cd98f00b204e9800998ecf8427e", "bytes": 89898 },
  "markdown": { "hash": "5d41402abc4b2a76b9719d911017c592", "bytes": 6887, "content": "# Page Title\n\nContent..." },
  "txt": { "hash": "7215ee9c7d9dc229d2921a40e899ec5f", "bytes": 5200, "content": "Page Title\n\nContent..." }
}
```

Rules:
- every content field is a `ContentNode` object: `hash` (32-char MD5) and `bytes` (UTF-8 byte length) are always present; the inline content is under `content` when `saveDestination` is `dataset`, while `key` + `url` reference the stored blob when `key-value-store`
- `original`: always present (at least `{ hash, bytes }`); its raw HTML is included (as `content`, or `key`/`url`) only when `"original"` is in `save`
- `markdown`, `txt`, `json`, `html`: present per format when extracted
- crawl provenance is nested under `crawl`: `loadedUrl`, `loadedTime`, `httpStatusCode`, `depth`, `referrerUrl` (the `failed` record's `crawl` holds only `loadedUrl`). Crawl-EVENT timestamps use `*Time` (`crawl.loadedTime`, failed `crawledTime`); content-metadata dates use `*At` (`metadata.publishedAt`)
- `metadata`: extracted via the napi-rs binding from `rs-trafilatura`; `languageCode` is the detected ISO 639 code

### Apify Actor — Key-Value Store

Storage keys are `{format}-{md5(url)}.{ext}` — the content format, the full 32-char MD5 hex of the request URL, and the format's extension. The same scheme is used by the standalone CLI/lib (shared `@contextractor/crawler` sink core) and groups into the `key_value_store_schema.json` collections by format prefix:

- `original-{md5}.html` — raw HTML (when `saveOriginal` is true)
- `txt-{md5}.txt` — plain text
- `json-{md5}.json` — JSON
- `markdown-{md5}.md` — Markdown
- `html-{md5}.html` — extracted HTML

### Standalone CLI — output

Output is identical in shape to the Apify Actor (shared sink core). Controlled by `saveDestination` / `--save-destination` (default `key-value-store`): KVS blobs use the same `{format}-{md5(url)}.{ext}` keys; a dataset record is pushed per page with `url`, `status: 'success'`, nested `metadata`, `crawl` (`loadedUrl`, `loadedTime`, `httpStatusCode`, `depth`, `referrerUrl`), `original`, and per-format content — each content field a `ContentNode` (`hash` + `bytes` always present; `key`/`url` for `key-value-store`, inline `content` for `dataset`). `status: 'failed'` records are pushed for exhausted retries, and optional `status: 'skipped'` records when `--store-skipped-urls` is set. The local key-value store has no public URL, so `ContentNode.url` is absent (it is present on the Apify platform).

`--clean` purges the default Dataset, Key-Value Store, and Request Queue before extraction begins.

The standalone CLI exits with code `2` when at least one request fails after retries, while still flushing dataset/KVS output for the rest of the crawl.

## Build

```bash
pnpm --filter @contextractor/extraction-native build:rebuild  # Host-platform .node
pnpm build                                                      # TypeScript packages (turbo)
cargo build --workspace                                         # Rust crate
```

Cross-platform `.node` prebuilds (CI runs the equivalent matrix):

```bash
pnpm --filter @contextractor/extraction-native exec -- napi build --platform --release --target aarch64-apple-darwin
pnpm --filter @contextractor/extraction-native exec -- napi build --platform --release --target x86_64-apple-darwin
pnpm --filter @contextractor/extraction-native exec -- napi build --platform --release --target x86_64-unknown-linux-gnu --zig
pnpm --filter @contextractor/extraction-native exec -- napi build --platform --release --target aarch64-unknown-linux-gnu --zig
```

## Docker (Apify Actor)

Multi-stage Dockerfile at `apps/apify-actor/Dockerfile`:

- **Builder stage** (`apify/actor-node-playwright-chrome:22 AS builder`): runs `pnpm install`, `pnpm --filter @contextractor/apify build`, then `pnpm --filter @contextractor/apify --prod deploy /deploy` to produce a self-contained bundle.
- **Runtime stage** (`apify/actor-node-playwright-chrome:22`): copies `/deploy` to `/usr/src/app`, runs `node dist/main.js`.

`actor.json` sets `"dockerContextDir": "../../.."` so the Docker build context is the repo root, exposing all `packages/`. Production deploys go through a **Git-connected build** in Apify Console — `apify push` does not honor `dockerContextDir` for contexts above the actor directory.

## CI

`.github/workflows/build-napi.yml` builds all four `.node` prebuilds on release tags (`v*`) and opens a PR refreshing `packages/extraction/native/npm/<platform>/`.
