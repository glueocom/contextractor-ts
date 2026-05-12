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

`createApifySink({ kvs, dataset, saveOriginal, saveDestination })` saves:

- Raw HTML to KVS as `{hash}-original.html` when `saveOriginal` is true and destination includes `key-value-store`; or inline on the dataset item when destination is `dataset` only
- Extracted `txt`, `json`, `markdown`, `html` routed per `saveDestination`: KVS content-info references when `key-value-store`; inline strings plus a `{format}Hash` field (e.g. `markdownHash`) when `dataset`
- One dataset item per page with `loadedUrl`, `status: 'success'`, `loadedAt`, `metadata`, `httpStatus`, `originalHash` (MD5 of raw HTML), and per-format content; when destination is `dataset`, each format field is accompanied by a `{format}Hash` field (e.g. `markdownHash`)

Keys use the first 16 hex characters of an MD5 over the URL.

## Dataset record shapes

Every record has a `status` field. Three record shapes are possible:

- **success** — `{ loadedUrl, status: 'success', loadedAt, metadata, httpStatus, originalHash, crawl: { depth, referrerUrl }, ...formats }`; produced by `createApifySink` for each successfully extracted page; `depth` is the link distance from a start URL (0 for start URLs), `referrerUrl` is the linking page URL or `null` for start URLs
- **failed** — `{ url, loadedUrl, status: 'failed', errorMessages, retryCount, crawledAt }`; pushed via `onFailedRequest` after all retries are exhausted
- **skipped** — `{ url, status: 'skipped', skipReason }`; pushed via `onSkippedUrl` when `storeSkippedUrls: true`; reason values: `'robotsTxt'`, `'limit'`, `'enqueueLimit'`, `'filters'`, `'redirect'`, `'depth'`

## Config

`buildCrawlerOpts(input, sink, proxyConfig, requestQueue, proxyRotation?)` maps `ContextractorInputType` → `ContextractorCrawlerOptions`. Passes `crawlerType`, `renderingTypeDetectionPercentage`, `blockMedia`, `initialConcurrency`, `dynamicContentWaitSecs`, `waitForSelector`, `softWaitForSelector`, and `ignoreCanonicalUrl` directly from input.

## Entry point

`apps/apify-actor/src/main.ts` → `runActor()` in `src/run.ts`. Actor initializes with `Actor.init()` and exits with `Actor.exit()`. Input validation failure exits with code 1.

## Deploy

Production deploys go through a Git-connected build in Apify Console (`glueo/contextractor`). `actor.json` sets `"dockerContextDir": "../../.."` so the Dockerfile sees all workspace packages. Test deploys target `glueo/contextractor-test` via `/platform:deploy-and-test`.
