# Crawl Depth and Referrer

> **TLDR**: Tracks `depth` (link distance from start URL) and `referrerUrl` (URL of the linking page) per crawled page. No new input schema field. Passes values via `request.userData` through `enqueueLinks`. Adds `crawl: { depth, referrerUrl }` to dataset records in both sinks. Updates `ExtractionResult`, handler, both sinks, both SPECs.

## Agent

`ts-pro`

## Crawler package

### `sinks/types.ts`

Add to `ExtractionResult`:
```ts
crawlDepth: number;
referrerUrl: string | null;
```

### Handler (`handler.ts`)

Extract from `request.userData`:
```ts
const crawlDepth = typeof request.userData?.depth === 'number' ? request.userData.depth : 0;
const referrerUrl = typeof request.userData?.referrerUrl === 'string' ? request.userData.referrerUrl : null;
```

Include in the `sink()` call.

In `enqueueLinks`, update `transformRequestFunction`:
```ts
req.userData = {
  ...req.userData,
  depth: crawlDepth + 1,
  referrerUrl: request.url,
};
```

## Apify Actor (`apps/apify-actor/src/sinks.ts`)

Add `crawl: { depth: result.crawlDepth, referrerUrl: result.referrerUrl }` to dataset records in both `toDataset` and `toKvs` paths.

## Standalone (`apps/standalone/src/sinks.ts`)

Add `crawl: { depth: result.crawlDepth, referrerUrl: result.referrerUrl }` to the dataset record.

## Docs

Update in the same pass:
- `apps/apify-actor/SPEC.md` — add `crawl` object to output schema
- `apps/standalone/SPEC.md` — add `crawl` object to output schema
- `packages/crawler/SPEC.md` — document `crawlDepth` and `referrerUrl` in `ExtractionResult`
- Root `SPEC.md` — update dataset entry examples
- Relevant `README.md` files — update any manually-written sections covering the changed behaviour; `@generated` regions are handled by `pnpm docs:update`

Run `pnpm docs:update` to regenerate `@generated` README regions.

## Examples

Update `/examples` to show the new `crawl` output fields in the same pass:
- `examples/apify-api-ts/src/main.ts` — log `item.crawl?.depth` and `item.crawl?.referrerUrl` from dataset results
- `examples/library-ts/src/main.ts` — demonstrate the `crawl` field in printed output

## Verification

```bash
pnpm build && pnpm test
```
