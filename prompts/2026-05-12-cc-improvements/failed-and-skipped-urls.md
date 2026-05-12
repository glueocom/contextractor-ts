# Failed and Skipped URL Records

> **TLDR**: Adds consistent URL records for two non-success outcomes. (1) Pages that fail after all retries are pushed to the dataset with `url`, `loadedUrl`, `#error: true`, `errorMessages[]`, `retryCount`, and `crawledAt` — always enabled, no input flag. (2) URLs skipped during `enqueueLinks` are collected and written to KVS as `SKIPPED_URLS` (grouped by skip reason) when `storeSkippedUrls: true`. Both record types use `url` (original requested URL) and `loadedUrl` (final URL after redirects, `null` when navigation never started) as the canonical URL pair. Updates crawler SPEC, Actor SPEC, schema SPEC, and standalone SPEC in the same pass.

## Agent

`ts-pro`

## Background — How Reference Actors Handle This

**Crawlee framework** (`failedRequestHandler`, `onSkippedRequest`):
- `failedRequestHandler` context provides `request.url` (original), `request.loadedUrl` (final after redirects, `undefined` if navigation never started), `request.errorMessages: string[]` (all attempts), `request.retryCount: number`
- `onSkippedRequest` on `enqueueLinks` provides `{ url: string, reason: SkippedRequestReason }` — reason is one of `'robotsTxt' | 'limit' | 'enqueueLimit' | 'filters' | 'redirect' | 'depth'`

**Playwright Scraper** (`apify/actor-scraper`):
- Unified dataset — every record has `#error: boolean` and `#debug: { url, loadedUrl, retryCount, errorMessages, statusCode }`. Failed records share the same schema as successful ones, just with no page content.

**Website Content Crawler** (`apify/website-content-crawler`):
- Failed requests are NOT pushed to the dataset — WCC omits them entirely. Skipped URLs go to KVS under `SKIPPED_URLS` grouped by reason: `{ robotsTxt: string[], filters: string[], limit: string[], ... }`.

**Decision for contextractor**: Push failed records to the dataset (playwright-scraper pattern — more useful for downstream consumers) and store skipped URLs in KVS grouped by reason (WCC pattern — clean for auditing).

## URL Naming Convention

Use this canonical pair on all new records:

- `url` — original requested URL (`request.url`)
- `loadedUrl` — final URL after redirects (`request.loadedUrl ?? null`; `null` when navigation never started)

> **Note**: `apps/apify-actor/src/sinks.ts` currently sets `loadedUrl: result.url`, where `result.url` is the original `request.url` — it does not track redirects. Do not fix this pre-existing naming issue in this prompt. The new failed/skipped records use the correct meaning: `url` = original, `loadedUrl` = final.

## Step SCHEMA — Input Flag for Skipped URLs

File: `packages/schema/src/source-of-truth/input.ts`

Add in the Output settings section:

```ts
storeSkippedUrls: z
  .boolean()
  .default(false)
  .describe(
    'If enabled, saves all URLs skipped during crawling (excluded by globs, robots.txt, or concurrency limits) to a SKIPPED_URLS record in the Key-Value Store.',
  )
  .meta({ title: 'Store skipped URLs', ...apifyMeta({ sectionCaption: 'Output settings' }) }),
```

No input flag for failed records — they are always captured.

## Step CRAWLER — Callback Options

File: `packages/crawler/src/createCrawler.ts`

Add to `ContextractorCrawlerOptions`:

```ts
onFailedRequest?: (info: {
  url: string;
  loadedUrl: string | null;
  errorMessages: string[];
  retryCount: number;
}) => Promise<void>;

onSkippedUrl?: (url: string, reason: string) => void;
```

Wire into the crawler constructor:

```ts
failedRequestHandler: opts.onFailedRequest
  ? async ({ request }, error) => {
      await opts.onFailedRequest!({
        url: request.url,
        loadedUrl: request.loadedUrl ?? null,
        errorMessages: [...(request.errorMessages ?? []), error.message],
        retryCount: request.retryCount,
      });
    }
  : undefined,
```

## Step HANDLER — Skipped URL Hook

File: `packages/crawler/src/handler.ts`

Add `onSkippedUrl?: (url: string, reason: string) => void` to `HandlerOpts`.

In `enqueueLinks`, pass to the Crawlee call:

```ts
onSkippedRequest: opts.onSkippedUrl
  ? ({ url, reason }) => opts.onSkippedUrl!(url, reason)
  : undefined,
```

## Step ACTOR — Apify Actor Integration

File: `apps/apify-actor/src/run.ts`

### Failed records

Always collect. Pass `onFailedRequest` to `createContextractorCrawler` / `buildCrawlerOpts`. In the callback, push to the run dataset:

```ts
await dataset.pushData({
  url: info.url,
  loadedUrl: info.loadedUrl,
  '#error': true,
  errorMessages: info.errorMessages,
  retryCount: info.retryCount,
  crawledAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
});
```

### Skipped URLs

Only collect when `input.storeSkippedUrls` is `true`. Accumulate in a `Map<string, string[]>` keyed by reason. After `crawler.run()`, write to KVS:

```ts
// Example KVS record shape
{
  robotsTxt: ['https://example.com/private/'],
  filters:   ['https://example.com/excluded/'],
  limit:     ['https://example.com/page-101/'],
}
```

```ts
if (input.storeSkippedUrls && skipped.size > 0) {
  await kvs.setValue('SKIPPED_URLS', Object.fromEntries(skipped));
}
```

Pass `onSkippedUrl` when `input.storeSkippedUrls` is `true`:

```ts
onSkippedUrl: input.storeSkippedUrls
  ? (url, reason) => {
      const list = skipped.get(reason) ?? [];
      list.push(url);
      skipped.set(reason, list);
    }
  : undefined,
```

## Step STANDALONE — CLI Integration

File: `apps/standalone/src/cliProgram.ts`

Add `--store-skipped-urls` flag mapped to `cfg.storeSkippedUrls`.

Accumulate failed URLs in a `Map<string, { errorMessages: string[]; retryCount: number; loadedUrl: string | null }>`. After `crawler.run()`, if any failures, write `failed-urls.json` to `--output-dir`:

```json
[
  {
    "url": "https://example.com/broken",
    "loadedUrl": null,
    "errorMessages": ["Navigation timeout after 30000ms"],
    "retryCount": 3
  }
]
```

If `cfg.storeSkippedUrls` and skipped is non-empty, write `skipped-urls.json` to `--output-dir` using the same grouped-by-reason format as KVS.

## Step DOCS — Spec Updates

Update in the same pass:

- `packages/crawler/SPEC.md` — add `onFailedRequest` and `onSkippedUrl` to key options
- `packages/schema/SPEC.md` — add `storeSkippedUrls`
- `apps/apify-actor/SPEC.md` — add failed record shape to output schema; add `SKIPPED_URLS` KVS record
- `apps/standalone/SPEC.md` — add `failed-urls.json` and `skipped-urls.json` to output section; add `--store-skipped-urls` flag

Run `pnpm docs:update` to regenerate `@generated` README regions.

## Step VERIFY

```bash
pnpm build && pnpm test
```
