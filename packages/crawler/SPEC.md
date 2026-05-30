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

`createContextractorCrawler` accepts a `sink: Sink<ExtractionResult>`. Built-in sink:

- `memorySink()` — accumulates results in memory (tests)

### Shared storage sink core (`sinks/storage.ts`)

Record assembly and key-value-store key derivation shared by the Apify Actor and the standalone CLI/lib, so their dataset records and KVS output are identical (the only difference is `ContentRef.url`, present only where a public KVS URL exists). Exports:

- `kvsKey(kind, url)` — deterministic KVS key `{format}-{md5(url)}.{ext}` for `txt | markdown | json | html | original`
- `buildSuccessRecord(result, { kvs, toKvs, toDataset, saveOriginal })` — assembles the `status: 'success'` record: an inline string + `{fmt}Hash` for the dataset, a `ContentRef` for the key-value store (dataset wins when both are selected; `original` prefers the KVS to avoid inlining large raw HTML)
- `buildFailedRecord(info)` / `buildSkippedRecord(url, reason)` — the `failed` / `skipped` records
- types `ContentRef`, `KvsLike`, `ContentKind`

### `ExtractionResult` (sink input)

`url` (original request URL), `loadedUrl` (final URL after redirects), `html`, `rawHtmlHash`, `rawHtmlLength`, `formats: Partial<Record<OutputFormat, string>>`, `metadata: Metadata`, `crawlDepth: number` (link distance from start URL; 0 for start URLs), `referrerUrl: string | null` (URL of the linking page; `null` for start URLs).

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

`startUrls`, `sink`, `formats`, `mode` (`'precision' | 'balanced' | 'recall'`; translated to `favorPrecision`/`favorRecall` in `TrafilaturaConfig`), `includeComments`, `includeTables`, `includeImages`, `includeLinks`, `targetLanguage`, `scroll`, `cookieStrategy`, `sessionPool`, `sessionPoolName` (string; if set, used as `persistStateKey` in `sessionPoolOptions` to persist the session pool across runs), `maxSessionRotations` (int; default `10`; maps to Crawlee `maxSessionRotations`; controls how many times a session can be rotated per request on block detection), `maxPages`, `maxRetries`, `initialConcurrency` (maps to Crawlee `minConcurrency`; only applied when > 0), `maxConcurrency`, `pageLoadTimeoutSecs`, `blockMedia`, `headless`, `crawlerType`, `renderingTypeDetectionPercentage`, `ignoreSslErrors`, `bypassCSP`, `initialCookies`, `extraHTTPHeaders`, `userAgent`, `linkSelector`, `maxCrawlingDepth`, `maxResults`, `globs`, `excludes`, `keepUrlFragments`, `proxyConfiguration`, `requestQueue`, `respectRobotsTxt`, `onFailedRequest`, `onSkippedUrl`, `dynamicContentWaitSecs` (Playwright only; seconds to wait for network idle after navigation before extraction; also doubles as the timeout for `waitForSelector`/`softWaitForSelector`; 0 disables; default `0`), `waitForSelector` (Playwright only; CSS selector to await before extraction; request fails on timeout), `softWaitForSelector` (Playwright only; like `waitForSelector` but continues on timeout).

- `onFailedRequest?: (info: { url, loadedUrl, errorMessages, retryCount }) => Promise<void>` — called after all retries are exhausted for a request
- `onSkippedUrl?: (url: string, reason: string) => void` — called synchronously during `enqueueLinks` when a URL is skipped (glob filter, robots.txt, depth limit, or concurrency cap)
- `deduplication?: 'minimal' | 'basic' | 'full'` (default `'basic'`) — controls post-fetch deduplication layered on top of Crawlee's built-in URL dedup. `createContextractorCrawler` initialises shared `seenCanonicals: Set<string>` and `seenContentHashes: Set<string>` and passes them to all three handler factories. `'minimal'`: no additional dedup beyond Crawlee URL dedup. `'basic'`: skips pages whose `<link rel="canonical">` was already seen and differs from the current URL; applies to all three handler types. `'full'`: additionally skips pages whose extracted text content hash was already seen.
- `blockMedia?: boolean` — when `true`, blocks images, stylesheets, fonts, PDFs, and ZIPs. Only effective with `playwright:chromium` and `playwright:adaptive`; setting it with `cheerio` or `playwright:firefox` emits a `log.warning`.

## Proxy Configuration

Pass proxy URLs via `proxyConfiguration: new ProxyConfiguration({ proxyUrls: [...] })`.

Rotation mode is controlled by `proxyRotation`:

- `'RECOMMENDED'` (default) — Crawlee's default rotation strategy
- `'PER_REQUEST'` — new proxy session per request
- `'UNTIL_FAILURE'` — single session until failure, then rotate

In handler context, proxy metadata is available via `request.proxyInfo` (when a proxy was used):

```ts
const { hostname, port, url } = context.request.proxyInfo;
```

Properties: `hostname` (proxy server hostname), `port` (proxy server port), `url` (full proxy URL as configured).

Proxy info is available in all handler types (`PlaywrightCrawlingContext`, `CheerioCrawlingContext`, `AdaptivePlaywrightCrawlerContext`) when a proxy is active.
