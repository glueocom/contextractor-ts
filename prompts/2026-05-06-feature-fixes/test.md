# Test: waitUntil, proxy support, and html output

End-to-end tests for the three features implemented by `wait-until-wire.md`, `proxy.md`, and `html-output-actor.md`. Run after all three implementation prompts have been applied and the build is clean (`pnpm build && pnpm lint && pnpm test`).

All CLI commands run from the repo root. Replace `https://httpbin.org` with any publicly reachable URL that returns JSON if httpbin is unavailable.

---

## Prerequisites

```bash
pnpm build
docker info   # Docker daemon must be running
```

Start the Squid containers used across proxy tests:

```bash
docker run -d --name squid  -p 3128:3128 sameersbn/squid:3.5.27-2
docker run -d --name squid2 -p 3129:3128 sameersbn/squid:3.5.27-2
```

---

## Feature: waitUntil

### npm CLI

```bash
node apps/standalone/dist/cli.js --wait-until domcontentloaded https://example.com -o ./out-dcl
node apps/standalone/dist/cli.js --wait-until load            https://example.com -o ./out-load
node apps/standalone/dist/cli.js --wait-until networkidle     https://example.com -o ./out-ni
```

All three should produce output files in their respective directories. For a JS-heavy page the `domcontentloaded` output will be shorter than `networkidle`.

### npm package lib methods

Save as `test-wait-until.mjs` and run with `node test-wait-until.mjs`:

```js
import { createContextractorCrawler, buildRequests } from '@contextractor/crawler';
import { createWriteStream } from 'node:fs';

for (const waitUntil of ['load', 'domcontentloaded', 'networkidle']) {
  const results = [];
  const sink = async (r) => results.push(r.url);
  const crawler = createContextractorCrawler({
    startUrls: ['https://example.com'],
    sink,
    waitUntil,
  });
  await crawler.run(buildRequests(['https://example.com']));
  console.log(`waitUntil=${waitUntil}: extracted ${results.length} page(s) — OK`);
}
```

Expected: three lines each ending in `1 page(s) — OK`.

---

## Feature: proxy support

### npm CLI — basic proxy

```bash
node apps/standalone/dist/cli.js https://httpbin.org/ip \
  --proxy-urls=http://localhost:3128 -o ./out-proxy
```

Check Squid access log — must show a `httpbin.org` request:

```bash
docker exec squid tail -n 5 /var/log/squid/access.log
```

### docker CLI — access log diff per rotation strategy

```bash
# Reset logs
docker restart squid squid2

node apps/standalone/dist/cli.js \
  https://httpbin.org/ip https://httpbin.org/ip \
  https://httpbin.org/ip https://httpbin.org/ip \
  --proxy-urls=http://localhost:3128,http://localhost:3129 \
  --proxy-rotation=PER_REQUEST -o ./out-per-req

docker exec squid  wc -l /var/log/squid/access.log
docker exec squid2 wc -l /var/log/squid/access.log
```

PER_REQUEST: both Squids should show roughly equal request counts (~2 each).

```bash
docker restart squid squid2

node apps/standalone/dist/cli.js \
  https://httpbin.org/ip https://httpbin.org/ip \
  https://httpbin.org/ip https://httpbin.org/ip \
  --proxy-urls=http://localhost:3128,http://localhost:3129 \
  --proxy-rotation=UNTIL_FAILURE -o ./out-until-fail

docker exec squid  wc -l /var/log/squid/access.log
docker exec squid2 wc -l /var/log/squid/access.log
```

UNTIL_FAILURE: squid should show ~4 requests, squid2 should show 0.

### docker API methods

Use the Docker Engine REST API directly (no CLI):

