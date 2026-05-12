# Sitemap Crawling

> **TLDR**: Adds `useSitemaps: boolean` (default `false`). When enabled, discovers `sitemap.xml` at each start URL's domain root using Crawlee's `SitemapRequestList.open()` and feeds the discovered URLs into the crawler alongside the explicit start URLs. Flows through schema → both apps. No crawler package change.

## Agent

`ts-pro`

## Schema (`packages/schema/src/source-of-truth/input.ts`)

Add in the Crawler settings section (after `keepUrlFragments`):
```ts
useSitemaps: z
  .boolean()
  .default(false)
  .describe('If enabled, the crawler looks for sitemap.xml at the root of each start URL domain and enqueues matching URLs from it in addition to link-following.')
  .meta({ title: 'Use sitemaps' }),
```

## Apify Actor (`apps/apify-actor/src/run.ts`)

If `input.useSitemaps`, before calling `crawler.run()`:
1. Derive sitemap URLs: for each unique origin in `startUrls`, produce `${origin}/sitemap.xml`
2. Create `const sitemapList = await SitemapRequestList.open({ sitemapUrls, globs: input.globs, exclude: input.excludes })`
3. Pass `requestList: sitemapList` to `createContextractorCrawler` (or add to `buildCrawlerOpts`)
4. Start URLs are still added via `crawler.run(buildRequests(startUrls))`

Import `SitemapRequestList` from `crawlee`.

## Standalone CLI (`apps/standalone/src/cliProgram.ts`)

Same pattern: if `cfg.useSitemaps`, open a `SitemapRequestList` and pass as `requestList` to `createContextractorCrawler`. Add `--use-sitemaps` flag.

## Crawler package (`packages/crawler/src/createCrawler.ts`)

Add `requestList?: IRequestList` to `ContextractorCrawlerOptions` (if not already present) and pass to the crawler constructor.

## Docs

Update in the same pass:
- `packages/schema/SPEC.md` — add `useSitemaps` field
- `apps/apify-actor/SPEC.md` — mention sitemap discovery in data flow
- `apps/standalone/SPEC.md` — mention `--use-sitemaps` flag
- Root `SPEC.md` — update data flow description

Run `pnpm docs:update` to regenerate `@generated` README regions.

## Verification

```bash
pnpm build && pnpm test
```
