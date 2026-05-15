# Contextractor Improvements — Master

> **TLDR**: Orchestrates all feature improvement prompts. Run each sub-prompt as a separate task in the order listed. Each prompt is self-contained; complete one before starting the next to avoid conflicts on shared files (`input.ts`, `createCrawler.ts`, `handler.ts`).

## Agent

`ts-pro`

## Sub-prompts

Run in this order:

- `crawler-type.md` — Crawler type selection (`playwright:adaptive` / `playwright:firefox` / `playwright:chromium` / `cheerio`)
- `failed-and-skipped-urls.md` — Dataset records for failed pages + dataset records for skipped links when `storeSkippedUrls: true`
- `block-media.md` — Block images, fonts, stylesheets, and videos for faster crawling
- `wait-for-selector.md` — Hard and soft CSS selector wait before extraction
- `dynamic-content-wait.md` — Timeout-based network-idle wait for dynamic content
- `use-sitemaps.md` — Auto-discover and crawl `sitemap.xml` at start URL domains
- `initial-concurrency.md` — Expose Crawlee `minConcurrency` as `initialConcurrency`
- `crawl-depth-referrer.md` — Track link depth and referrer URL in dataset records
- `ignore-canonical-url.md` — Skip pages whose canonical URL was already extracted

## After all prompts

```bash
pnpm --filter @contextractor/gen-input-schema start
pnpm build && pnpm test && pnpm docs:update
```

Verify all tests pass, `input_schema.json` is in sync with the Zod schema, and all `@generated` README regions are up to date.
