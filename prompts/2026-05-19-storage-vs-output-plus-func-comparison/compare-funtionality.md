# Compare Functionality: Add Missing Features and Fix Bugs

## Context

This prompt is based on a comparison of contextractor against `apify/playwright-scraper`
(local: `/Users/miroslavsekera/r/actor-scraper/packages/actor-scraper/playwright-scraper`)
and `apify/website-content-crawler`.

Read before implementing:

- `packages/schema/src/source-of-truth/input.ts` — Zod input schema (single source of truth)
- `packages/crawler/src/handler.ts` — request handler, where extraction and sink calls happen
- `packages/crawler/src/sinks/types.ts` — `ExtractionResult` interface
- `apps/apify-actor/src/sinks.ts` — `createApifySink` (Actor dataset/KVS output)
- `apps/standalone/src/sinks.ts` — `createCrawleeStorageSink` (CLI dataset/KVS output)
- `packages/crawler/src/createCrawler.ts` — crawler factory
- `apps/apify-actor/SPEC.md` and `apps/standalone/SPEC.md` — current output contracts

## Research Findings

### Features missing from contextractor

Compared to `apify/website-content-crawler` and `apify/playwright-scraper`, contextractor
is missing:

- `useLlmsTxt` — WCC crawls `/llms.txt` files at domain roots; high value given contextractor's AI extraction purpose
- `clickElementsCssSelector` — WCC and playwright-scraper both click collapsed accordions/tabs before extraction; ensures complete content
- `saveScreenshots` — WCC saves screenshots to KVS; useful for QA and multimodal AI pipelines
- `keepElementsCssSelector` — WCC scopes extraction to matching elements; lets users target `article.main-content` instead of full page
- `removeElementsCssSelector` — WCC removes unwanted elements before extraction; complements trafilatura's noise removal

Not adding (reviewed and rejected): jsdom crawler type (cheerio covers static HTML), `expandIframes`
(niche), `aggressivePrune` (covered by `mode: 'precision'`), `minFileDownloadSpeedKBps`
(operational niche), `reuseStoredDetectionResults` (complex optimization), `pageFunction`/hooks
(out of scope for a content extractor).

All existing contextractor features are purposeful. No features need to be removed.

### Bugs to fix

**Bug: `loadedUrl` contains original URL, not final URL after redirects**

In `packages/crawler/src/handler.ts`, `const url = request.url` captures the original requested
URL. This value is passed to the sink as `ExtractionResult.url` and then stored as `loadedUrl`
in the dataset record. This is wrong: `loadedUrl` should reflect the final URL after redirects
(`request.loadedUrl`), while the original URL belongs in a separate `url` field.

Fix: add `loadedUrl: string` to `ExtractionResult`, set it to `request.loadedUrl` in the handler,
and use `result.loadedUrl` for the dataset `loadedUrl` field. Keep `result.url` for the KVS key
hash (stable, based on original requested URL) and add it as `url` in the dataset record.

**Bug: no warning when `blockMedia: true` is used with cheerio or Firefox**

The README documents that `blockMedia` has no effect with cheerio or Firefox, but the code
emits no runtime warning. Add a `log.warning(...)` in the crawler factory when the combination
is detected.

## Implementation Steps

### Step SCHEMA: Add new input fields

File: `packages/schema/src/source-of-truth/input.ts`

Add to the crawling section (after `useSitemaps`):

```typescript
useLlmsTxt: z.boolean().default(false)
  .describe('If enabled, crawl /llms.txt files at each start URL\'s domain root and enqueue the URLs listed in them.'),
```

Add to the extraction section:

```typescript
clickElementsCssSelector: z.string().default('')
  .describe('CSS selector for elements to click before extraction (expands accordions, tabs, etc.). Playwright only — ignored for cheerio.'),
keepElementsCssSelector: z.string().default('')
  .describe('Scope extraction to matching elements only. Leave empty to extract full page. Applied before trafilatura.'),
removeElementsCssSelector: z.string().default('')
  .describe('Remove matching elements before extraction (e.g. "nav, footer, .ads"). Applied before trafilatura.'),
```

