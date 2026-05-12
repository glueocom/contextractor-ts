# Feature Recommendations: website-content-crawler gaps

Based on `research.md`. Adaptive crawling excluded — covered by `prompts/2026-05-12-crawler-type/prompt.md`.

---

## Input Schema

### Crawling behaviour

- **`useSitemaps`** — Use Crawlee's `SitemapRequestList.open({ sitemapUrls })` (streaming, resumable, supports `globs`/`exclude`). Auto-discovers `sitemap.xml` at each start URL's domain root. High value for completeness.

- **`useLlmsTxt`** — Fetch `/llms.txt` at each start URL's domain, parse Markdown file links, enqueue them. No Crawlee built-in; manual fetch + parse. Low priority, niche.

- **`ignoreCanonicalUrl`** — Skip canonical URL normalisation in Crawlee's deduplication (`request.uniqueKey`). Easy to add. Useful for sites with broken canonicals.

- **`initialConcurrency`** — Expose Crawlee's `minConcurrency` option (already in `BasicCrawlerOptions`). Maps 1:1. Trivial addition.

- **`maxSessionRotations`** — Expose `sessionPoolOptions.maxPoolSize` and the session error score threshold. Medium complexity.

- **`minFileDownloadSpeedKBps`** — Abort slow downloads. Complex to implement for browser crawling; lower priority.

### Page load / wait

- **`dynamicContentWaitSecs`** — Currently CT uses event-based `waitUntil`. Add a timeout-based wait (e.g. `page.waitForLoadState('networkidle', { timeout: dynamicContentWaitSecs * 1000 })`). Good UX improvement over the current enum.

- **`waitForSelector`** — `page.waitForSelector(selector, { timeout: dynamicContentWaitSecs * 1000 })` in a pre-extraction step. Fails request on timeout (triggering retries). Easy.

- **`softWaitForSelector`** — Same but wrapped in `try/catch`; continues on timeout. Easy.

### DOM manipulation (pre-extraction)

Pre-process HTML with Cheerio before passing to Trafilatura. Helps on sites where Trafilatura picks up nav/footer noise.

- **`removeElementsCssSelector`** — `$('[selector]').remove()` before extraction. Recommend shipping with a sensible default list (nav, footer, dialogs, cookie banners) matching WCC's default.

- **`keepElementsCssSelector`** — `$.html($('[selector]'))` before extraction; discard the rest. Runs before `removeElementsCssSelector`.

- **`clickElementsCssSelector`** — `page.click(selector)` (or `$$eval` for all matches) before extraction. Reveals hidden accordion/tab content. Default `[aria-expanded="false"]` is a good starting point.

- **`expandIframes`** — Collect `page.frames()` HTML and append to main content before extraction. Firefox/Playwright only. Medium complexity.

- **`blockMedia`** — `playwrightUtils.blockRequests(page)` in `preNavigationHooks`. Blocks images, fonts, stylesheets, videos by URL suffix. Easy win; significant performance improvement.

### Output control

- **`saveScreenshots`** — `page.screenshot({ type: 'jpeg', quality: 80 })` → KVS; add `screenshotUrl` to dataset record. Easy. Playwright-only; skip for `'cheerio'` crawler type.

- **`saveFiles`** / **`saveContentTypes`** — Use Crawlee's `FileDownload` crawler for directly linked file URLs (PDF, DOCX, etc.), or intercept file-typed responses in `PlaywrightCrawler` via `page.route()`. No Crawlee auto-detection of file links on pages; enqueue matching URLs manually by extension/MIME sniff. Medium-high complexity.

- **`storeSkippedUrls`** — Use `onSkippedRequest` callback in `enqueueLinks` (available in Crawlee 3.16). Accumulate skipped URLs and write to KVS as `SKIPPED_URLS` on crawler finish. Easy.

- **`aggressivePrune`** — Cross-page content deduplication via Count-Min Sketch. Complex, niche; low priority.

### Advanced / experimental

- **`pageFunction`** — Execute user-provided async JS in the browser context via `page.evaluate(userCode)`. Security risk — only suitable if input is treated as trusted (Actor owner-supplied). Low priority.

- **`signHttpRequests`** — Experimental Cloudflare Signed Agent feature. Skip.

---

## Output Schema

- **`screenshotUrl`** — Add alongside the screenshots feature above.

- **Error records** — Use Crawlee's `failedRequestHandler` to push a dataset record per page that exhausts all retries. Record `url`, `errorMessages` (all retry errors), `retryCount`. Easy; improves observability significantly. **Recommend implementing early.**

- **`crawl.depth`** / **`crawl.referrerUrl`** — Pass via `request.userData` in `enqueueLinks` using `transformRequestFunction`. Add to dataset record. Medium value for debugging crawl graphs.

- **`crawl.isFile`** / **`crawl.requestStatus`** — Add when file downloads are implemented.

---

## Priority order

High:
- Error records (`failedRequestHandler`)
- `blockMedia`
- `waitForSelector` / `softWaitForSelector`
- `removeElementsCssSelector` / `keepElementsCssSelector`
- `useSitemaps`

Medium:
- `saveScreenshots`
- `clickElementsCssSelector`
- `dynamicContentWaitSecs`
- `initialConcurrency`
- `crawl.depth` / `crawl.referrerUrl`
- `storeSkippedUrls`
- `ignoreCanonicalUrl`

Low:
- `saveFiles` / `saveContentTypes`
- `expandIframes`
- `maxSessionRotations`
- `aggressivePrune`
- `useLlmsTxt`
- `minFileDownloadSpeedKBps`
- `pageFunction`
