# Crawler Type Selection

> **TLDR**: Replaces `launcher: 'CHROMIUM' | 'FIREFOX'` with `crawlerType` enum supporting `'playwright:adaptive'` (new default, `AdaptivePlaywrightCrawler`), `'playwright:firefox'`, `'playwright:chromium'`, and `'cheerio'` (`CheerioCrawler`). One adaptive-tuning field. Flows through schema → crawler package → both app configs → standalone CLI. Update tests and SPECs in the same pass.

## Agent

`ts-pro`

## Schema (`packages/schema/src/source-of-truth/input.ts`)

Remove `launcher`. Add before `globs` (take over its `sectionCaption: 'Crawler settings'`):

- `crawlerType: z.enum(['playwright:adaptive', 'playwright:firefox', 'playwright:chromium', 'cheerio']).default('playwright:adaptive')` — editor `select`, enumTitles: `['Adaptive switching (Recommended)', 'Headless browser (Firefox+Playwright)', 'Headless browser (Chromium+Playwright)', 'Raw HTTP client (Cheerio)']`
- `renderingTypeDetectionPercentage: z.int().min(0).max(100).default(10)` — "(Adaptive only) Percentage of pages on which the crawler runs a rendering-type detection probe. Higher values are more accurate but slower."; unit `%`

## Crawler package

### `ContextractorCrawlerOptions` (`createCrawler.ts`)

Replace `launcher` with `crawlerType` and `renderingTypeDetectionPercentage`. Return type widens to `BasicCrawler` (common base of all three; callers only use `.run()` and `.router.addDefaultHandler()`).

### Handlers (`handler.ts`)

Three separate handlers — each typed for its context:

- **`createHandler`** (existing) — `RequestHandler<PlaywrightCrawlingContext>` — unchanged; used for `'playwright:firefox'` and `'playwright:chromium'`
- **`createCheerioHandler`** (new) — `RequestHandler<CheerioCrawlingContext>` — get HTML from `context.body`; skip scroll and browserLog; `enqueueLinks` API is identical
- **`createAdaptiveHandler`** (new) — `RequestHandler<AdaptivePlaywrightCrawlerContext>` — get HTML via `const $ = await context.parseWithCheerio(); const html = $.html();`; skip scroll (no direct `page` access); `enqueueLinks` via context helper; do NOT access `page` directly (throws in HTTP mode, triggers browser retry)

### Factory (`createContextractorCrawler`)

Branch on `crawlerType`:

- **`'cheerio'`** → `new CheerioCrawler({ ..., requestHandler: createCheerioHandler(...) })`; skip all browser options (headless, launchContext, cookie hooks, scroll, browserLog)
- **`'playwright:adaptive'`** → `new AdaptivePlaywrightCrawler({ ..., requestHandler: createAdaptiveHandler(...), renderingTypeDetectionRatio: renderingTypeDetectionPercentage / 100 })`; browser options apply; note: `preventDirectStorageAccess` defaults to `true` — fine here since we use a sink callback
- **`'playwright:firefox'` / `'playwright:chromium'`** → existing `PlaywrightCrawler` path; derive launcher (`'firefox'` / `'chromium'`) from the enum suffix

`AdaptivePlaywrightCrawler` is imported from `@crawlee/playwright` (already a dependency).

## App configs

Both `apps/apify-actor/src/config.ts` and `apps/standalone/src/config.ts`:
- Drop `LAUNCHER_MAP`
- Pass `crawlerType` and `renderingTypeDetectionPercentage` straight through

## Standalone CLI (`apps/standalone/src/cliProgram.ts`)

Replace `--launcher` / `parseLauncher` with `--crawler-type` (values: `adaptive` → `'playwright:adaptive'`, `firefox` → `'playwright:firefox'`, `chromium` → `'playwright:chromium'`, `cheerio` → `'cheerio'`). Add `--rendering-detection-pct <n>` for `renderingTypeDetectionPercentage`.

## Verification

```bash
pnpm build && pnpm test
```
