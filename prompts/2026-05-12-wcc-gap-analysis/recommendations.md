# Feature Recommendations: website-content-crawler gaps

Based on `research.md`. Adaptive crawling excluded — covered by `prompts/2026-05-12-crawler-type/prompt.md`.

---

## Input Schema

### Crawling behaviour

- **`useSitemaps`** — Use Crawlee's `SitemapRequestList.open({ sitemapUrls })` (streaming, resumable, supports `globs`/`exclude`). Auto-discovers `sitemap.xml` at each start URL's domain root. High value for completeness.

- **`ignoreCanonicalUrl`** — Skip canonical URL normalisation in Crawlee's deduplication (`request.uniqueKey`). Easy to add. Useful for sites with broken canonicals.

- **`initialConcurrency`** — Expose Crawlee's `minConcurrency` option (already in `BasicCrawlerOptions`). Maps 1:1. Trivial addition.

### Page load / wait

- **`dynamicContentWaitSecs`** — Currently CT uses event-based `waitUntil`. Add a timeout-based wait (e.g. `page.waitForLoadState('networkidle', { timeout: dynamicContentWaitSecs * 1000 })`). Good UX improvement over the current enum.

- **`waitForSelector`** — `page.waitForSelector(selector, { timeout: dynamicContentWaitSecs * 1000 })` in a pre-extraction step. Fails request on timeout (triggering retries). Easy.

- **`softWaitForSelector`** — Same but wrapped in `try/catch`; continues on timeout. Easy.

### Performance

- **`blockMedia`** — `playwrightUtils.blockRequests(page)` in `preNavigationHooks`. Blocks images, fonts, stylesheets, videos by URL suffix. Easy win; significant performance improvement.

### Output control

- **`storeSkippedUrls`** — Use `onSkippedRequest` callback in `enqueueLinks` (available in Crawlee 3.16). Accumulate skipped URLs and write to KVS as `SKIPPED_URLS` on crawler finish. Easy.

---

## Output Schema

- **Error records** — Use Crawlee's `failedRequestHandler` to push a dataset record per page that exhausts all retries. Record `url`, `errorMessages` (all retry errors), `retryCount`. Easy; improves observability significantly. **Recommend implementing early.**

- **`crawl.depth`** / **`crawl.referrerUrl`** — Pass via `request.userData` in `enqueueLinks` using `transformRequestFunction`. Add to dataset record. Medium value for debugging crawl graphs.

---

## Priority order

High:
- Error records (`failedRequestHandler`)
- `blockMedia`
- `waitForSelector` / `softWaitForSelector`
- `useSitemaps`

Medium:
- `dynamicContentWaitSecs`
- `initialConcurrency`
- `crawl.depth` / `crawl.referrerUrl`
- `storeSkippedUrls`
- `ignoreCanonicalUrl`
