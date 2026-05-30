# apps/apify-actor — Specification

Apify Actor wrapping the Contextractor extraction engine.

## Data flow

```
Actor.getInput() → ContextractorInput.safeParse() → [SitemapRequestList.open() if useSitemaps]
                                                   → createContextractorCrawler()
                                                      └── ContentExtractor per page
                                                            └── createApifySink()
                                                                  ├── KVS (content blobs)
                                                                  └── Dataset (metadata + references)
```

When `useSitemaps` is `true`, `SitemapRequestList.open()` is called before the crawler is started. It fetches `sitemap.xml` at the origin of each start URL and enqueues matching URLs, filtered by `globs` and `excludes`. The explicit start URLs are still crawled via `crawler.run()`.

## Sinks

`createApifySink({ kvs, dataset, saveOriginal, saveDestination })` delegates record assembly and KVS key derivation to the shared `@contextractor/crawler` sink core (`buildSuccessRecord`, `kvsKey`), so the Actor and the standalone CLI/lib produce identical output. It saves:

- Every content field (`txt`, `json`, `markdown`, `html`, and `original`) as a `ContentNode` object — `hash` (MD5) + `bytes` (UTF-8 byte length) always present; inline `content` when `saveDestination` is `dataset`, or `key` + `url` referencing the stored blob when `key-value-store` (dataset takes precedence when both destinations are selected)
- `original` is always present (at least `{ hash, bytes }`); its raw HTML is included only when `"original"` is in `save`
- One dataset item per page with `url`, `loadedUrl`, `status: 'success'`, `loadedAt`, `metadata`, `httpStatus`, `crawl`, `original`, and per-format content (each a `ContentNode`)

KVS keys are `{format}-{md5(url)}.{ext}` — the content format, the full 32-char MD5 hex of the request URL, and the format's extension (`txt-…txt`, `markdown-…md`, `json-…json`, `html-…html`, `original-…html`).

## Dataset record shapes

Every record has a `status` field. Three record shapes are possible:

- **success** — `{ url, loadedUrl, status: 'success', loadedAt, metadata, httpStatus, crawl: { depth, referrerUrl }, original, ...formats }`; produced by `createApifySink` for each successfully extracted page; every content field (incl. `original`) is a `ContentNode` (`hash` + `bytes` always present, plus inline `content` or `key`/`url` when stored); `url` is the original request URL, `loadedUrl` is the final URL after redirects; `depth` is the link distance from a start URL (0 for start URLs), `referrerUrl` is the linking page URL or `null` for start URLs
- **failed** — `{ url, loadedUrl, status: 'failed', errorMessages, retryCount, crawledAt }`; pushed via `onFailedRequest` after all retries are exhausted
- **skipped** — `{ url, status: 'skipped', skipReason }`; pushed via `onSkippedUrl` when `storeSkippedUrls: true`; reason values: `'robotsTxt'`, `'limit'`, `'enqueueLimit'`, `'filters'`, `'redirect'`, `'depth'`

`.actor/dataset_schema.json`, `output_schema.json`, and `key_value_store_schema.json` are generated from the `ContextractorOutput` Zod union plus the `OutputViews` / `KvsCollections` presentation config in `@contextractor/schema` (via `@contextractor/gen-input-schema`); they are not hand-edited. `actor.json` stays hand-written.

## Config

`buildCrawlerOpts(input, sink, proxyConfig, requestQueue, proxyRotation?)` maps `ContextractorInputType` → `ContextractorCrawlerOptions`. Passes `mode`, `includeComments`, `includeTables`, `includeImages`, `includeLinks`, `targetLanguage`, `crawlerType`, `renderingTypeDetectionPercentage`, `blockMedia`, `initialConcurrency`, `dynamicContentWaitSecs`, `waitForSelector`, `softWaitForSelector`, `deduplication`, `sessionPoolName`, and `maxSessionRotations` directly from input.

## Proxy

`run.ts` builds the proxy configuration before calling `buildCrawlerOpts`. If `input.proxyConfiguration` is set, calls `Actor.createProxyConfiguration(input.proxyConfiguration)`; otherwise `proxyConfig` is `undefined`.

## Entry point

`apps/apify-actor/src/main.ts` → `runActor()` in `src/run.ts`. Actor initializes with `Actor.init()` and exits with `Actor.exit()`. Input validation failure exits with code 1.

## Testing

Proxy rotation is tested via the `/proxy-test` slash command, which verifies proxy configuration, rotation modes, and content extraction for this entry point alongside the CLI and library entry points.

See `tools/proxy-rotation-tester/README.md` for test documentation.

## Deploy

Production deploys go through a Git-connected build in Apify Console (`glueo/contextractor`). `actor.json` sets `"dockerContextDir": "../../.."` so the Dockerfile sees all workspace packages. Test deploys target `glueo/contextractor-test` via `/platform:deploy-and-test`.
