# Gap Analysis: website-content-crawler vs contextractor-ts

Features present in `apify/website-content-crawler` (WCC) that are absent from contextractor-ts.
HTML transformer fields (`htmlTransformer`, `readableTextCharThreshold`) are excluded — contextractor uses Trafilatura exclusively.

`crawlerType` and `renderingTypeDetectionPercentage` are excluded — covered by `prompts/2026-05-12-crawler-type/prompt.md`.

---

## Input Schema

### Crawling behaviour

- **`useSitemaps`** (bool, default `false`) — discovers URLs by crawling `sitemap.xml` at each domain in addition to link-following
- **`useLlmsTxt`** (bool, default `false`) — fetches `/llms.txt` at each domain root and enqueues linked Markdown files
- **`ignoreCanonicalUrl`** (bool, default `false`) — skips canonical URL / ETag deduplication; useful for sites that report incorrect canonicals
- **`initialConcurrency`** (int, default `0`) — starting concurrency; auto-scales up to `maxConcurrency`. Contextractor starts at Crawlee's default and only exposes `maxConcurrency`
- **`maxSessionRotations`** (int, default `10`) — max proxy/session rotations on blocks/CAPTCHAs before marking a page failed
- **`minFileDownloadSpeedKBps`** (int, default `128`) — aborts and retries file downloads slower than this threshold

### Page load / wait

- **`dynamicContentWaitSecs`** (int, default `10`) — WCC waits up to this long for network idle; combined with `waitForSelector`. Contextractor has `waitUntil` (event-based) but no timeout-based wait for dynamic content.
- **`waitForSelector`** (string) — waits for a CSS selector to appear before extracting; fails the request if it doesn't appear within `dynamicContentWaitSecs`
- **`softWaitForSelector`** (string) — same as above but does not fail if selector never appears

### DOM manipulation (pre-extraction)

- **`keepElementsCssSelector`** (string) — keeps only elements matching this selector; everything else is removed before extraction
- **`removeElementsCssSelector`** (string) — removes matching elements before extraction. WCC ships a default list (nav, footer, dialogs, cookie banners); contextractor passes the full DOM to Trafilatura without pre-filtering
- **`clickElementsCssSelector`** (string, default `[aria-expanded="false"]`) — clicks matching elements to reveal hidden content (accordions, tabs) before extraction
- **`expandIframes`** (bool, default `true`) — inlines iframe content into the DOM before extraction (Firefox/Playwright only)
- **`blockMedia`** (bool) — blocks images, fonts, stylesheets, and videos for faster page loads

### Output control

- **`saveScreenshots`** (bool, default `false`) — saves a screenshot per page to KVS; adds `screenshotUrl` to the dataset record (Playwright only)
- **`saveFiles`** / **`saveContentTypes`** (string) — downloads linked files matching given MIME types (e.g. `application/pdf`, `text/*`); stores them in KVS with a dataset record per file
- **`storeSkippedUrls`** (bool, default `false`) — saves a JSON record of all skipped URLs (with skip reasons) to KVS as `SKIPPED_URLS`
- **`aggressivePrune`** (bool, default `false`) — removes content lines very similar to those already seen on other pages (Count-Min Sketch); reduces repeated menus/headers/footers in the dataset

### Adaptive crawling

- **`reuseStoredDetectionResults`** (bool, default `false`) — reuses rendering-type detection results from previous runs to skip re-probing already-classified URLs

### Advanced / experimental

- **`pageFunction`** (string) — arbitrary async JS executed in the browser context per page after load; receives `{ page, request }`. Allows custom interactions before extraction
- **`signHttpRequests`** (bool, default `false`) — signs requests via Web Bot Auth for Cloudflare Signed Agent compatibility (experimental)

---

## Output Schema

Dataset record fields present in WCC but absent in contextractor-ts:

- **`screenshotUrl`** — URL of the page screenshot in KVS
- **`htmlUrl`** — URL of the transformed HTML in KVS (contextractor saves raw HTML; WCC saves post-transformer HTML)
- **`crawl.depth`** — link depth from the start URL
- **`crawl.referrerUrl`** — URL of the page that linked to this one
- **`crawl.isFile`** — whether this record is a downloaded file rather than a crawled page
- **`crawl.requestStatus`** — whether the request was handled, skipped, or failed
- **Error records** — WCC writes a dataset record for pages that fail after all retries, with an `error` field. Contextractor silently skips failed pages.

---

## Behavioural (not schema)

- **File downloads** — WCC downloads PDFs, DOCX, XLS, CSV etc. as first-class output; contextractor only extracts text from HTML pages
- **Sitemap crawling** — WCC parses and enqueues URLs from `sitemap.xml`
- **llms.txt crawling** — WCC follows `/llms.txt` specifications for AI-friendly site indexing
- **Error recording** — WCC surfaces failed pages as dataset records; contextractor drops them silently
- **Crawl provenance** — WCC records `depth` and `referrerUrl` per page; contextractor does not track link graph
