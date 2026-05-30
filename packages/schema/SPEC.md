# @contextractor/schema — Specification

Zod 4 single source of truth for all Contextractor input. Both the Apify Actor and the standalone CLI feed raw input through `ContextractorInput.parse()`.

## Exports

- `ContextractorInput` — Zod schema; use `.parse()` or `.safeParse()` to validate and coerce input
- `ContextractorInputType` — TypeScript type inferred from the schema
- `ContextractorOutput` — Zod schema for dataset output items
- `ContextractorOutputType` — TypeScript type inferred from the output schema
- `apifyMeta(opts)` — helper to attach Apify Console UI metadata to schema fields
- `toApifyInputSchema(opts?)` — converts the Zod schema to Apify's `input_schema.json` format
- `writeApifyInputSchema(path)` — writes `input_schema.json` (called by `@contextractor/gen-input-schema`)

## Schema structure

Fields grouped by logical section:

- **Crawler settings** — `crawlerType` (enum: `playwright-adaptive|playwright-firefox|playwright-chromium|cheerio`, default `playwright-adaptive`), `renderingTypeDetectionPercentage` (int 0–100, default 10), `startUrls`, `includeUrlGlobs`, `excludeUrlGlobs`, `linkSelector`, `keepUrlFragments`, `useSitemaps` (bool, default `false`; fetches sitemap.xml at each start URL domain root and enqueues matching URLs), `deduplication` (enum: `none|url|content-hash`, default `'url'`; `url`: skip pages whose `<link rel="canonical">` was already extracted, across all handler types; `content-hash`: additionally skip pages whose extracted text content hash was already seen; `none`: only Crawlee's built-in URL dedup), `respectRobotsTxtFile`, `maxCrawlPages`, `maxResultsPerCrawl`, `maxCrawlDepth`, `initialConcurrency` (int ≥ 0, default `0`; maps to Crawlee `minConcurrency`; `0` lets Crawlee pick the default), `maxConcurrency`, `maxRequestRetries`
- **Auth** — `initialCookies`, `customHttpHeaders`
- **Content extraction** — `mode` (enum: `precision|balanced|recall`, default `balanced`), `includeComments` (bool, default `true`), `includeTables` (bool, default `true`), `includeImages` (bool, default `false`), `includeLinks` (bool, default `true`), `targetLanguage` (string, default `''`; empty = accept any language)
- **Output settings** — `save` (formats array: `txt|markdown|json|html|original`), `saveDestination` (sinks array: `key-value-store|dataset`), `datasetName`, `keyValueStoreName`, `requestQueueName`, `storeSkippedUrls` (bool, default `false`; pushes a dataset record for each skipped URL)
- **Proxy** — `proxyConfiguration`, `proxyRotation` (enum: `recommended|per-request|until-failure`, default `recommended`), `sessionPoolName` (string `[0-9A-Za-z_-]` 3–200 chars, optional; persists the session pool across runs under this key), `maxSessionRotations` (int 0–20, default `10`; max session rotations per request on block detection)
- **Browser** — `pageLoadTimeoutSecs`, `blockMedia` (bool, default `false`; blocks images, stylesheets, fonts, PDFs, ZIPs; no effect for `cheerio`), `dynamicContentWaitSecs` (int, default `0`; seconds to wait for network idle after navigation; also used as timeout for `waitForSelector`/`softWaitForSelector`; 0 disables), `waitUntil`, `headless`, `ignoreCorsAndCsp`, `closeCookieModals`, `maxScrollHeightPixels`, `userAgent`, `ignoreSslErrors`, `waitForSelector` (string, default `''`; CSS selector to await before extraction; request fails on timeout), `softWaitForSelector` (string, default `''`; like `waitForSelector` but continues on timeout)

## Schema generation pipeline

`@contextractor/gen-input-schema` reads this package at build time and writes `apps/apify-actor/.actor/input_schema.json`. `@contextractor/gen-md-regions` reads the generated JSON to rebuild the input table in `apps/apify-actor/README.md`. Both run via `pnpm docs:update`.

## Output schema

`ContextractorOutput` is a Zod `discriminatedUnion('status', …)` over the three dataset record shapes — `success`, `failed`, `skipped`. Exported as `ContextractorOutput` (Zod schema) and `ContextractorOutputType` (the inferred 3-member union type). The dataset/output/key-value-store schema generators (`apify/to-dataset-schema.ts`, `apify/to-output-schema.ts`, `apify/to-kvs-schema.ts`) consume it alongside the `OutputViews` / `KvsCollections` presentation config (`apify/output-views.ts`) to emit all of `apps/apify-actor/.actor/dataset_schema.json`, `output_schema.json`, and `key_value_store_schema.json` via `@contextractor/gen-input-schema`.

`ContentNode` — object describing one piece of content (an extracted format or the raw original HTML):
- `hash` — MD5 hex digest of the content (always present)
- `bytes` — UTF-8 byte length (always present)
- `content` — inline content string (optional; present when `saveDestination` includes `"dataset"`)
- `key` — KVS key (optional; present when stored to the key-value store)
- `url` — public URL to the KVS item (optional; present when a public KVS URL exists)

Record shapes:

- **`success`** — `url`, `loadedUrl`, `status: 'success'`, `loadedAt` (ISO 8601), `metadata` (object of nullable strings: `title`, `author`, `publishedAt`, `description`, `siteName`, `lang`), `httpStatus` (integer; currently always 200), `crawl: { depth, referrerUrl }`, `original` (a `ContentNode`, always present — at least `{ hash, bytes }`), and the optional content fields `txt` / `markdown` / `json` / `html` (each a `ContentNode`). Every content field carries the inline `content` when `saveDestination` includes `"dataset"`, or `key` + `url` when `"key-value-store"`.
- **`failed`** — `url`, `loadedUrl` (nullable), `status: 'failed'`, `errorMessages` (string array), `retryCount` (integer), `crawledAt` (ISO 8601).
- **`skipped`** — `url`, `status: 'skipped'`, `skipReason` (`'robotsTxt' | 'limit' | 'enqueueLimit' | 'filters' | 'redirect' | 'depth'`).
