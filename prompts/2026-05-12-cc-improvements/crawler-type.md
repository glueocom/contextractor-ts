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

## Docs

Update in the same pass:
- `packages/schema/SPEC.md` — document `crawlerType` and `renderingTypeDetectionPercentage`; remove `launcher`
- `packages/crawler/SPEC.md` — document `crawlerType`, three handler types, widened return type
- `apps/apify-actor/SPEC.md` — update crawler type in data flow
- `apps/standalone/SPEC.md` — document `--crawler-type` and `--rendering-detection-pct` flags; remove `--launcher`
- Relevant `README.md` files — update any manually-written sections covering the changed behaviour; `@generated` regions are handled by `pnpm docs:update`
- `apps/apify-actor/.actor/input_schema.json` — run `pnpm --filter @contextractor/gen-input-schema start` after schema changes to regenerate the Actor input UI (GUI)

Run `pnpm docs:update` to regenerate `@generated` README regions.

## Examples

Update `/examples` to demonstrate the new option in the same pass:
- `examples/cli-npm/run.sh` — add usage lines for `--crawler-type` (e.g. `adaptive`, `firefox`, `cheerio`)
- `examples/apify-api-ts/src/main.ts` — add `crawlerType` to the Actor call input
- `examples/library-ts/src/main.ts` — add `crawlerType` option

## Verification

```bash
pnpm build && pnpm test
```
