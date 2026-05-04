# Contextractor — Specification

## Overview

Contextractor crawls websites and extracts clean, readable main-content text.
Built on **`rs-trafilatura`** (Rust port of Trafilatura, called via a napi-rs binding) and **[Crawlee](https://crawlee.dev/)** (TypeScript crawler driving Playwright).

Available as:

- **Apify Actor** — `glueo/contextractor` on the Apify platform; output saved to the run's Key-Value Store + Dataset.
- **Standalone CLI** (`@contextractor/standalone`) — local TypeScript CLI; output written to disk as one file per page.
- **TypeScript engine** (`@contextractor/extraction`) — embedded library used by both surfaces above; exposes `ContentExtractor`, `extractMetadata`, and `extractAllFormats`.

## Stack

- **TypeScript 5.x** for all app logic
- **Rust 1.85+** (Edition 2024) — only the `napi-rs` wrapper around `rs-trafilatura`; no other Rust crates in this workspace
- **`rs-trafilatura` 0.2.x** — Rust port of Trafilatura; drives all extraction
- **Crawlee 3.x (TypeScript)** with `PlaywrightCrawler` for crawling
- **Apify SDK 3.x** (Apify Actor only)
- **commander** for the standalone CLI
- **vitest** for unit tests; **cargo test** for the napi-rs crate's tests
- **Biome** for TS lint + format
- **pnpm 10** workspace + **Cargo workspace** at the repo root

## Output Formats

Supported: **`txt | markdown | json | html`**. XML and XML-TEI are temporarily unsupported pending upstream `rs-trafilatura` support.

## Architecture

```
apps/
├── apify-actor/               # Apify Actor
└── standalone/                # CLI
packages/
├── extraction/                # TypeScript engine + napi-rs Rust crate
├── crawler/                   # Shared Crawlee + Playwright crawler
└── schema/                    # Shared Zod 4 input schema
tools/
├── platform-test-runner/      # test orchestrator
├── gen-input-schema/          # generates .actor/input_schema.json from Zod schema
├── gen-md-regions/            # rewrites @generated markdown regions in READMEs
└── opencode-sync/             # mirrors .claude/ to .opencode/
```

### Data flow

```
Apify Actor:
Input URLs → PlaywrightCrawler → ContentExtractor (TS) → KVS (blobs) + Dataset (metadata)

Standalone CLI:
Config file (JSON) → PlaywrightCrawler → ContentExtractor (TS) → output files
```

### Native binding

```
TS engine → require('@contextractor/extraction-native')
         → loader picks @contextractor/extraction-native-<platform>
         → loads contextractor-extraction-native.<platform>.node
         → calls into rs-trafilatura via napi-rs
```

`@contextractor/extraction-native` declares per-platform packages in `optionalDependencies`. pnpm selects the platform-matching one via `os` + `cpu` resolution at install time. Prebuilds for `darwin-arm64`, `darwin-x64`, `linux-x64-gnu`, `linux-arm64-gnu` are committed to git and refreshed by `.github/workflows/build-napi.yml` on tag pushes.

## Input Schema

The Zod 4 schema in `@contextractor/schema` is the single source of truth for every input field. The Apify `input_schema.json` is generated from it by `@contextractor/gen-input-schema` — never hand-edited. Both the Apify Actor and the standalone CLI validate input via `ContextractorInput.parse()`.

### `trafilaturaConfig`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| fast | boolean | false | Fast mode (less thorough) |
| favorPrecision | boolean | false | High precision, less noise |
| favorRecall | boolean | false | High recall, more content |
| includeComments | boolean | true | Include comments |
| includeTables | boolean | true | Include tables |
| includeImages | boolean | false | Include images |
| includeFormatting | boolean | true | Preserve formatting |
| includeLinks | boolean | true | Include links |
| deduplicate | boolean | false | Deduplicate content |
| targetLanguage | string | null | Target language code |
| withMetadata | boolean | true | Forward-compat — always extracted |
| onlyWithMetadata | boolean | false | Only return if metadata found |
| teiValidation | boolean | false | Forward-compat — accepted but ignored |

Keys accept both camelCase (JSON convention) and snake_case; snake_case is converted internally.

## Standalone CLI

### Usage

```bash
contextractor [OPTIONS] [URLS...]
contextractor https://example.com
contextractor https://example.com --precision --save json -o ./results
contextractor --config config.json --max-pages 10
```

### Config file (JSON)

Accepts a JSON config file with the same camelCase shape as the Apify input schema. Validated against the Zod 4 schema; unknown keys stripped by `parse()`. CLI-only orchestration flags (`--output-dir`, `--save`, `--proxy-urls`) are not accepted in the config file. Config merge order: `config file → CLI args → ContextractorInput.parse()`. Defaults come from Zod `.default(...)` calls.

### Output

One file per crawled page, named from a URL slug (e.g. `example-com-page.md`). A metadata header (title, author, date, URL) is prepended to text-format outputs when metadata is available.

## Apify Actor

### Output

#### Dataset entry

```json
{
  "loadedUrl": "https://example.com/page",
  "rawHtml": { "hash": "...", "length": 89898, "key": "abc123-raw.html", "url": "..." },
  "extractedMarkdown": { "key": "abc123.md", "url": "...", "hash": "...", "length": 6887 },
  "loadedAt": "2026-04-27T18:58:36Z",
  "metadata": { "title": "...", "author": null, "publishedAt": "2024-01-15", "description": "...", "siteName": "...", "lang": "en" },
  "httpStatus": 200
}
```

- `rawHtml`: always has `hash` + `length`; adds `key` + `url` only if raw HTML is saved.
- Format fields (`extractedMarkdown`, `extractedText`, `extractedJson`): present only when the matching input flag is enabled.
- `metadata`: extracted via the napi-rs binding from `rs-trafilatura`.

#### Key-Value Store

Files keyed by the first 16 hex characters of an MD5 over the URL:

- `{hash}-raw.html` — raw HTML
- `{hash}.txt` — plain text
- `{hash}.json` — JSON with metadata
- `{hash}.md` — Markdown

## Dependencies

### `packages/extraction/` (TS)

- `@contextractor/extraction-native` (workspace)

### `packages/extraction/native/` (Rust)

- `napi`, `napi-derive`
- `rs-trafilatura ^0.2`
- `serde`, `serde_json`, `chrono`

### `packages/crawler/` (TS)

- `@contextractor/extraction` (workspace)
- `crawlee ^3`, `playwright ^1.50`
- `@ghostery/adblocker-playwright ^2`
- `@duckduckgo/autoconsent ^14` (optional)

### `apps/apify-actor/`

- `apify ^3`
- `@contextractor/extraction`, `@contextractor/crawler`, `@contextractor/schema` (workspace)

### `apps/standalone/`

- `commander ^12`
- `@contextractor/extraction`, `@contextractor/crawler`, `@contextractor/schema` (workspace)

### `packages/schema/` (TS)

- `zod ^4`

## Build

```bash
# Local prebuild for host platform
pnpm --filter @contextractor/extraction-native build:rebuild

# TypeScript build
pnpm build
```

Cross-platform prebuilds for `darwin-arm64`, `darwin-x64`, `linux-x64-gnu`, `linux-arm64-gnu` are built by CI on release tag pushes.

## Docker (Apify Actor)

Multi-stage Dockerfile at `apps/apify-actor/Dockerfile`:

- Builder stage: `apify/actor-node-playwright-chrome:22`. Runs `pnpm install`, builds, then `pnpm --filter @contextractor/apify --prod deploy /deploy` to produce a self-contained bundle.
- Runtime stage: copies `/deploy` and runs `node dist/main.js`.

`actor.json` sets `"dockerContextDir": "../../.."` so the Docker build context is the repo root. Production deploys go through a **Git-connected build** in Apify Console — `apify push` does not honor `dockerContextDir` for contexts above the actor dir.

## CI

`.github/workflows/build-napi.yml` builds all four `.node` prebuilds on release tags (`v*`) and opens a PR refreshing `packages/extraction/native/npm/<platform>/`.
