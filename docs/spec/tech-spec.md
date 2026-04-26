# Contextractor - Technical Specification

## Stack

- TypeScript 5.7+ on Node.js 22+
- pnpm workspace monorepo (Cargo workspace alongside for the napi-rs crate)
- Crawlee for TypeScript with `PlaywrightCrawler`
- Apify SDK (Apify actor only)
- `@contextractor/engine` (TypeScript wrapper around `rs-trafilatura` via napi-rs)
- `commander` CLI (standalone app)
- vitest for tests, Biome for lint/format
- Apify Docker image for the actor; no public Docker / npm distribution for the standalone CLI in this repo

## Architecture

Three-package monorepo:

- `packages/contextractor-engine/` — TypeScript engine, depends on `@contextractor/engine-native`
- `packages/contextractor-engine/native/` — napi-rs Rust crate that wraps `rs-trafilatura` (Cargo workspace member)
- `apps/contextractor-apify/` — Apify Actor application, depends on engine + apify + crawlee
- `apps/contextractor-standalone/` — Standalone CLI, depends on engine + crawlee + commander (no Apify)

### Apify Actor

```
Input URLs → PlaywrightCrawler → ContentExtractor (TS → napi → rs-trafilatura) → KVS (blobs) + Dataset (metadata)
```

### Standalone CLI

```
Config file (JSON) → PlaywrightCrawler → ContentExtractor → Output files (one per page)
```

## Key Implementation Details

### Apify Actor Handler Pattern

`Actor.init()` / `Actor.exit()` brackets, with a request handler factory wired into `PlaywrightCrawler`:

```ts
import { Actor } from 'apify';
import { PlaywrightCrawler } from 'crawlee';
import { ContentExtractor } from '@contextractor/engine';

await Actor.init();
try {
    const input = (await Actor.getInput()) ?? {};
    const kvs = await Actor.openKeyValueStore();
    const extractor = new ContentExtractor(input.trafilaturaConfig);

    const crawler = new PlaywrightCrawler({
        async requestHandler(ctx) {
            const html = await ctx.page.content();
            const r = extractor.extract(html, { url: ctx.request.url, format: 'markdown' });
            // save to kvs / push dataset...
        },
    });
    await crawler.run(input.startUrls);
    await Actor.exit();
} catch (err) {
    await Actor.exit({ exitCode: 1 });
}
```

### Standalone CLI

CLI args / Config file (optional) → `CrawlConfig` → Crawlee `PlaywrightCrawler` → output files.

```bash
# Zero-config with URL
contextractor https://example.com

# With flags
contextractor https://example.com --precision --save json -o ./results

# With config file
contextractor --config config.json --max-pages 10
```

Config merge order: `defaults → config file (if provided) → CLI args`

All `CrawlConfig` and `TrafilaturaConfig` fields have CLI flag equivalents. URLs are positional args, config file is optional via `--config`.

### Content-Type Headers

All content-type headers must include charset: `text/html; charset=utf-8`.

### Public URLs

Use `kvs.getPublicUrl(key)` to get download URLs.

### TrafilaturaConfig

TypeScript interface mapping to `rs-trafilatura::Options`:

```ts
import { ContentExtractor, type TrafilaturaConfig } from '@contextractor/engine';

const cfg: Partial<TrafilaturaConfig> = {
    favorPrecision: true,
    includeLinks: false,
    targetLanguage: 'en',
};

const extractor = new ContentExtractor(cfg);
const result = extractor.extract(html, { url, format: 'markdown' });
const metadata = extractor.extractMetadata(html, url);
```

Supported formats: `txt`, `markdown`, `json`, `html`. `xml` and `xml-tei` are temporarily unsupported pending upstream `rs-trafilatura` work.

### Key Generation

MD5 hash of URL, first 16 characters: `createHash('md5').update(url).digest('hex').slice(0, 16)`.

### Browser Context Options

Custom headers and cookies are passed through Crawlee TS hooks:

```ts
preNavigationHooks: [
    async ({ page }) => {
        if (input.customHttpHeaders) {
            await page.setExtraHTTPHeaders(input.customHttpHeaders);
        }
    },
],
```

This applies headers to all HTTP requests; cookies can be pre-set via the launch context's `storageState`.

## Dependencies

Engine package (`packages/contextractor-engine/`):

```
@contextractor/engine-native (workspace, napi-rs binding)
```

napi-rs binding (`packages/contextractor-engine/native/`):

```
rs-trafilatura = "0.2"
napi = "2"
napi-derive = "2"
napi-build = "2"
serde, serde_json
```

Apify Actor (`apps/contextractor-apify/`):

```
apify
crawlee
playwright
@contextractor/engine (workspace)
```

Standalone CLI (`apps/contextractor-standalone/`):

```
commander
crawlee
playwright
@contextractor/engine (workspace)
```

## Build

Build the napi-rs binding for the local platform:

```bash
pnpm -F @contextractor/engine-native build
```

Build the TS engine and apps:

```bash
pnpm -r build
```

## Docker

### Apify Actor (`apps/contextractor-apify/Dockerfile`)

Base: `apify/actor-node-playwright-chrome:22`. The Dockerfile installs `pnpm`, copies workspace manifests, installs deps, builds the napi-rs binding inside the image (Rust toolchain fetched via `rustup` and removed after build), then builds the TS apps:

```dockerfile
FROM apify/actor-node-playwright-chrome:22
RUN npm install -g pnpm@10.27.0
COPY --chown=myuser:myuser package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --chown=myuser:myuser packages/contextractor-engine/package.json packages/contextractor-engine/
COPY --chown=myuser:myuser packages/contextractor-engine/native/package.json packages/contextractor-engine/native/
COPY --chown=myuser:myuser apps/contextractor-apify/package.json apps/contextractor-apify/
RUN pnpm install --frozen-lockfile --prod=false
COPY --chown=myuser:myuser packages/ packages/
COPY --chown=myuser:myuser apps/contextractor-apify/ apps/contextractor-apify/
RUN pnpm -F @contextractor/engine-native build \
    && pnpm -F @contextractor/engine build \
    && pnpm -F @contextractor/apify build
WORKDIR /home/myuser/apps/contextractor-apify
CMD ["node", "dist/main.js"]
```

## Releases

Test deployments target `glueo/contextractor-test`. Production deployments target `glueo/contextractor` and require an explicit `--production` flag in `/platform:push-and-get-working`.

Versions are bumped jointly across `package.json` files (engine, native, apify, standalone) and the Cargo `Cargo.toml` for the napi-rs crate. See `/git:release`.
