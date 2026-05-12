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
- Relevant `README.md` files — update any manually-written sections covering the changed behaviour; `@generated` regions are handled by `pnpm docs:update`
- `apps/apify-actor/.actor/input_schema.json` — run `pnpm --filter @contextractor/gen-input-schema start` after schema changes to regenerate the Actor input UI (GUI)

Run `pnpm docs:update` to regenerate `@generated` README regions.

## Examples

Update `/examples` to demonstrate the new option in the same pass:
- `examples/cli-npm/run.sh` — add a usage line for `--store-skipped-urls`
- `examples/apify-api-ts/src/main.ts` — add `storeSkippedUrls: true` to the Actor call input

## Verification

```bash
pnpm build && pnpm test
```
