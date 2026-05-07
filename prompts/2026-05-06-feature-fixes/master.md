# Feature fixes: waitUntil, proxy support, html output

Orchestrates the four prompts in this directory in dependency order. Run them sequentially — each step must produce a clean build before the next begins.

## Step WAIT-UNTIL: Wire waitUntil through to Crawlee

Run `wait-until-wire.md`. Touches:
- `packages/crawler/src/createCrawler.ts` — new field + `preNavigationHooks` refactor
- `apps/standalone/src/cliProgram.ts` — pass `waitUntil` to crawler call
- `apps/apify-actor/src/config.ts` — add `WAIT_UNTIL_MAP` + wire field
- `packages/schema/src/input.ts` — add `sectionCaption` to `waitUntil` field

After: `pnpm --filter @contextractor/gen-input-schema start && pnpm build && pnpm lint && pnpm test`

## Step PROXY: Wire proxy URLs and rotation through to Crawlee

Run `proxy.md`. Touches:
- `packages/crawler/src/createCrawler.ts` — new `proxyRotation` field + `SESSION_MAX_USAGE_COUNTS` + `sessionPoolOptions` overrides
- `apps/standalone/src/cliProgram.ts` — `ProxyConfiguration` import + URL validation block + crawler call
- `apps/standalone/src/config.ts` — move `proxyRotation` to `CliOnlyOverrides`, delete `PROXY_ROTATION_MAP`, update `resolveCliOnly`
- `apps/apify-actor/src/run.ts` — pass `input.proxyRotation` to `buildCrawlerOpts`
- `apps/apify-actor/src/config.ts` — add fifth parameter to `buildCrawlerOpts`

After: `pnpm build && pnpm lint && pnpm test`

## Step HTML: Add html output format to the Apify Actor

Run `html-output-actor.md`. Touches:
- `packages/schema/src/input.ts` — add `saveExtractedHtmlToKeyValueStore` field
- `apps/apify-actor/src/config.ts` — push `html` to `formats`
- `apps/apify-actor/src/sinks.ts` — add `html` entry to `FORMAT_SPECS`
- `apps/apify-actor/.actor/dataset_schema.json` — add `extractedHtml` field

After: `pnpm --filter @contextractor/gen-input-schema start && pnpm build && pnpm lint && pnpm test`

## Step TEST: End-to-end verification

Run `test.md`. Covers CLI, library API, Docker CLI, Docker Engine API, and Apify platform for all three features.

Prerequisite before TEST: ensure `apps/apify-actor/.actor/actor.json` has `"name": "contextractor-test"` (never push to `contextractor`).