Add to the output section (after `save`):

```typescript
saveScreenshots: z.boolean().default(false)
  .describe('Save a screenshot of each page to the key-value store as {hash}-screenshot.png. Playwright only.'),
```

After editing the schema, regenerate the JSON and README table:

```bash
pnpm --filter @contextractor/gen-input-schema start
pnpm docs:update
```

### Step TYPES: Extend ExtractionResult

File: `packages/crawler/src/sinks/types.ts`

Add `loadedUrl: string` field alongside `url`:

```typescript
export interface ExtractionResult {
  url: string;        // original requested URL (request.url) — used for KVS key hash
  loadedUrl: string;  // final URL after redirects (request.loadedUrl)
  html: string;
  // ... rest unchanged
}
```

### Step HANDLER: Pass loadedUrl and implement new features

File: `packages/crawler/src/handler.ts`

**Fix `loadedUrl`:** capture both URLs from the request:

```typescript
const url = request.url;
const loadedUrl = request.loadedUrl ?? request.url;
```

Pass `loadedUrl` in the sink call:

```typescript
await opts.sink({
  url,
  loadedUrl,
  html,
  // ...
});
```

**`clickElementsCssSelector`:** after dynamic content waits and selector waits, before
calling `page.content()`, add:

```typescript
if (opts.clickElementsCssSelector && page) {
  await page.$$eval(opts.clickElementsCssSelector, (els) =>
    els.forEach((el) => (el as HTMLElement).click())
  ).catch(() => {});
  // brief settle for click effects
  await page.waitForTimeout(200).catch(() => {});
}
```

Guard with `if (opts.clickElementsCssSelector)` and only apply when a `page` is available
(Playwright context). Cheerio context does not have `page`.

**`keepElementsCssSelector` and `removeElementsCssSelector`:** after `const html = await page.content()`,
apply CSS filtering using `cheerio` (already a workspace dependency):

```typescript
let processedHtml = html;
if (opts.keepElementsCssSelector || opts.removeElementsCssSelector) {
  const $ = load(html);
  if (opts.keepElementsCssSelector) {
    const kept = $(opts.keepElementsCssSelector).toString();
    processedHtml = kept || html;
  }
  if (opts.removeElementsCssSelector) {
    $(opts.removeElementsCssSelector).remove();
    processedHtml = $.html();
  }
}
```

Use `processedHtml` instead of `html` for extraction; keep the original `html` in the sink
for `rawHtmlHash` computation and `original` saving.

**`saveScreenshots`:** after pushing the result to the sink, capture and save the screenshot:

```typescript
if (opts.saveScreenshots && page) {
  const screenshotBuffer = await page.screenshot({ fullPage: false }).catch(() => null);
  if (screenshotBuffer) {
    const screenshotKey = `${keyBase}-screenshot.png`;
    await opts.onScreenshot?.(screenshotKey, screenshotBuffer);
  }
}
```

Add an optional `onScreenshot` callback to `HandlerOpts` so the Actor/CLI sinks can save it.
Alternatively, include `screenshotKey` and `screenshotBuffer` in `ExtractionResult` if simpler.

### Step CRAWLER: Add useLlmsTxt and blockMedia warning

File: `packages/crawler/src/createCrawler.ts`

**`useLlmsTxt`:** before starting the crawler, if `opts.useLlmsTxt` is true, fetch
`{origin}/llms.txt` for each unique domain in `startUrls`. Parse Markdown links
(`[label](url)`) to extract URLs. Enqueue them via the request queue, filtered by
`globs`/`excludes`. Use `fetch` or a minimal HTTP GET (no browser needed). Handle
fetch failures silently (llms.txt is optional).

**`blockMedia` warning:** when `opts.blockMedia && crawlerType !== 'playwright:chromium' && crawlerType !== 'playwright:adaptive'`, emit:

```typescript
log.warning(
  'blockMedia has no effect with crawlerType: ' + crawlerType +
  '. It only works with playwright:chromium and playwright:adaptive.'
);
```

