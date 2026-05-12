# @contextractor/crawler — Specification

Shared Crawlee + Playwright crawler factory used by both the Apify Actor and the standalone CLI.

## Public API

### `createContextractorCrawler(opts)`

Returns a `PlaywrightCrawler` configured with the provided `ContextractorCrawlerOptions`. The crawler's default handler extracts content and calls the provided `sink` for each page.

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

`url`, `html`, `rawHtmlHash`, `rawHtmlLength`, `formats: Partial<Record<OutputFormat, string>>`, `metadata: Metadata`.

## Browser behaviour

- **Launcher**: `'chromium'` (default) or `'firefox'`
- **Cookie consent**: `'ghostery'` (default, pre-navigation hook via `@ghostery/adblocker-playwright`), `'autoconsent'` (post-navigation hook via `@duckduckgo/autoconsent`, lazy import), or `'none'`
- **Auto-scroll**: optional `ScrollConfig` for infinite-scroll pages
- **Session pool**: enabled by default; persists cookies per session

## Key options (`ContextractorCrawlerOptions`)

`startUrls`, `sink`, `extractionConfig`, `formats`, `scroll`, `cookieStrategy`, `sessionPool`, `maxPages`, `maxRetries`, `maxConcurrency`, `pageLoadTimeoutSecs`, `headless`, `launcher`, `ignoreSslErrors`, `bypassCSP`, `initialCookies`, `extraHTTPHeaders`, `userAgent`, `linkSelector`, `maxCrawlingDepth`, `maxResults`, `globs`, `excludes`, `keepUrlFragments`, `proxyConfiguration`, `requestQueue`, `browserLog`, `respectRobotsTxt`.
