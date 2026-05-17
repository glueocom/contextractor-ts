# @contextractor/crawler — Specification

Shared Crawlee + Playwright crawler factory used by both the Apify Actor and the standalone CLI.

## Public API

### `createContextractorCrawler(opts)`

Returns a `BasicCrawler` (the common supertype). The concrete type depends on `crawlerType`:

- `'playwright:adaptive'` (default) — `AdaptivePlaywrightCrawler`, handler via `createAdaptiveHandler`
- `'playwright:chromium'` / `'playwright:firefox'` — `PlaywrightCrawler`, handler via `createHandler`
- `'cheerio'` — `CheerioCrawler`, handler via `createCheerioHandler`

### `buildRequests(startUrls, keepUrlFragments?)`

Maps URL strings to `Request[]` for `crawler.run()`.

### Sink pattern

```ts
type Sink<T> = (result: T) => Promise<void>;
```

`createContextractorCrawler` accepts a `sink: Sink<ExtractionResult>`. Two built-in sinks:

- `fileSink({ outDir, formats? })` — writes one file per page per format to disk (standalone CLI)
- `memorySink()` — accumulates results in memory (tests)

### `ExtractionResult` (sink input)

`url`, `html`, `rawHtmlHash`, `rawHtmlLength`, `formats: Partial<Record<OutputFormat, string>>`, `metadata: Metadata`, `crawlDepth: number` (link distance from start URL; 0 for start URLs), `referrerUrl: string | null` (URL of the linking page; `null` for start URLs).

`crawlDepth` and `referrerUrl` are read from `request.userData` at handler entry and propagated via `enqueueLinks` `userData: { depth, referrerUrl }` so every enqueued child carries the correct values.

## Handler factories

- `createHandler(opts)` — `RequestHandler<PlaywrightCrawlingContext>` for `PlaywrightCrawler` paths
- `createAdaptiveHandler(opts)` — `RequestHandler<AdaptivePlaywrightCrawlerContext>`; uses `parseWithCheerio()` to get HTML; does not access `page` directly
- `createCheerioHandler(opts)` — `RequestHandler<CheerioCrawlingContext>`; gets HTML via `$('html').prop('outerHTML')`; no scroll

## Browser behaviour

- **Cookie consent**: `'ghostery'` (default, pre-navigation hook via `@ghostery/adblocker-playwright`), `'autoconsent'` (post-navigation hook via `@duckduckgo/autoconsent`, lazy import), or `'none'`; not applied for `cheerio`
- **Auto-scroll**: optional `ScrollConfig` for infinite-scroll pages; only applies to `PlaywrightCrawler` path
- **Session pool**: enabled by default; persists cookies per session

## Key options (`ContextractorCrawlerOptions`)

`startUrls`, `sink`, `formats`, `mode` (`'precision' | 'balanced' | 'recall'`; translated to `favorPrecision`/`favorRecall` in `TrafilaturaConfig`), `includeComments`, `includeTables`, `includeImages`, `includeLinks`, `targetLanguage`, `scroll`, `cookieStrategy`, `sessionPool`, `maxPages`, `maxRetries`, `initialConcurrency` (maps to Crawlee `minConcurrency`; only applied when > 0), `maxConcurrency`, `pageLoadTimeoutSecs`, `blockMedia`, `headless`, `crawlerType`, `renderingTypeDetectionPercentage`, `ignoreSslErrors`, `bypassCSP`, `initialCookies`, `extraHTTPHeaders`, `userAgent`, `linkSelector`, `maxCrawlingDepth`, `maxResults`, `globs`, `excludes`, `keepUrlFragments`, `proxyConfiguration`, `requestQueue`, `respectRobotsTxt`, `onFailedRequest`, `onSkippedUrl`, `dynamicContentWaitSecs` (Playwright only; seconds to wait for network idle after navigation before extraction; also doubles as the timeout for `waitForSelector`/`softWaitForSelector`; 0 disables; default `0`), `waitForSelector` (Playwright only; CSS selector to await before extraction; request fails on timeout), `softWaitForSelector` (Playwright only; like `waitForSelector` but continues on timeout).

- `onFailedRequest?: (info: { url, loadedUrl, errorMessages, retryCount }) => Promise<void>` — called after all retries are exhausted for a request
- `onSkippedUrl?: (url: string, reason: string) => void` — called synchronously during `enqueueLinks` when a URL is skipped (glob filter, robots.txt, depth limit, or concurrency cap)
- `ignoreCanonicalUrl?: boolean` (default `false`) — when `false`, `createHandler` maintains a `seenCanonicals` Set for the lifetime of the crawl; after `page.content()` it extracts the `<link rel="canonical">` href and skips the page if that canonical was already seen (and the canonical differs from the current URL); when `true`, the check is disabled and every loaded URL is extracted; Playwright-only (`createCheerioHandler` and `createAdaptiveHandler` are not affected)

## Proxy Configuration

Pass proxy URLs via `proxyConfiguration: { proxyUrls: [...] }`. Rotation mode is controlled by `proxyRotation`:

- `'RECOMMENDED'` (default) — Crawlee's default rotation strategy
- `'PER_REQUEST'` — new proxy session per request
- `'UNTIL_FAILURE'` — single session until failure, then rotate

In handler context, proxy metadata is available via `request.proxyInfo` (when a proxy was used):

```ts
const { hostname, port, url } = context.request.proxyInfo;
```

Properties: `hostname` (proxy server hostname), `port` (proxy server port), `url` (full proxy URL as configured).

Proxy info is available in all handler types (`PlaywrightCrawlingContext`, `CheerioCrawlingContext`, `AdaptivePlaywrightCrawlerContext`) when a proxy is active.