### Step SINKS: Use loadedUrl and add url field to dataset records

File: `apps/apify-actor/src/sinks.ts`

In `createApifySink`, change the dataset record to use `result.loadedUrl` for `loadedUrl`
and add `url: result.url`:

```typescript
const data: Record<string, unknown> = {
  url: result.url,
  loadedUrl: result.loadedUrl,
  status: 'success',
  // ...
};
```

File: `apps/standalone/src/sinks.ts`

Apply the same change to `createCrawleeStorageSink`.

For `saveScreenshots`: if `result.screenshotKey` is set and destination includes `key-value-store`,
store the screenshot buffer and add a `screenshotUrl` field to the dataset record.

### Step TESTS: Update and add tests

- `packages/crawler/src/handler.test.ts` — add tests for `loadedUrl` fix (verify redirect URL propagates), `clickElementsCssSelector`, `keepElementsCssSelector`, `removeElementsCssSelector`
- `packages/crawler/src/createCrawler.test.ts` (if exists, otherwise create) — test `blockMedia` warning and `useLlmsTxt` URL parsing
- `apps/apify-actor/src/sinks.test.ts` — add tests verifying `url` and `loadedUrl` are distinct and correct
- `apps/standalone/src/sinks.test.ts` — same

### Step LOCAL: Build and test locally

```bash
pnpm build
pnpm lint
pnpm test
```

Verify new fields end-to-end:

```bash
# Confirm url + loadedUrl fields in output
contextractor extract https://example.com --save txt --max-pages 1 \
  --crawler-type cheerio --save-destination dataset
contextractor get default 0 | grep -E '"url"|"loadedUrl"'

# Test blockMedia warning with cheerio (should log a warning)
contextractor extract https://example.com --save txt --max-pages 1 \
  --crawler-type cheerio --block-media --save-destination dataset 2>&1 | grep -i "warning\|blockMedia"
```

### Step PLATFORM: Deploy and smoke test

```bash
/platform:deploy-and-test
```

Verify in the Apify Console run:
- Dataset records include both `url` and `loadedUrl` fields
- New schema fields appear in the Actor input UI
- `blockMedia` warning appears in logs when triggered

### Step DOCS: Update all documentation

Update in the **same response** as the code changes:

- `packages/schema/SPEC.md` — add new fields to public API section
- `packages/crawler/SPEC.md` — add `useLlmsTxt`, `clickElementsCssSelector`, `saveScreenshots`, `keepElementsCssSelector`, `removeElementsCssSelector` to crawler options; add `blockMedia` warning behavior
- `apps/apify-actor/SPEC.md` — update dataset record shape: add `url` field; fix `loadedUrl` description; add `screenshotUrl` field for `saveScreenshots`; add new config fields to Config section
- `apps/standalone/SPEC.md` — add new CLI flags; update output schema with `url` and `loadedUrl` fix
- `SPEC.md` (root) — update Input Schema section with new fields; update Output Schema `loadedUrl` description
- `apps/apify-actor/README.md` — auto-regenerated via `pnpm docs:update`; run after schema change
- `apps/standalone/README.md` — update flag table and output description

Run after all code changes:

```bash
pnpm docs:update
```

## Success Criteria

- `url` (original requested URL) and `loadedUrl` (final URL after redirects) are both present
  in all success dataset records and contain distinct values when redirects occur
- `useLlmsTxt: true` causes the crawler to fetch `/llms.txt` at each domain root and enqueue
  the URLs found in it
- `clickElementsCssSelector` causes Playwright to click matching elements before extraction
- `keepElementsCssSelector` scopes the HTML passed to trafilatura
- `removeElementsCssSelector` strips matching elements before extraction
- `saveScreenshots: true` saves a screenshot per page to KVS and adds `screenshotUrl` to the
  dataset record
- `blockMedia: true` with cheerio or Firefox emits a warning log
- `pnpm build`, `pnpm lint`, `pnpm test` all pass
- Platform Actor build and smoke test succeed
- All SPEC.md and README.md files reflect the changes
