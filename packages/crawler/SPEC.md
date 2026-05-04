# `@contextractor/crawler`

Shared Crawlee + Playwright crawler factory. Wraps `PlaywrightCrawler` from Crawlee with Contextractor-specific configuration: cookie-consent handling, adblocker integration, per-page extraction, and a flexible `Sink<T>` output interface.

## Role

Used by both `apps/apify-actor` and `apps/standalone`. Centralises all browser and crawl configuration so neither app depends on Crawlee or Playwright directly.

## Key Exports

- `createContextractorCrawler(opts: ContextractorCrawlerOptions): PlaywrightCrawler`
- `ContextractorCrawlerOptions` — configuration interface
- `ExtractionResult`, `Sink<T>` — result and sink types

## Key Options

- `startUrls` — seed URLs
- `sink` — `Sink<ExtractionResult>` where each extracted page is written
- `formats` — `OutputFormat[]` to extract (default: `['markdown']`)
- `extractionConfig` — `TrafilaturaConfig` forwarded to `ContentExtractor`
- `cookieStrategy` — `'ghostery' | 'autoconsent' | 'none'` (default: `'ghostery'`)
- Browser: `headless`, `launcher`, `ignoreSslErrors`, `bypassCSP`, `initialCookies`, `extraHTTPHeaders`, `userAgent`
- Crawl limits: `maxPages`, `maxResults`, `maxConcurrency`, `maxRetries`, `pageLoadTimeoutSecs`
- Crawl scope: `globs`, `excludes`, `linkSelector`, `maxCrawlingDepth`, `keepUrlFragments`

## Cookie Consent

Ghostery (`@ghostery/adblocker-playwright`) is the default cookie-consent strategy. DuckDuckGo Autoconsent (`@duckduckgo/autoconsent`) is a lazy-imported fallback for the `'autoconsent'` strategy.

## Dependencies

- `@contextractor/extraction` (workspace)
- `crawlee ^3`, `playwright ^1.50`
- `@ghostery/adblocker-playwright ^2`
- `@duckduckgo/autoconsent ^14` (optional)
