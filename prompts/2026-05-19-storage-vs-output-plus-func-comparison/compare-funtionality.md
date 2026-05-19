# Compare Functionality: Fix Bugs and Align Output

## TLDR

Fix two bugs identified by comparing contextractor against `apify/website-content-crawler` and `apify/playwright-scraper`. No new features are added. Changes are limited to the crawler handler, sinks, and `ExtractionResult` type.

## Context

Read before implementing:

- `packages/schema/src/source-of-truth/input.ts` — Zod input schema (single source of truth)
- `packages/crawler/src/handler.ts` — request handler, where extraction and sink calls happen
- `packages/crawler/src/sinks/types.ts` — `ExtractionResult` interface
- `apps/apify-actor/src/sinks.ts` — `createApifySink` (Actor dataset/KVS output)
- `apps/standalone/src/sinks.ts` — `createCrawleeStorageSink` (CLI dataset/KVS output)
- `packages/crawler/src/createCrawler.ts` — crawler factory
- `apps/apify-actor/SPEC.md` and `apps/standalone/SPEC.md` — current output contracts

## Research Findings

### Features compared

Compared contextractor against `apify/website-content-crawler` and `apify/playwright-scraper`
(local: `/Users/miroslavsekera/r/actor-scraper/packages/actor-scraper/playwright-scraper`).
All existing contextractor features are purposeful. No features need to be added or removed.

Reviewed and rejected: `useLlmsTxt`, `clickElementsCssSelector`, `saveScreenshots`,
`keepElementsCssSelector`, `removeElementsCssSelector`, jsdom crawler type, `expandIframes`,
`aggressivePrune`, `minFileDownloadSpeedKBps`, `reuseStoredDetectionResults`, `pageFunction`/hooks.

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

### Step HANDLER: Fix loadedUrl

File: `packages/crawler/src/handler.ts`

Capture both URLs from the request:

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

### Step CRAWLER: Add blockMedia warning

File: `packages/crawler/src/createCrawler.ts`

When `opts.blockMedia && crawlerType !== 'playwright:chromium' && crawlerType !== 'playwright:adaptive'`, emit:

```typescript
log.warning(
  'blockMedia has no effect with crawlerType: ' + crawlerType +
  '. It only works with playwright:chromium and playwright:adaptive.'
);
```

### Step SINKS: Use loadedUrl and add url field to dataset records

File: `apps/apify-actor/src/sinks.ts`

In `createApifySink`, update the dataset record:

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

### Step TESTS: Update and add tests

- `packages/crawler/src/handler.test.ts` — add tests verifying `loadedUrl` reflects final URL after redirects and `url` holds the original
- `packages/crawler/src/createCrawler.test.ts` (if exists, otherwise create) — test `blockMedia` warning emitted for cheerio and Firefox; not emitted for `playwright:chromium`
- `apps/apify-actor/src/sinks.test.ts` — add tests verifying `url` and `loadedUrl` are distinct and correct in dataset record
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
- `blockMedia` warning appears in logs when triggered

### Step DOCS: Update all documentation

Update in the **same response** as the code changes:

- `packages/crawler/SPEC.md` — add `blockMedia` warning behavior; update `ExtractionResult` to show `loadedUrl` field
- `apps/apify-actor/SPEC.md` — update dataset record shape: add `url` field; fix `loadedUrl` description
- `apps/standalone/SPEC.md` — update output schema with `url` and `loadedUrl` fix
- `SPEC.md` (root) — update Output Schema `loadedUrl` description; add `url` field

Run after all code changes:

```bash
pnpm docs:update
```

## Conflict Notes

- This prompt runs after Part 1 (`storage-vs-output.md`). Do not reference `output/`, `--output-dir`, `createCliSink`, or `fileSink` — these are deleted by Part 1.
- `saveDestination` schema default is `dataset` (changed from `key-value-store` by Part 1).

## Success Criteria

- `url` (original requested URL) and `loadedUrl` (final URL after redirects) are both present in all success dataset records and contain distinct values when redirects occur
- `blockMedia: true` with cheerio or Firefox emits a warning log
- `pnpm build`, `pnpm lint`, `pnpm test` all pass
- Platform Actor build and smoke test succeed
- All SPEC.md files listed in Step DOCS reflect the changes
