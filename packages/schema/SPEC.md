# `@contextractor/schema`

Zod 4 source of truth for Contextractor's input schema. Both the Apify Actor and the standalone CLI validate user input via `ContextractorInput.parse()`. The Apify `input_schema.json` is generated from this schema at build time.

## Role

Single location where every input field is declared with type, default, Zod validation, and Apify UI metadata. Neither app should declare input types independently.

## Key Exports

- `ContextractorInput` — Zod 4 schema object
- `ContextractorInputType` — `z.infer<typeof ContextractorInput>`
- `apifyMeta(meta: ApifyMeta): ApifyMeta` — typed helper for Apify-specific `.meta()` keys
- `toApifyInputSchema(schema, opts)` — converts Zod schema to Apify INPUT_SCHEMA JSON
- `writeApifyInputSchema(schema, outPath, opts)` — writes INPUT_SCHEMA JSON to disk

## Input Field Groups

- **Crawler settings**: `startUrls`, `globs`, `excludes`, `pseudoUrls`, `linkSelector`, `keepUrlFragments`, `respectRobotsTxtFile`, `initialCookies`, `customHttpHeaders`, `maxPagesPerCrawl`, `maxResultsPerCrawl`, `maxCrawlingDepth`, `maxConcurrency`, `maxRequestRetries`
- **Content extraction**: `trafilaturaConfig`
- **Output settings**: `saveRawHtmlToKeyValueStore`, `saveExtractedTextToKeyValueStore`, `saveExtractedJsonToKeyValueStore`, `saveExtractedMarkdownToKeyValueStore`, `datasetName`, `keyValueStoreName`, `requestQueueName`
- **Proxy**: `proxyConfiguration`, `proxyRotation`
- **Browser**: `pageLoadTimeoutSecs`, `waitUntil`, `launcher`, `headless`, `ignoreCorsAndCsp`, `closeCookieModals`, `maxScrollHeightPixels`, `userAgent`, `ignoreSslErrors`
- **Diagnostics**: `debugLog`, `browserLog`

## Generator

`@contextractor/gen-input-schema` (`tools/gen-input-schema/`) reads this package and writes `apps/apify-actor/.actor/input_schema.json`. Runs as a build step before `tsc` in the Apify Actor package. The snapshot test in `packages/schema/test/to-apify-schema.test.ts` guards against drift between the Zod schema and the committed JSON.

## Dependencies

- `zod ^4`
