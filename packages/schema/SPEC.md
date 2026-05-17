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

- **Crawler settings** — `crawlerType` (enum: `playwright:adaptive|playwright:firefox|playwright:chromium|cheerio`, default `playwright:adaptive`), `renderingTypeDetectionPercentage` (int 0–100, default 10), `startUrls`, `globs`, `excludes`, `linkSelector`, `keepUrlFragments`, `useSitemaps` (bool, default `false`; fetches sitemap.xml at each start URL domain root and enqueues matching URLs), `ignoreCanonicalUrl` (bool, default `false`; when `false`, pages whose `<link rel="canonical">` was already extracted are skipped; when `true`, every loaded URL is extracted regardless; Playwright-only), `respectRobotsTxtFile`, `maxPagesPerCrawl`, `maxResultsPerCrawl`, `maxCrawlingDepth`, `initialConcurrency` (int ≥ 0, default `0`; maps to Crawlee `minConcurrency`; `0` lets Crawlee pick the default), `maxConcurrency`, `maxRequestRetries`
- **Auth** — `initialCookies`, `customHttpHeaders`
- **Content extraction** — `mode` (enum: `precision|balanced|recall`, default `balanced`), `includeComments` (bool, default `true`), `includeTables` (bool, default `true`), `includeImages` (bool, default `false`), `includeLinks` (bool, default `true`), `targetLanguage` (string, default `''`; empty = accept any language)
- **Output settings** — `save` (formats array: `txt|markdown|json|html|original`), `saveDestination` (sinks array: `key-value-store|dataset`), `datasetName`, `keyValueStoreName`, `requestQueueName`, `storeSkippedUrls` (bool, default `false`; pushes a dataset record for each skipped URL)
- **Proxy** — `proxyConfiguration`, `proxyRotation`
- **Browser** — `pageLoadTimeoutSecs`, `blockMedia` (bool, default `false`; blocks images, stylesheets, fonts, PDFs, ZIPs; no effect for `cheerio`), `dynamicContentWaitSecs` (int, default `0`; seconds to wait for network idle after navigation; also used as timeout for `waitForSelector`/`softWaitForSelector`; 0 disables), `waitUntil`, `headless`, `ignoreCorsAndCsp`, `closeCookieModals`, `maxScrollHeightPixels`, `userAgent`, `ignoreSslErrors`, `waitForSelector` (string, default `''`; CSS selector to await before extraction; request fails on timeout), `softWaitForSelector` (string, default `''`; like `waitForSelector` but continues on timeout)

## Schema generation pipeline

`@contextractor/gen-input-schema` reads this package at build time and writes `apps/apify-actor/.actor/input_schema.json`. `@contextractor/gen-md-regions` reads the generated JSON to rebuild the input table in `apps/apify-actor/README.md`. Both run via `pnpm docs:update`.
