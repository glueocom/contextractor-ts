# Failed and Skipped URL Records

> **TLDR**: Adds a unified `status` field to every dataset record — `"success"`, `"failed"`, or `"skipped"` — so all three crawl outcomes land in a single dataset. Failed pages (retries exhausted) are always pushed. Skipped URLs (robots.txt, glob filters, depth limit, etc.) are pushed when `storeSkippedUrls: true`. This is a **breaking schema change**: existing successful records gain `status: "success"`. Updates crawler SPEC, Actor SPEC, schema SPEC, and standalone SPEC in the same pass.

## Agent

`ts-pro`

## Background — How Reference Actors Handle This

**Crawlee framework**: `failedRequestHandler` receives the full `Request` object (`request.url`, `request.loadedUrl`, `request.errorMessages: string[]`, `request.retryCount`). `onSkippedRequest` from `enqueueLinks` receives only `{ url: string, reason: SkippedRequestReason }` — reason is `'robotsTxt' | 'limit' | 'enqueueLimit' | 'filters' | 'redirect' | 'depth'`. Neither hook pushes to a dataset by default — that is the actor's responsibility.

**Playwright Scraper** (`apify/actor-scraper`): Unified dataset. Every record (success and failure) has `#error: boolean` and a `#debug` object. No tracking of skipped URLs anywhere.

**Website Content Crawler** (`apify/website-content-crawler`): Only successful pages in the dataset. Failed pages are silently dropped — this is a known user pain point and has been requested as a missing feature. Skipped pages go to KVS under `SKIPPED_URLS` (separate from the dataset).

**Decision for contextractor**: No tool studied covers all three outcomes in a unified dataset. This design improves on both references: failed records are explicit (not silently dropped like WCC), and skipped records land in the dataset rather than a separate KVS key. The `status` field is more readable than actor-scraper's `#error: boolean` and scales cleanly to three states. Volume risk for skipped records is mitigated by gating on `storeSkippedUrls`.

## Dataset Record Shapes

### Successful record (updated — adds `status`)

```ts
{
  loadedUrl: string,      // existing field (original requested URL — pre-existing naming quirk, not changed here)
  status: 'success',      // NEW — added to sinks.ts
  loadedAt: string,       // existing
  metadata: DatasetMetadata, // existing
  httpStatus: number,     // existing
  // ... content fields (txt, markdown, json, html, hashes) unchanged
}
```

### Failed record (new)

```ts
{
  url: string,            // original requested URL (request.url)
  loadedUrl: string | null, // final URL after redirects (request.loadedUrl ?? null); null if nav never started
  status: 'failed',
  errorMessages: string[], // all error messages across retries (request.errorMessages + final error)
  retryCount: number,     // request.retryCount
  crawledAt: string,      // ISO timestamp
}
```

### Skipped record (new, only when storeSkippedUrls: true)

```ts
{
  url: string,            // skipped URL
  status: 'skipped',
  skipReason: 'robotsTxt' | 'limit' | 'enqueueLimit' | 'filters' | 'redirect' | 'depth',
}
```

Skipped records have no `loadedUrl` — navigation never started for these URLs.

## Step SCHEMA — storeSkippedUrls Input Flag

File: `packages/schema/src/source-of-truth/input.ts`

Add in the Output settings section:

```ts
storeSkippedUrls: z
  .boolean()
  .default(false)
  .describe(
    'If enabled, pushes a dataset record for each URL skipped during crawling (excluded by globs, robots.txt, depth limit, or concurrency cap). Can produce high record volume — enable for auditing only.',
  )
  .meta({ title: 'Store skipped URLs', ...apifyMeta({ sectionCaption: 'Output settings' }) }),
```

No input flag for failed records — they are always captured.

## Step SINKS — Add status: "success" to Successful Records

File: `apps/apify-actor/src/sinks.ts`

In `createApifySink`, add `status: 'success'` to the `data` object:

```ts
const data: Record<string, unknown> = {
  loadedUrl: result.url,
  status: 'success',   // ADD THIS LINE
  loadedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  metadata: result.metadata,
  httpStatus: 200,
  originalHash: result.rawHtmlHash,
};
```

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

Wire `onFailedRequest` into the crawler constructor:

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

Always collect — pass `onFailedRequest` to `createContextractorCrawler` / `buildCrawlerOpts`. In the callback, push to the run dataset:

```ts
onFailedRequest: async (info) => {
  await dataset.pushData({
    url: info.url,
    loadedUrl: info.loadedUrl,
    status: 'failed',
    errorMessages: info.errorMessages,
    retryCount: info.retryCount,
    crawledAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  });
},
```

### Skipped records

Only collect when `input.storeSkippedUrls` is `true`. Pass `onSkippedUrl` and push directly to the dataset in the callback (no accumulation needed — push per event):

```ts
onSkippedUrl: input.storeSkippedUrls
  ? (url, reason) => {
      void dataset.pushData({ url, status: 'skipped', skipReason: reason });
    }
  : undefined,
```

Note: `onSkippedRequest` fires synchronously during `enqueueLinks`. The `void` is intentional — do not `await` here. Any errors from the push will surface in Apify logs without blocking the crawl.

## Step STANDALONE — CLI Integration

File: `apps/standalone/src/cliProgram.ts`

The standalone CLI writes content to files, not to a dataset. Failed and skipped records have no content, so they go to dedicated summary files in `--output-dir`.

Add `--store-skipped-urls` flag mapped to `cfg.storeSkippedUrls`.

Accumulate failed requests in a `Map<string, { url: string; loadedUrl: string | null; errorMessages: string[]; retryCount: number }>`. After `crawler.run()`, if any failures, write `failed-urls.json`:

```json
[
  {
    "url": "https://example.com/broken",
    "loadedUrl": null,
    "status": "failed",
    "errorMessages": ["Navigation timeout after 30000ms"],
    "retryCount": 3
  }
]
```

If `cfg.storeSkippedUrls`, accumulate skipped URLs and write `skipped-urls.json` after run:

```json
[
  { "url": "https://example.com/private/", "status": "skipped", "skipReason": "robotsTxt" },
  { "url": "https://example.com/page-101/", "status": "skipped", "skipReason": "limit" }
]
```

## Step DOCS — Spec Updates

Update in the same pass:

- `packages/crawler/SPEC.md` — add `onFailedRequest` and `onSkippedUrl` to key options
- `packages/schema/SPEC.md` — add `storeSkippedUrls`
- `apps/apify-actor/SPEC.md` — add all three record shapes to output schema section; note `status` field is present on every dataset record; remove any reference to `SKIPPED_URLS` KVS key
- `apps/standalone/SPEC.md` — add `failed-urls.json` and `skipped-urls.json` to output section; add `--store-skipped-urls` flag
- Relevant `README.md` files — update any manually-written sections covering the changed behaviour; `@generated` regions are handled by `pnpm docs:update`
- `apps/apify-actor/.actor/input_schema.json` — run `pnpm --filter @contextractor/gen-input-schema start` after schema changes to regenerate the Actor input UI (GUI)

Run `pnpm docs:update` to regenerate `@generated` README regions.

## Step EXAMPLES

Update `/examples` to demonstrate the new options and output shape in the same pass:
- `examples/cli-npm/run.sh` — add a usage line for `--store-skipped-urls`
- `examples/apify-api-ts/src/main.ts` — add `storeSkippedUrls: true`; log `item.status` when iterating dataset results
- `examples/library-ts/src/main.ts` — handle `status: 'failed'` and `status: 'skipped'` records in printed output

## Step VERIFY

```bash
pnpm build && pnpm test
```