```bash
# Get access log tail from squid via Docker API
curl -s --unix-socket /var/run/docker.sock \
  "http://localhost/v1.47/containers/squid/logs?stdout=1&tail=10" | strings

# Exec a command in squid2 via API
EXEC_ID=$(curl -s --unix-socket /var/run/docker.sock \
  -X POST -H "Content-Type: application/json" \
  -d '{"AttachStdout":true,"AttachStderr":true,"Cmd":["wc","-l","/var/log/squid/access.log"]}' \
  "http://localhost/v1.47/containers/squid2/exec" | grep -o '"Id":"[^"]*"' | cut -d'"' -f4)

curl -s --unix-socket /var/run/docker.sock \
  -X POST -H "Content-Type: application/json" \
  -d '{"Detach":false}' \
  "http://localhost/v1.47/exec/${EXEC_ID}/start"
```

### npm package lib methods

```js
import { createContextractorCrawler, buildRequests } from '@contextractor/crawler';
import { ProxyConfiguration } from 'crawlee';

const proxyConfiguration = new ProxyConfiguration({
  proxyUrls: ['http://localhost:3128', 'http://localhost:3129'],
});

const results = [];
const sink = async (r) => results.push(r.url);

const crawler = createContextractorCrawler({
  startUrls: ['https://httpbin.org/ip'],
  sink,
  proxyConfiguration,
  proxyRotation: 'PER_REQUEST',
});

await crawler.run(buildRequests(['https://httpbin.org/ip']));
console.log(`proxy lib test: ${results.length} result(s) — OK`);
```

### npm CLI — error messages

```bash
node apps/standalone/dist/cli.js https://example.com --proxy-urls=not-a-url
# expect: --proxy-urls: malformed URL "not-a-url"…

node apps/standalone/dist/cli.js https://example.com --proxy-urls=ftp://example.com:21
# expect: --proxy-urls: unsupported scheme "ftp:"…

node apps/standalone/dist/cli.js https://example.com --proxy-rotation=PER_REQUEST
# expect: Warning: --proxy-rotation=PER_REQUEST has no effect without --proxy-urls…
```

---

## Feature: html output

### npm CLI (standalone already supported html via --save)

```bash
node apps/standalone/dist/cli.js https://example.com --save html -o ./out-html
ls -lh ./out-html/
```

Expect one `.html` file with extracted HTML content (not the full page — only the main article body).

### npm package lib methods

```js
import { createContextractorCrawler, buildRequests } from '@contextractor/crawler';

const htmlResults = [];
const sink = async (r) => htmlResults.push(r.formats.html ?? '');

const crawler = createContextractorCrawler({
  startUrls: ['https://example.com'],
  sink,
  formats: ['html'],
});

await crawler.run(buildRequests(['https://example.com']));
console.assert(htmlResults[0]?.includes('<'), 'html format must contain HTML tags');
console.log(`html lib test: extracted ${htmlResults[0]?.length ?? 0} chars — OK`);
```

### Apify platform (Actor)

Deploy to the test Actor:

```bash
cd apps/apify-actor
apify push
cd ../..
```

Run on the platform with `saveExtractedHtmlToKeyValueStore` enabled:

```bash
apify call glueo/contextractor-test --input '{
  "startUrls": [{"url": "https://blog.apify.com/what-is-web-scraping/"}],
  "saveExtractedHtmlToKeyValueStore": true,
  "saveExtractedMarkdownToKeyValueStore": false
}'
```

Check the dataset output contains `extractedHtml`:

```bash
apify datasets ls
# then get items from the most recent dataset
apify datasets get-items <DATASET_ID> | head -c 2000
```

Or via mcpc:

```bash
mcpc @apify tools-call call-actor \
  actorId:="glueo/contextractor-test" \
  input:='{"startUrls":[{"url":"https://blog.apify.com/what-is-web-scraping/"}],"saveExtractedHtmlToKeyValueStore":true,"saveExtractedMarkdownToKeyValueStore":false}'
```

The dataset item should have an `extractedHtml` key with `hash`, `length`, `key`, and `url` fields. The KVS entry at the referenced key should have `Content-Type: text/html; charset=utf-8`.

---

## Cleanup

```bash
docker stop squid squid2 && docker rm squid squid2
rm -rf ./out-dcl ./out-load ./out-ni ./out-proxy ./out-per-req ./out-until-fail ./out-html
```
