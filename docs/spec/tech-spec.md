# Contextractor — Technical Specification

## Stack

- **TypeScript 5.x** for all app logic.
- **Rust 1.85+** (Edition 2024) — only the `napi-rs` wrapper around
  `rs-trafilatura`; no other Rust crates in this workspace.
- **`rs-trafilatura` 0.2.x** — Rust port of Trafilatura. Drives all extraction.
- **Crawlee 3.x (TypeScript)** with `PlaywrightCrawler` for crawling.
- **Apify SDK 3.x** (Apify Actor only).
- **commander** for the standalone CLI.
- **vitest** for unit tests; **cargo test** for the napi-rs crate's tests.
- **Biome** for TS lint + format.
- **npm 10** workspace + **Cargo workspace** at the repo root.

## Architecture

Two apps + one engine package + one Rust crate:

- `packages/extraction/` — TypeScript engine; depends on the napi-rs
  binding via `@contextractor/engine-native`.
- `packages/extraction/native/` — `napi-rs` Rust crate
  (`crate-type = "cdylib"`). Wraps `rs-trafilatura` and produces a `.node`
  binary loaded by the TS engine. Per-platform prebuilds live under
  `packages/extraction/native/npm/<platform>/` as workspace packages
  with `os` + `cpu` selectors.
- `apps/apify-actor/` — Apify Actor; depends on
  `@contextractor/engine` + `@contextractor/schema` + `apify` + `crawlee` +
  `playwright`.
- `apps/standalone/` — Standalone CLI; depends on
  `@contextractor/engine` + `@contextractor/schema` + `crawlee` +
  `playwright` + `commander`.
- `packages/schema/` — Single Zod 4 source of truth for input.
  Exports `ContextractorInput`, `ContextractorInputType`, the `apifyMeta()`
  helper, and `writeApifyInputSchema()`. The Apify INPUT_SCHEMA file is
  generated from this schema at build time by
  `@contextractor/gen-input-schema`.

### Apify Actor

```
Input URLs → PlaywrightCrawler → ContentExtractor (TS) → KVS (blobs) + Dataset (metadata)
```

### Standalone CLI

```
Config file (JSON) → PlaywrightCrawler → ContentExtractor (TS) → output files
```

### Native binding (`@contextractor/engine-native`)

```
TS engine → require('@contextractor/engine-native')
         → loader picks @contextractor/engine-native-<platform>
         → loads contextractor-engine-native.<platform>.node
         → calls into rs-trafilatura via napi-rs
```

The `@contextractor/engine-native` package declares each per-platform package
in `optionalDependencies`. npm picks the platform-matching one via `os` +
`cpu` resolution at install time. The `.node` files for `darwin-arm64`,
`darwin-x64`, `linux-x64-gnu`, and `linux-arm64-gnu` are committed to git and
refreshed by `.github/workflows/build-napi.yml` on tag pushes.

## Key implementation details

### Apify Actor handler

```ts
import { Actor } from 'apify';
import { PlaywrightCrawler, Request } from 'crawlee';
import { ContentExtractor } from '@contextractor/engine';
import { ContextractorInput } from '@contextractor/schema';

await Actor.init();
const raw = (await Actor.getInput()) ?? {};
const input = ContextractorInput.parse(raw);
const config = buildCrawlConfig(input);
const crawler = new PlaywrightCrawler({ /* ... */ });

crawler.router.addDefaultHandler(async (ctx) => {
  const handlerConfig = ctx.request.userData?.config as CrawlConfig;
  const extractor = new ContentExtractor(handlerConfig.trafilaturaConfig);
  const html = await ctx.page.content();
  // extract and save...
});

await crawler.run(startUrls.map((url) => new Request({ url, userData: { config } })));
await Actor.exit();
```

### Standalone CLI

```bash
# Zero-config with URL
contextractor https://example.com

# With flags
contextractor https://example.com --precision --save json -o ./results

# With config file
contextractor --config config.json --max-pages 10
```

Config merge order: `defaults → config file (if provided) → CLI args`.

### Content-type headers

All content-type headers include charset, e.g.
`text/html; charset=utf-8`.

### `TrafilaturaConfig`

The TS engine API mirrors the Python source. Camel-case keys; snake-case keys
are accepted and normalized at the boundary by the engine. The Apify Actor
and standalone CLI both feed user input through `ContextractorInput.parse()`
in `@contextractor/schema` (Zod 4 validation at the input boundary), then
pass the typed result into the engine.

```ts
import { ContentExtractor } from '@contextractor/engine';

const extractor = new ContentExtractor({ favorPrecision: true });
const result = extractor.extract(html, { url, format: 'markdown' });
const metadata = extractor.extractMetadata(html, url);
const all = extractor.extractAllFormats(html, { url });
```

Supported formats: `txt | markdown | json | html`.

### Key generation

Storage keys use the first 16 hex characters of an MD5 over the URL:
`createHash('md5').update(url).digest('hex').slice(0, 16)`.

## Dependencies

`packages/extraction/` (TS):

- `@contextractor/engine-native` (workspace)

`packages/extraction/native/` (Rust):

- `napi`, `napi-derive`
- `rs-trafilatura ^0.2`
- `serde`, `serde_json`, `chrono`

`apps/apify-actor/`:

- `apify ^3`
- `crawlee ^3`
- `playwright ^1.50`
- `@contextractor/engine` (workspace)
- `@contextractor/schema` (workspace)

`apps/standalone/`:

- `crawlee ^3`
- `playwright ^1.50`
- `commander ^12`
- `@contextractor/engine` (workspace)
- `@contextractor/schema` (workspace)

`packages/schema/` (TS):

- `zod ^4`

## Build

Local prebuild for the host platform:

```bash
npm run build -w @contextractor/engine-native
```

Cross-platform prebuilds (CI runs the equivalent matrix):

```bash
npm exec -w @contextractor/engine-native -- napi build --platform --release --target aarch64-apple-darwin
npm exec -w @contextractor/engine-native -- napi build --platform --release --target x86_64-apple-darwin
npm exec -w @contextractor/engine-native -- napi build --platform --release --target x86_64-unknown-linux-gnu --zig
npm exec -w @contextractor/engine-native -- napi build --platform --release --target aarch64-unknown-linux-gnu --zig
```

TypeScript builds:

```bash
npm run build
```

## Docker (Apify Actor)

Multi-stage Node + Playwright Dockerfile at
`apps/apify-actor/Dockerfile`:

- Builder stage: `apify/actor-node-playwright-chrome:22 AS builder`. Runs
  `npm ci`, `npm run build -w @contextractor/apify`, then
  `npm run deploy --prod -w @contextractor/apify -- /deploy` to produce a
  self-contained actor bundle with no workspace symlinks.
- Runtime stage: `apify/actor-node-playwright-chrome:22`. Copies `/deploy` to
  `/usr/src/app` and runs `node dist/main.js`.

`actor.json` sets `"dockerContextDir": "../../.."` so the Docker build context
is the repo root, exposing `packages/extraction/`. Production
deploys go through a **Git-connected build** in the Apify Console — `apify
push` does not honor `dockerContextDir` for contexts above the actor dir.

Reference: `github.com/apify/actor-monorepo-example`.

## CI

`.github/workflows/build-napi.yml` builds all four `.node` prebuilds on
release tags (`v*`) and opens a PR refreshing
`packages/extraction/native/npm/<platform>/`. No other CI workflows
are in scope of the napi-rs migration; lint / test / security workflows can be
added separately.
