# @contextractor/schema — Specification

Zod 4 single source of truth for all Contextractor input. Both the Apify Actor and the standalone CLI feed raw input through `ContextractorInput.parse()`.

## Exports

- `ContextractorInput` — Zod schema; use `.parse()` or `.safeParse()` to validate and coerce input
- `ContextractorInputType` — TypeScript type inferred from the schema
- `apifyMeta(opts)` — helper to attach Apify Console UI metadata to schema fields
- `writeApifyInputSchema(path)` — writes `input_schema.json` (called by `@contextractor/gen-input-schema`)

## Schema structure

Fields grouped by logical section:

- **Crawler settings** — `startUrls`, `globs`, `excludes`, `pseudoUrls`, `linkSelector`, `keepUrlFragments`, `respectRobotsTxtFile`, `maxPagesPerCrawl`, `maxResultsPerCrawl`, `maxCrawlingDepth`, `maxConcurrency`, `maxRequestRetries`
- **Auth** — `initialCookies`, `customHttpHeaders`
- **Content extraction** — `trafilaturaConfig`
- **Output settings** — `saveRawHtmlToKeyValueStore`, `saveExtractedTextToKeyValueStore`, `saveExtractedJsonToKeyValueStore`, `saveExtractedMarkdownToKeyValueStore`, `datasetName`, `keyValueStoreName`, `requestQueueName`
- **Proxy** — `proxyConfiguration`, `proxyRotation`
- **Browser** — `pageLoadTimeoutSecs`, `waitUntil`, `launcher`, `headless`, `ignoreCorsAndCsp`, `closeCookieModals`, `maxScrollHeightPixels`, `userAgent`, `ignoreSslErrors`
- **Diagnostics** — `debugLog`, `browserLog`

## Schema generation pipeline

`@contextractor/gen-input-schema` reads this package at build time and writes `apps/apify-actor/.actor/input_schema.json`. `@contextractor/gen-md-regions` reads the generated JSON to rebuild the input table in `apps/apify-actor/README.md`. Both run via `pnpm docs:update`.
