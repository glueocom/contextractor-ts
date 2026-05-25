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

- **Crawler settings** — `crawlerType` (enum: `playwright:adaptive|playwright:firefox|playwright:chromium|cheerio`, default `playwright:adaptive`), `renderingTypeDetectionPercentage` (int 0–100, default 10), `startUrls`, `globs`, `excludes`, `linkSelector`, `keepUrlFragments`, `useSitemaps` (bool, default `false`; fetches sitemap.xml at each start URL domain root and enqueues matching URLs), `deduplication` (enum: `minimal|basic|full`, default `'basic'`; `basic`: skip pages whose `<link rel="canonical">` was already extracted, across all handler types; `full`: additionally skip pages whose extracted text content hash was already seen; `minimal`: only Crawlee's built-in URL dedup), `respectRobotsTxtFile`, `maxPagesPerCrawl`, `maxResultsPerCrawl`, `maxCrawlingDepth`, `initialConcurrency` (int ≥ 0, default `0`; maps to Crawlee `minConcurrency`; `0` lets Crawlee pick the default), `maxConcurrency`, `maxRequestRetries`
- **Auth** — `initialCookies`, `customHttpHeaders`
- **Content extraction** — `mode` (enum: `precision|balanced|recall`, default `balanced`), `includeComments` (bool, default `true`), `includeTables` (bool, default `true`), `includeImages` (bool, default `false`), `includeLinks` (bool, default `true`), `targetLanguage` (string, default `''`; empty = accept any language)
- **Output settings** — `save` (formats array: `txt|markdown|json|html|original`), `saveDestination` (sinks array: `key-value-store|dataset`), `datasetName`, `keyValueStoreName`, `requestQueueName`, `storeSkippedUrls` (bool, default `false`; pushes a dataset record for each skipped URL)
- **Proxy** — `proxyConfiguration`, `proxyRotation`, `tieredProxyUrls` (`(string|null)[][]`, optional; tiers of proxy URLs for automatic escalation — Crawlee starts on tier 0 and escalates per domain on block detection; Actor-only), `tieredProxyConfig` (array of Apify proxy config objects, optional; Actor-only alternative to `tieredProxyUrls`; mutually exclusive with `tieredProxyUrls`), `sessionPoolName` (string `[0-9A-Za-z_-]` 3–200 chars, optional; persists the session pool across runs under this key), `maxSessionRotations` (int 0–20, default `10`; max session rotations per request on block detection)
- **Browser** — `pageLoadTimeoutSecs`, `blockMedia` (bool, default `false`; blocks images, stylesheets, fonts, PDFs, ZIPs; no effect for `cheerio`), `dynamicContentWaitSecs` (int, default `0`; seconds to wait for network idle after navigation; also used as timeout for `waitForSelector`/`softWaitForSelector`; 0 disables), `waitUntil`, `headless`, `ignoreCorsAndCsp`, `closeCookieModals`, `maxScrollHeightPixels`, `userAgent`, `ignoreSslErrors`, `waitForSelector` (string, default `''`; CSS selector to await before extraction; request fails on timeout), `softWaitForSelector` (string, default `''`; like `waitForSelector` but continues on timeout)

## Schema generation pipeline

`@contextractor/gen-input-schema` reads this package at build time and writes `apps/apify-actor/.actor/input_schema.json`. `@contextractor/gen-md-regions` reads the generated JSON to rebuild the input table in `apps/apify-actor/README.md`. Both run via `pnpm docs:update`.

## Output schema

`ContextractorOutput` is the Zod schema for each item written to the Apify dataset. Exported as `ContextractorOutput` (Zod schema) and `ContextractorOutputType` (inferred TypeScript type).

`ContentRef` — object identifying content stored in the key-value store:
- `hash` — MD5 hex digest of the content
- `length` — byte length
- `key` — KVS key (optional; present when saved to KVS)
- `url` — public URL to the KVS item (optional; present when KVS public URL is configured)

`ContentField` — union of `ContentRef | string`. A `ContentRef` when `saveDestination` includes `"key-value-store"`, an inline string when `"dataset"` only.

`ContextractorOutput` fields:
- `loadedUrl` — string; the URL that was loaded (post-redirect)
- `httpStatus` — integer; HTTP response status code
- `loadedAt` — string; ISO 8601 timestamp of when the page was loaded
- `metadata` — object; all fields are nullable strings: `title`, `author`, `publishedAt` (ISO 8601), `description`, `siteName`, `lang`
- `original` — `ContentField`, optional; raw page HTML before extraction; present when `"original"` is in `save`
- `txt` — `ContentField`, optional; extracted plain text; present when `"txt"` is in `save`
- `markdown` — `ContentField`, optional; extracted Markdown; present when `"markdown"` is in `save`
- `json` — `ContentField`, optional; extracted structured JSON; present when `"json"` is in `save`
- `html` — `ContentField`, optional; cleaned extracted HTML; present when `"html"` is in `save`

> **Note:** `createApifySink` writes additional envelope fields not declared in this schema: `url` (original request URL), `status: 'success'`, `originalHash` (MD5 hex of raw HTML), `crawl: { depth, referrerUrl }`, and per-format hash fields (`txtHash`, `markdownHash`, etc.) when `saveDestination` includes `"dataset"`. These are documented in `apps/apify-actor/SPEC.md` and root `SPEC.md`.
