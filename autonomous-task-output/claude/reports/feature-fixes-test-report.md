# Feature Fixes Test Report

**Date:** 2026-05-07 08:00 UTC

---

## Build

**Result:** PASS

All packages build clean. One test fix required (see Code Fixes below).

---

## waitUntil

**CLI result:** PASS — all three values (`domcontentloaded`, `load`, `networkidle`) produced output files.

**Lib result:** PASS — all three values produced 1 extracted page each.
Note: deduplication guard needed in the test script (use unique `uniqueKey` per crawler run within the same process).

---

## Proxy

**CLI basic test:** Skipped — Docker not running at test time. Deferred.

**PROXY-ROTATION:** Skipped — Docker not running at test time. Deferred.

**PROXY-ERRORS:** PASS

- `--proxy-urls=not-a-url` → `--proxy-urls: malformed URL "not-a-url". Expected http://user:pass@host:port…`
- `--proxy-urls=ftp://example.com:21` → `--proxy-urls: unsupported scheme "ftp:" in "ftp://example.com:21"…`
- `--proxy-rotation=PER_REQUEST` (no proxy URLs) → `Warning: --proxy-rotation=PER_REQUEST has no effect without --proxy-urls;…`

**Deferred manual steps (Docker proxy tests):**

```bash
docker run -d --name squid  -p 3128:3128 sameersbn/squid:3.5.27-2
docker run -d --name squid2 -p 3129:3128 sameersbn/squid:3.5.27-2
sleep 3
node apps/standalone/dist/cli.js https://httpbin.org/ip \
  --proxy-urls=http://localhost:3128 -o ./out-proxy
docker exec squid tail -n 5 /var/log/squid/access.log
# Expect httpbin.org entry in Squid logs

docker restart squid squid2 && sleep 3
node apps/standalone/dist/cli.js \
  https://httpbin.org/ip https://httpbin.org/ip https://httpbin.org/ip https://httpbin.org/ip \
  --proxy-urls=http://localhost:3128,http://localhost:3129 \
  --proxy-rotation=PER_REQUEST -o ./out-per-req
docker exec squid  wc -l /var/log/squid/access.log
docker exec squid2 wc -l /var/log/squid/access.log
# Expect ~2 requests each

docker restart squid squid2 && sleep 3
node apps/standalone/dist/cli.js \
  https://httpbin.org/ip https://httpbin.org/ip https://httpbin.org/ip https://httpbin.org/ip \
  --proxy-urls=http://localhost:3128,http://localhost:3129 \
  --proxy-rotation=UNTIL_FAILURE -o ./out-until-fail
docker exec squid  wc -l /var/log/squid/access.log
docker exec squid2 wc -l /var/log/squid/access.log
# Expect ~4 requests in squid, 0 in squid2
```

---

## HTML

**CLI result:** PASS — `out-html/example-com.html` (138 bytes) created with extracted HTML content.

**Lib result:** PASS — 138 chars extracted, assertion `includes('<')` passed.

**Platform test:** Deferred (Actor not yet deployed). Run after `apify push`:

```bash
# From apps/apify-actor/
apify push

apify call glueo/contextractor-test --input '{
  "startUrls": [{"url": "https://blog.apify.com/what-is-web-scraping/"}],
  "saveExtractedHtmlToKeyValueStore": true,
  "saveExtractedMarkdownToKeyValueStore": false
}'
# Expect: dataset item has extractedHtml.hash, .length, .key, .url
# Expect: KVS content type text/html; charset=utf-8
```

---

## Code Fixes Applied

### `packages/crawler/src/createCrawler.ts`
- Added `PlaywrightHook` to type import
- Added `waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'` to `ContextractorCrawlerOptions`
- Added `proxyRotation?: 'RECOMMENDED' | 'PER_REQUEST' | 'UNTIL_FAILURE'` to `ContextractorCrawlerOptions`
- Added `SESSION_MAX_USAGE_COUNTS` constant (from `@apify/scraper-tools` semantics)
- Refactored `sessionPoolOptions` to incorporate proxy rotation overrides (`maxUsageCount`, `maxPoolSize`)
- Replaced conditional ghostery `preNavigationHooks` spread with explicit array build; `waitUntil` hook prepended before ghostery hook
- Fixed pre-existing bug: `extraHTTPHeaders` guard changed from `if (opts.extraHTTPHeaders)` to `Object.keys(...).length > 0` — Crawlee 3.x rejects `contextOptions` in `launchContext`, and the prior code incorrectly treated `{}` as non-empty, injecting an empty `contextOptions` for every default CLI invocation

### `apps/standalone/src/cliProgram.ts`
- Added `ProxyConfiguration` import from `crawlee`
- Added proxy validation block (URL scheme check, `process.exit(1)` on bad input, no-op warning for rotation without URLs)
- Wired `waitUntil: cfg.waitUntil` into `createContextractorCrawler` call
- Wired `proxyConfiguration` and `proxyRotation: cliOnly.proxyRotation` into `createContextractorCrawler` call
- Updated `resolveCliOnly` to surface `proxyRotation: input.proxyRotation`

### `apps/standalone/src/config.ts`
- Removed `PROXY_ROTATION_MAP` (no longer needed — uppercase enum values pass through directly)
- Removed `proxyUrls` and `proxyRotation` from `CrawlConfig` (both now live in `CliOnlyOverrides`)
- Added `proxyRotation?: 'RECOMMENDED' | 'PER_REQUEST' | 'UNTIL_FAILURE'` to `CliOnlyOverrides`

### `apps/apify-actor/src/config.ts`
- Added `WAIT_UNTIL_MAP`
- Added optional `proxyRotation` fifth parameter to `buildCrawlerOpts`
- Wired `waitUntil: WAIT_UNTIL_MAP[input.waitUntil]` into return
- Wired `proxyRotation` into return (alongside `proxyConfiguration`)
- Added `if (input.saveExtractedHtmlToKeyValueStore) formats.push('html')`

### `apps/apify-actor/src/run.ts`
- Forwarded `input.proxyRotation` as fifth arg to `buildCrawlerOpts`

### `packages/schema/src/input.ts`
- Updated `waitUntil` field: richer description, added `sectionCaption: 'Performance and limits'`
- Updated `pageLoadTimeoutSecs`: changed `sectionCaption` from `'Browser'` to `'Performance and limits'`
- Added `saveExtractedHtmlToKeyValueStore` field after `saveExtractedMarkdownToKeyValueStore`

### `apps/apify-actor/src/sinks.ts`
- Added `html` entry to `FORMAT_SPECS`

### `apps/apify-actor/.actor/dataset_schema.json`
- Added `extractedHtml` field

### `apps/standalone/src/cli.test.ts`
- Removed stale assertion `expect(cfg.proxyRotation).toBe('recommended')` — `proxyRotation` moved to `CliOnlyOverrides`
