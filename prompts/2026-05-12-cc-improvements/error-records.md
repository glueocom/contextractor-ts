# Error Records

> **TLDR**: Adds dataset records for pages that fail after all retries, using Crawlee's `failedRequestHandler`. Apify Actor pushes an error record to the dataset; standalone CLI writes `failed-urls.json` to the output dir. No schema input change. Updates output SPEC, Actor SPEC, standalone SPEC.

## Agent

`ts-pro`

## Crawler package (`packages/crawler/src/createCrawler.ts`)

Add to `ContextractorCrawlerOptions`:
```ts
onFailedRequest?: (url: string, errors: string[], retryCount: number) => Promise<void>;
```

Pass to the crawler constructor:
```ts
failedRequestHandler: opts.onFailedRequest
  ? async ({ request }, error) => {
      await opts.onFailedRequest!(
        request.url,
        [...(request.errorMessages ?? []), error.message],
        request.retryCount,
      );
    }
  : undefined,
```

## Apify Actor (`apps/apify-actor/src/run.ts`)

Pass `onFailedRequest` to `createContextractorCrawler` (or `buildCrawlerOpts`). Push to the run dataset:
```ts
await Actor.pushData({
  url,
  error: errors.join(' | '),
  retryCount,
  loadedAt: new Date().toISOString(),
});
```

## Standalone CLI (`apps/standalone/src/cliProgram.ts`)

Accumulate failed URLs in a `Map<string, { errors: string[]; retryCount: number }>`. On crawler finish, if any failures, write `failed-urls.json` to `--output-dir`.

## Docs

Update in the same pass:
- `apps/apify-actor/SPEC.md` — add error record shape to output schema section
- `apps/standalone/SPEC.md` — note `failed-urls.json` in output section
- `packages/crawler/SPEC.md` — document `onFailedRequest` in key options

Run `pnpm docs:update` to regenerate `@generated` README regions.

## Verification

```bash
pnpm build && pnpm test
```
