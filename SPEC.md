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
Input URLs → PlaywrightCrawler → ContentExtractor (TS) → sink
                                                         ├── KVS + Dataset       (Actor)
                                                         └── files + KVS/Dataset (CLI)
```

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

## Input Schema

Canonical definition: `packages/schema/src/source-of-truth/input.ts` (`ContextractorInput` Zod schema).

`apps/apify-actor/.actor/input_schema.json` is generated at build time by `@contextractor/gen-input-schema`. The input table in `apps/apify-actor/README.md` is auto-rebuilt from the same schema by `@contextractor/gen-md-regions`.

### `trafilaturaConfig`

Pass as a JSON object; leave empty for balanced defaults.

| Field             | Type    | Default | Description                           |
| ----------------- | ------- | ------- | ------------------------------------- |
| fast              | boolean | `false` | Fast mode (less thorough)             |
| favorPrecision    | boolean | `false` | High precision, less noise            |
| favorRecall       | boolean | `false` | High recall, more content             |
| includeComments   | boolean | `true`  | Include comments                      |
| includeTables     | boolean | `true`  | Include tables                        |
| includeImages     | boolean | `false` | Include images                        |
| includeFormatting | boolean | `true`  | Preserve formatting                   |
| includeLinks      | boolean | `true`  | Include links                         |
| deduplicate       | boolean | `false` | Deduplicate content                   |
| targetLanguage    | string  | `null`  | Target language code                  |
| withMetadata      | boolean | `true`  | Forward-compat — always extracted     |
| onlyWithMetadata  | boolean | `false` | Return only if metadata found         |
| teiValidation     | boolean | `false` | Forward-compat — accepted but ignored |
| urlBlacklist      | string[] | `null`  | URL patterns to exclude               |
| authorBlacklist   | string[] | `null`  | Author names to exclude               |

Keys accept both camelCase and snake_case; snake_case is normalized internally.

Backward-compat presets:
- `{}` or omitted → balanced default
- `{"favorPrecision": true}` → high precision mode
- `{"favorRecall": true}` → high recall mode

### Standalone CLI config file

The CLI accepts an optional JSON config file with the same camelCase shape as the Apify input schema. CLI-only flags (`--output-dir`, `--save`, `--proxy-urls`) are not accepted in the config file.

Config merge order: `config file → CLI args → ContextractorInput.parse()`.

## Output Schema

### Apify Actor — Dataset entry

**`saveDestination: ["key-value-store"]` (default)**

```json
{
  "loadedUrl": "https://example.com/page",
  "loadedAt": "2026-04-27T18:58:36Z",
  "metadata": {
    "title": "Page Title",
    "author": null,
    "publishedAt": "2024-01-15",
    "description": "Meta description",
    "siteName": "Example Site",
    "lang": "en"
  },
  "httpStatus": 200,
  "originalHash": "d41d8cd98f00b204e9800998ecf8427e",
  "original": {
    "hash": "d41d8cd98f00b204e9800998ecf8427e",
    "length": 89898,
    "key": "abc123-original.html",
    "url": "https://api.apify.com/v2/key-value-stores/{id}/records/abc123-original.html"
  },
  "markdown": { "key": "abc123.md", "url": "...", "hash": "...", "length": 6887 },
  "txt": { "key": "abc123.txt", "url": "...", "hash": "...", "length": 5200 }
}
```

**`saveDestination: ["dataset"]`**

```json
{
  "loadedUrl": "https://example.com/page",
  "loadedAt": "2026-04-27T18:58:36Z",
  "metadata": { "title": "Page Title", "author": null, "publishedAt": "2024-01-15", "description": "Meta description", "siteName": "Example Site", "lang": "en" },
  "httpStatus": 200,
  "originalHash": "d41d8cd98f00b204e9800998ecf8427e",
  "markdown": "# Page Title\n\nContent...",
  "markdownHash": "5d41402abc4b2a76b9719d911017c592",
  "txt": "Page Title\n\nContent...",
  "txtHash": "7215ee9c7d9dc229d2921a40e899ec5f"
}
```

Rules:
- `originalHash`: always present; 32-char MD5 hex of the raw HTML
- `original`: present when `saveOriginal` is true; a `ContentInfo` object (`hash`, `length`, `key`, `url`) when saved to KVS, or the raw HTML string when `saveDestination` is `dataset` only
- `markdown`, `txt`, `json`, `html`: present per format when extracted; `ContentInfo` objects when `saveDestination` is `key-value-store`; inline content strings when `dataset`, each accompanied by a `{format}Hash` field (e.g. `markdownHash`, `txtHash`) containing the 32-char MD5 hex of that content
- `metadata`: extracted via the napi-rs binding from `rs-trafilatura`

### Apify Actor — Key-Value Store

Storage keys use the first 16 hex characters of an MD5 over the URL:
`createHash('md5').update(url).digest('hex').slice(0, 16)`

- `{hash}-original.html` — raw HTML (when `saveOriginal` is true)
- `{hash}.txt` — plain text
- `{hash}.json` — JSON
- `{hash}.md` — Markdown
- `{hash}.html` — extracted HTML

### Standalone CLI — output

**File output** (default, backwards-compatible): one file per crawled page in `--output-dir` (default `./output/`), named from a URL slug (e.g. `example-com-page.md`). Metadata header prepended to text-format outputs when available.

**Crawlee storage** (controlled by `--save-destination`): KVS keys use URL slug (`${slug}.${ext}` or `${slug}-original.html`); Dataset records carry `url`, metadata, `originalHash` (MD5 of raw HTML), per-format content as inline strings, and a `{format}Hash` field alongside each saved format.

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
