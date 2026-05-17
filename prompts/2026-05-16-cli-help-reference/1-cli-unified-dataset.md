# Unify CLI Failed and Skipped Records into Dataset

> **TLDR**: Changes the standalone CLI to push failed and skipped URL records into the local Crawlee dataset (same shapes as the Apify Actor) instead of writing `failed-urls.json` and `skipped-urls.json` files. Adds `status: 'success'` to successful records already pushed to the dataset. After this change all three crawl outcomes land in a single queryable local dataset — consistent with Crawlee's own recommended pattern and the Actor implementation.

Read `apps/standalone/src/cliProgram.ts` and `apps/standalone/src/sinks.ts` in full before making any change.

**Prerequisite**: `packages/crawler/src/createCrawler.ts` must already expose `onFailedRequest` and `onSkippedUrl` callback options (implemented in `prompts/2026-05-12-cc-improvements/failed-and-skipped-urls.md`). Verify before proceeding:

```bash
grep -n "onFailedRequest\|onSkippedUrl" packages/crawler/src/createCrawler.ts
```

## Dataset Record Shapes

All three record types land in the same default (or named) dataset:

**Successful record** (gains `status` field):
```ts
{
  url: string,
  status: 'success',      // NEW
  ...result.metadata,
  originalHash: string,
  crawl: { depth: number, referrerUrl: string | undefined },
  // content fields per --save: txt, markdown, json, html, txtHash, etc.
}
```

**Failed record** (new — always pushed, regardless of `--save-destination`):
```ts
{
  url: string,
  loadedUrl: string | null,
  status: 'failed',
  errorMessages: string[],
  retryCount: number,
  crawledAt: string,       // ISO 8601
}
```

**Skipped record** (new — pushed only when `storeSkippedUrls: true`):
```ts
{
  url: string,
  status: 'skipped',
  skipReason: string,      // 'robotsTxt' | 'limit' | 'enqueueLimit' | 'filters' | 'redirect' | 'depth'
}
```

## Step SINKS — Add `status: 'success'` to successful dataset records

**File**: `apps/standalone/src/sinks.ts`

In `createCrawleeStorageSink`, the `if (toDataset)` block builds a `record` object and calls `dataset.pushData(record)`. Add `status: 'success'` to that record before the push:

```ts
if (toDataset) {
  const record: Record<string, unknown> = {
    url: result.url,
    status: 'success',    // ADD THIS LINE
    ...result.metadata,
    originalHash: result.rawHtmlHash,
    crawl: { depth: result.crawlDepth, referrerUrl: result.referrerUrl },
  };
  // … content fields loop unchanged …
  await dataset.pushData(record);
}
```

### Sinks test

**File**: `apps/standalone/src/sinks.test.ts`

Add or update a test that verifies a successful record pushed to the dataset contains `status: 'success'`. Use a mock `dataset` object with a `pushData` spy.

## Step CLI — Push Failed and Skipped Records to Dataset

**File**: `apps/standalone/src/cliProgram.ts`

### Failed records

The `onFailedRequest` callback currently pushes to the `failedRecords` array. Extend it to also push to the local dataset. Failed records are always written to the dataset regardless of `--save-destination`:

```ts
onFailedRequest: async (info) => {
  failedRecords.push({                    // keep — used by exit code 2 check
    url: info.url,
    loadedUrl: info.loadedUrl,
    status: 'failed',
    errorMessages: info.errorMessages,
    retryCount: info.retryCount,
  });
  await ds.pushData({
    url: info.url,
    loadedUrl: info.loadedUrl,
    status: 'failed',
    errorMessages: info.errorMessages,
    retryCount: info.retryCount,
    crawledAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  });
},
```

Remove the `failed-urls.json` file write block that runs after `crawler.run()`:

```ts
// Remove entirely:
if (failedRecords.length > 0) {
  await mkdir(cfg.outputDir, { recursive: true });
  const outPath = path.join(cfg.outputDir, 'failed-urls.json');
  await writeFile(outPath, JSON.stringify(failedRecords, null, 2));
  process.stderr.write(`Failed URLs written to ${outPath}\n`);
}
```

Keep the `failedRecords` array declaration and the push inside `onFailedRequest` — `failedRecords.length > 0` is the condition used by the exit code 2 fix (`4-implement-storage-gaps.md`).

### Skipped records

The `onSkippedUrl` callback currently pushes to the `skippedRecords` array. Change it to push directly to the dataset (same `void`-and-don't-await pattern as the Actor — the callback is synchronous):

```ts
...(opts.storeSkippedUrls
  ? {
      onSkippedUrl: (url, reason) => {
        void ds.pushData({ url, status: 'skipped', skipReason: reason });
      },
    }
  : {}),
```

Remove the `skippedRecords` array declaration (line declaring `const skippedRecords: Array<...> = []`).
Remove the `skipped-urls.json` file write block that runs after `crawler.run()`.

### Unused imports

After removing both file write blocks, check whether `mkdir` and `writeFile` are used anywhere else in `cliProgram.ts`. If not, remove those imports from the `node:fs/promises` import line.

## Step SPEC — Update standalone SPEC.md

**File**: `apps/standalone/SPEC.md`

- Remove any mention of `failed-urls.json` and `skipped-urls.json` as output files
- Document that all three record types (`success`, `failed`, `skipped`) land in the Crawlee local dataset and are queryable via `contextractor list`
- Note that failed records are always written to the dataset; skipped records require `--store-skipped-urls`

## After changes

- `pnpm --filter @contextractor/standalone build` — must compile clean
- `pnpm test` — all tests pass; `sinks.test.ts` confirms `status: 'success'` on dataset records
- `grep -rn 'failed-urls\.json\|skipped-urls\.json' apps/standalone/src/` — must return no matches
- `grep -n "status.*success\|'success'" apps/standalone/src/sinks.ts` — must return a match in the `toDataset` block
- `contextractor extract https://example.com && contextractor list` — output includes the extracted record with `status: "success"`
