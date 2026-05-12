# Store Skipped URLs

> **TLDR**: Adds `storeSkippedUrls: boolean` (default `false`). When enabled, captures URLs skipped during `enqueueLinks` via Crawlee 3.16's `onSkippedRequest` callback. Apify Actor writes a `SKIPPED_URLS` JSON record to KVS on crawler finish; standalone CLI writes `skipped-urls.json` to the output dir.

## Agent

`ts-pro`

## Schema (`packages/schema/src/source-of-truth/input.ts`)

Add in the Output settings section:
```ts
storeSkippedUrls: z
  .boolean()
  .default(false)
  .describe('If enabled, saves all URLs skipped during crawling (excluded by globs, robots.txt, or concurrency limits) to a SKIPPED_URLS record in the Key-Value Store.')
  .meta({ title: 'Store skipped URLs', ...apifyMeta({ sectionCaption: 'Output settings' }) }),
```

## Crawler package

### `ContextractorCrawlerOptions` / `HandlerOpts`

Add `onSkippedUrl?: (url: string, reason: string) => void` to `HandlerOpts` and `ContextractorCrawlerOptions`.

### Handler (`handler.ts`)

In `enqueueLinks`, pass:
```ts
onSkippedRequest: opts.onSkippedUrl
  ? ({ url, reason }) => opts.onSkippedUrl!(url, reason)
  : undefined,
```

## Apify Actor (`apps/apify-actor/src/run.ts`)

If `input.storeSkippedUrls`:
- Accumulate in a `Map<string, string[]>` (url → reasons)
- Pass an `onSkippedUrl` callback to `createContextractorCrawler`
- After `crawler.run()`, write `Actor.setValue('SKIPPED_URLS', Object.fromEntries(skipped))`

## Standalone CLI (`apps/standalone/src/cliProgram.ts`)

If `cfg.storeSkippedUrls`, accumulate and write `skipped-urls.json` to `--output-dir` after run. Add `--store-skipped-urls` flag.

## Docs

Update in the same pass:
- `packages/schema/SPEC.md` — add `storeSkippedUrls`
- `packages/crawler/SPEC.md` — document `onSkippedUrl` option
- `apps/apify-actor/SPEC.md` — mention `SKIPPED_URLS` KVS record
- `apps/standalone/SPEC.md` — mention `skipped-urls.json`

Run `pnpm docs:update` to regenerate `@generated` README regions.

## Verification

```bash
pnpm build && pnpm test
```
